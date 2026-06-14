import { readFile, writeFile } from "node:fs/promises";
import { Data, Effect } from "effect";
import { truncateForModel } from "./tool-limits.ts";
import { resolveToolPath } from "./tool-path.ts";

const CONTEXT_LINES = 3;
const MAX_DIFF_LINES = 120;

export class EditError extends Data.TaggedError("EditError")<{
  readonly message: string;
}> {}

export type EditResult = {
  readonly path: string;
  readonly replacements: number;
  readonly contentBefore: string;
  readonly contentAfter: string;
};

export type EditOptions = {
  readonly file_path: string;
  readonly old_string: string;
  readonly new_string: string;
  readonly replace_all?: boolean | undefined;
};

const normalizeLineEndings = (text: string): string =>
  text.replaceAll("\r\n", "\n");

const detectLineEnding = (text: string): "\n" | "\r\n" =>
  text.includes("\r\n") ? "\r\n" : "\n";

const convertToLineEnding = (
  text: string,
  ending: "\n" | "\r\n",
): string => (ending === "\n" ? text : text.replaceAll("\n", "\r\n"));

const toFileNeedle = (
  text: string,
  ending: "\n" | "\r\n",
): string => convertToLineEnding(normalizeLineEndings(text), ending);

const countOccurrences = (text: string, needle: string): number => {
  if (needle.length === 0) {
    return 0;
  }

  let count = 0;
  let index = 0;

  while ((index = text.indexOf(needle, index)) !== -1) {
    count += 1;
    index += needle.length;
  }

  return count;
};

type DiffOp =
  | { readonly tag: "equal"; readonly lines: readonly string[] }
  | { readonly tag: "delete"; readonly lines: readonly string[] }
  | { readonly tag: "insert"; readonly lines: readonly string[] };

const diffLineArrays = (
  before: readonly string[],
  after: readonly string[],
): DiffOp[] => {
  const rows = before.length;
  const cols = after.length;
  const lengths = Array.from({ length: rows + 1 }, () =>
    Array<number>(cols + 1).fill(0),
  );

  for (let row = 1; row <= rows; row += 1) {
    for (let col = 1; col <= cols; col += 1) {
      if (before[row - 1] === after[col - 1]) {
        lengths[row][col] = lengths[row - 1][col - 1] + 1;
      } else {
        lengths[row][col] = Math.max(lengths[row - 1][col], lengths[row][col - 1]);
      }
    }
  }

  const ops: DiffOp[] = [];
  let row = rows;
  let col = cols;

  const pushLines = (tag: DiffOp["tag"], line: string) => {
    const last = ops.at(-1);
    if (last?.tag === tag) {
      ops[ops.length - 1] = { tag, lines: [...last.lines, line] };
      return;
    }

    ops.push({ tag, lines: [line] });
  };

  while (row > 0 || col > 0) {
    if (row > 0 && col > 0 && before[row - 1] === after[col - 1]) {
      pushLines("equal", before[row - 1]);
      row -= 1;
      col -= 1;
      continue;
    }

    if (col > 0 && (row === 0 || lengths[row][col - 1] >= lengths[row - 1][col])) {
      pushLines("insert", after[col - 1]);
      col -= 1;
      continue;
    }

    pushLines("delete", before[row - 1]);
    row -= 1;
  }

  return ops.reverse();
};

const trimDiffIndent = (diff: string): string => {
  const lines = diff.split("\n");
  const contentLines = lines.filter(
    (line) =>
      (line.startsWith("+") || line.startsWith("-") || line.startsWith(" ")) &&
      !line.startsWith("---") &&
      !line.startsWith("+++"),
  );

  if (contentLines.length === 0) {
    return diff;
  }

  let min = Infinity;

  for (const line of contentLines) {
    const content = line.slice(1);
    if (content.trim().length > 0) {
      const match = content.match(/^(\s*)/);
      if (match) {
        min = Math.min(min, match[1].length);
      }
    }
  }

  if (min === Infinity || min === 0) {
    return diff;
  }

  return lines
    .map((line) => {
      if (
        (line.startsWith("+") || line.startsWith("-") || line.startsWith(" ")) &&
        !line.startsWith("---") &&
        !line.startsWith("+++")
      ) {
        const prefix = line[0];
        const content = line.slice(1);
        return `${prefix}${content.slice(min)}`;
      }

      return line;
    })
    .join("\n");
};

type FlatEntry = {
  readonly type: DiffOp["tag"];
  readonly line: string;
};

const flattenOps = (ops: readonly DiffOp[]): FlatEntry[] =>
  ops.flatMap((op) => op.lines.map((line) => ({ type: op.tag, line })));

const buildHunkRanges = (flat: readonly FlatEntry[]): Array<[number, number]> => {
  const changeIndices = flat.flatMap((entry, index) =>
    entry.type === "equal" ? [] : [index],
  );

  if (changeIndices.length === 0) {
    return [];
  }

  const ranges: Array<[number, number]> = [];
  let start = Math.max(0, changeIndices[0] - CONTEXT_LINES);
  let end = Math.min(flat.length - 1, changeIndices[0] + CONTEXT_LINES);

  for (let index = 1; index < changeIndices.length; index += 1) {
    const changeIndex = changeIndices[index];

    if (changeIndex - CONTEXT_LINES <= end + 1) {
      end = Math.min(flat.length - 1, changeIndex + CONTEXT_LINES);
      continue;
    }

    ranges.push([start, end]);
    start = Math.max(0, changeIndex - CONTEXT_LINES);
    end = Math.min(flat.length - 1, changeIndex + CONTEXT_LINES);
  }

  ranges.push([start, end]);
  return ranges;
};

const lineNumberAt = (
  flat: readonly FlatEntry[],
  index: number,
): { readonly oldLine: number; readonly newLine: number } => {
  let oldLine = 1;
  let newLine = 1;

  for (let cursor = 0; cursor < index; cursor += 1) {
    const entry = flat[cursor];
    if (entry.type !== "insert") {
      oldLine += 1;
    }
    if (entry.type !== "delete") {
      newLine += 1;
    }
  }

  return { oldLine, newLine };
};

const formatUnifiedDiff = (
  filePath: string,
  contentBefore: string,
  contentAfter: string,
): string => {
  const beforeLines = normalizeLineEndings(contentBefore).split("\n");
  const afterLines = normalizeLineEndings(contentAfter).split("\n");
  const flat = flattenOps(diffLineArrays(beforeLines, afterLines));
  const ranges = buildHunkRanges(flat);
  const lines: string[] = [`--- ${filePath}`, `+++ ${filePath}`];
  let emitted = 0;

  for (const [start, end] of ranges) {
    if (emitted >= MAX_DIFF_LINES) {
      lines.push("... (diff truncated)");
      break;
    }

    const { oldLine, newLine } = lineNumberAt(flat, start);
    let oldCount = 0;
    let newCount = 0;

    for (let index = start; index <= end; index += 1) {
      const entry = flat[index];
      if (entry.type !== "insert") {
        oldCount += 1;
      }
      if (entry.type !== "delete") {
        newCount += 1;
      }
    }

    lines.push(`@@ -${oldLine},${oldCount} +${newLine},${newCount} @@`);

    for (let index = start; index <= end && emitted < MAX_DIFF_LINES; index += 1) {
      const entry = flat[index];
      const prefix =
        entry.type === "equal" ? " " : entry.type === "delete" ? "-" : "+";
      lines.push(`${prefix}${entry.line}`);
      emitted += 1;
    }
  }

  if (emitted >= MAX_DIFF_LINES) {
    lines.push("... (diff truncated)");
  }

  return trimDiffIndent(lines.join("\n"));
};

export const formatEditOutput = (result: EditResult): string =>
  truncateForModel(
    [
      `Edited file successfully: ${result.path}`,
      `Replacements: ${result.replacements}`,
      "```diff",
      formatUnifiedDiff(result.path, result.contentBefore, result.contentAfter),
      "```",
    ].join("\n"),
  );

export const editFile = (
  options: EditOptions,
): Effect.Effect<EditResult, EditError> =>
  Effect.gen(function* () {
    if (options.old_string === options.new_string) {
      return yield* Effect.fail(
        new EditError({
          message: "old_string and new_string must be different",
        }),
      );
    }

    const filePath = resolveToolPath(options.file_path);

    const content = yield* Effect.tryPromise({
      try: () => readFile(filePath, "utf-8"),
      catch: (cause) =>
        new EditError({
          message: `failed to read file "${filePath}": ${String(cause)}`,
        }),
    });

    if (options.old_string.length === 0) {
      return yield* Effect.fail(
        new EditError({
          message:
            "old_string cannot be empty when editing an existing file. Provide the exact text to replace, or use Write for a full-file replacement.",
        }),
      );
    }

    const ending = detectLineEnding(content);
    const oldNeedle = toFileNeedle(options.old_string, ending);
    const newReplacement = toFileNeedle(options.new_string, ending);
    const replacements = countOccurrences(content, oldNeedle);

    if (replacements === 0) {
      return yield* Effect.fail(
        new EditError({
          message:
            "Could not find old_string in the file. It must match exactly, including whitespace and indentation.",
        }),
      );
    }

    if (replacements > 1 && options.replace_all !== true) {
      return yield* Effect.fail(
        new EditError({
          message:
            "Found multiple exact matches for old_string. Provide more surrounding context or set replace_all to true.",
        }),
      );
    }

    const nextContent =
      options.replace_all === true
        ? content.replaceAll(oldNeedle, newReplacement)
        : content.replace(oldNeedle, newReplacement);

    yield* Effect.tryPromise({
      try: () => writeFile(filePath, nextContent, "utf-8"),
      catch: (cause) =>
        new EditError({
          message: `failed to write file "${filePath}": ${String(cause)}`,
        }),
    });

    return {
      path: filePath,
      replacements: options.replace_all === true ? replacements : 1,
      contentBefore: content,
      contentAfter: nextContent,
    };
  });
