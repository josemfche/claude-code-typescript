import { readFile, writeFile } from "node:fs/promises";
import { Effect } from "effect";
import {
  applyStringEdit,
  EditError,
  type EditResult,
  type StringEdit,
} from "./edit.ts";
import { resolveToolPath } from "./tool-path.ts";

export type MultiEditOptions = {
  readonly file_path: string;
  readonly edits: ReadonlyArray<StringEdit>;
};

export const multiEditFile = (
  options: MultiEditOptions,
): Effect.Effect<EditResult, EditError> =>
  Effect.gen(function* () {
    if (options.edits.length === 0) {
      return yield* Effect.fail(
        new EditError({ message: "edits must contain at least one edit." }),
      );
    }

    const filePath = resolveToolPath(options.file_path);

    const original = yield* Effect.tryPromise({
      try: () => readFile(filePath, "utf-8"),
      catch: (cause) =>
        new EditError({
          message: `failed to read file "${filePath}": ${String(cause)}`,
        }),
    });

    let current = original;
    let totalReplacements = 0;

    // Apply every edit in-memory first; only persist once all succeed so a
    // failing edit leaves the file untouched.
    for (let index = 0; index < options.edits.length; index += 1) {
      const applied = yield* applyStringEdit(current, options.edits[index]).pipe(
        Effect.mapError(
          (error) =>
            new EditError({ message: `edit #${index + 1}: ${error.message}` }),
        ),
      );

      current = applied.content;
      totalReplacements += applied.replacements;
    }

    yield* Effect.tryPromise({
      try: () => writeFile(filePath, current, "utf-8"),
      catch: (cause) =>
        new EditError({
          message: `failed to write file "${filePath}": ${String(cause)}`,
        }),
    });

    return {
      path: filePath,
      replacements: totalReplacements,
      contentBefore: original,
      contentAfter: current,
    };
  });
