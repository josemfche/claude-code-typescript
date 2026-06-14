import { readFile, writeFile } from "node:fs/promises";
import { Data, Effect } from "effect";

export class EditError extends Data.TaggedError("EditError")<{
  readonly message: string;
}> {}

export type EditResult = {
  readonly path: string;
  readonly replacements: number;
};

export type EditOptions = {
  readonly file_path: string;
  readonly old_string: string;
  readonly new_string: string;
  readonly replace_all?: boolean | undefined;
};

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

const previewLines = (text: string, prefix: string): string[] =>
  text.split("\n").map((line) => `${prefix}${line}`);

export const formatEditOutput = (result: EditResult, oldString: string, newString: string): string =>
  [
    `Edited file successfully: ${result.path}`,
    `Replacements: ${result.replacements}`,
    "```diff",
    ...previewLines(oldString, "-"),
    ...previewLines(newString, "+"),
    "```",
  ].join("\n");

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

    const content = yield* Effect.tryPromise({
      try: () => readFile(options.file_path, "utf-8"),
      catch: (cause) =>
        new EditError({
          message: `failed to read file "${options.file_path}": ${String(cause)}`,
        }),
    });

    const replacements = countOccurrences(content, options.old_string);

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
        ? content.replaceAll(options.old_string, options.new_string)
        : content.replace(options.old_string, options.new_string);

    yield* Effect.tryPromise({
      try: () => writeFile(options.file_path, nextContent, "utf-8"),
      catch: (cause) =>
        new EditError({
          message: `failed to write file "${options.file_path}": ${String(cause)}`,
        }),
    });

    return {
      path: options.file_path,
      replacements: options.replace_all === true ? replacements : 1,
    };
  });
