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

export type StringEdit = {
  readonly old_string: string;
  readonly new_string: string;
  readonly replace_all?: boolean | undefined;
};

export type EditOptions = StringEdit & {
  readonly file_path: string;
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

const countOccurrences = (text: string, needle: string): number =>
  text.split(needle).length - 1;

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

const firstDiffRange = (
  beforeLines: readonly string[],
  afterLines: readonly string[],
): { readonly start: number; readonly endBefore: number; readonly endAfter: number } => {
  const maxShared = Math.min(beforeLines.length, afterLines.length);
  let start = 0;

  while (start < maxShared && beforeLines[start] === afterLines[start]) {
    start += 1;
  }

  let endBefore = beforeLines.length - 1;
  let endAfter = afterLines.length - 1;

  while (
    endBefore >= start &&
    endAfter >= start &&
    beforeLines[endBefore] === afterLines[endAfter]
  ) {
    endBefore -= 1;
    endAfter -= 1;
  }

  return { start, endBefore, endAfter };
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
  let pendingTag: DiffOp["tag"] | null = null;
  let pendingLines: string[] = [];

  const flush = () => {
    if (pendingTag && pendingLines.length > 0) {
      ops.push({ tag: pendingTag, lines: pendingLines });
      pendingLines = [];
      pendingTag = null;
    }
  };

  const pushLine = (tag: DiffOp["tag"], line: string) => {
    if (pendingTag !== tag) {
      flush();
      pendingTag = tag;
    }

    pendingLines.push(line);
  };

  while (row > 0 || col > 0) {
    if (row > 0 && col > 0 && before[row - 1] === after[col - 1]) {
      pushLine("equal", before[row - 1]);
      row -= 1;
      col -= 1;
      continue;
    }

    if (col > 0 && (row === 0 || lengths[row][col - 1] >= lengths[row - 1][col])) {
      pushLine("insert", after[col - 1]);
      col -= 1;
      continue;
    }

    pushLine("delete", before[row - 1]);
    row -= 1;
  }

  flush();
  return ops.reverse();
};

const countDiffLines = (
  ops: readonly DiffOp[],
  side: "old" | "new",
): number =>
  ops.reduce((count, op) => {
    if (side === "old" && op.tag !== "insert") {
      return count + op.lines.length;
    }

    if (side === "new" && op.tag !== "delete") {
      return count + op.lines.length;
    }

    return count;
  }, 0);

const appendDiffOps = (
  lines: string[],
  ops: readonly DiffOp[],
): number => {
  let emitted = 0;

  for (const op of ops) {
    for (const line of op.lines) {
      if (emitted >= MAX_DIFF_LINES) {
        lines.push("... (diff truncated)");
        return emitted;
      }

      const prefix =
        op.tag === "equal" ? " " : op.tag === "delete" ? "-" : "+";
      lines.push(`${prefix}${line}`);
      emitted += 1;
    }
  }

  return emitted;
};

const formatUnifiedDiff = (
  filePath: string,
  contentBefore: string,
  contentAfter: string,
): string => {
  const beforeLines = normalizeLineEndings(contentBefore).split("\n");
  const afterLines = normalizeLineEndings(contentAfter).split("\n");
  const { start, endBefore, endAfter } = firstDiffRange(beforeLines, afterLines);
  const lines: string[] = [`--- ${filePath}`, `+++ ${filePath}`];

  if (start > endBefore && start > endAfter) {
    return lines.join("\n");
  }

  const hunkStart = Math.max(0, start - CONTEXT_LINES);
  const hunkEndBefore = Math.min(beforeLines.length - 1, endBefore + CONTEXT_LINES);
  const hunkEndAfter = Math.min(afterLines.length - 1, endAfter + CONTEXT_LINES);
  const beforeSlice = beforeLines.slice(hunkStart, hunkEndBefore + 1);
  const afterSlice = afterLines.slice(hunkStart, hunkEndAfter + 1);
  const ops = diffLineArrays(beforeSlice, afterSlice);
  const oldCount = countDiffLines(ops, "old");
  const newCount = countDiffLines(ops, "new");

  lines.push(`@@ -${hunkStart + 1},${oldCount} +${hunkStart + 1},${newCount} @@`);

  appendDiffOps(lines, ops);

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

export const applyStringEdit = (
  content: string,
  edit: StringEdit,
): Effect.Effect<{ readonly content: string; readonly replacements: number }, EditError> =>
  Effect.gen(function* () {
    if (edit.old_string.length === 0) {
      return yield* Effect.fail(
        new EditError({
          message:
            "old_string cannot be empty when editing an existing file. Provide the exact text to replace, or use Write for a full-file replacement.",
        }),
      );
    }

    const ending = detectLineEnding(content);
    const oldNeedle = toFileNeedle(edit.old_string, ending);
    const newReplacement = toFileNeedle(edit.new_string, ending);
    const replacements = countOccurrences(content, oldNeedle);

    if (replacements === 0) {
      return yield* Effect.fail(
        new EditError({
          message:
            "Could not find old_string in the file. It must match exactly, including whitespace and indentation.",
        }),
      );
    }

    if (replacements > 1 && edit.replace_all !== true) {
      return yield* Effect.fail(
        new EditError({
          message:
            "Found multiple exact matches for old_string. Provide more surrounding context or set replace_all to true.",
        }),
      );
    }

    const nextContent =
      edit.replace_all === true
        ? content.replaceAll(oldNeedle, newReplacement)
        : content.replace(oldNeedle, newReplacement);

    return {
      content: nextContent,
      replacements: edit.replace_all === true ? replacements : 1,
    };
  });

export const editFile = (
  options: EditOptions,
): Effect.Effect<EditResult, EditError> =>
  Effect.gen(function* () {
    if (options.old_string.length === 0) {
      return yield* Effect.fail(
        new EditError({
          message:
            "old_string cannot be empty when editing an existing file. Provide the exact text to replace, or use Write for a full-file replacement.",
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

    const { content: nextContent, replacements } = yield* applyStringEdit(
      content,
      options,
    );

    yield* Effect.tryPromise({
      try: () => writeFile(filePath, nextContent, "utf-8"),
      catch: (cause) =>
        new EditError({
          message: `failed to write file "${filePath}": ${String(cause)}`,
        }),
    });

    return {
      path: filePath,
      replacements,
      contentBefore: content,
      contentAfter: nextContent,
    };
  });
