import { readdir, stat } from "node:fs/promises";
import { Data, Effect } from "effect";
import { appendTruncationNotice, DEFAULT_SEARCH_LIMIT } from "./tool-limits.ts";
import { resolveSearchPath } from "./tool-path.ts";

export class ListDirError extends Data.TaggedError("ListDirError")<{
  readonly message: string;
}> {}

export type ListDirEntry = {
  readonly name: string;
  readonly kind: "file" | "directory";
};

export type ListDirResult = {
  readonly path: string;
  readonly entries: readonly ListDirEntry[];
  readonly truncated: boolean;
};

export type ListDirOptions = {
  readonly searchPath?: string | undefined;
  readonly limit?: number | undefined;
};

export const formatListDirOutput = (result: ListDirResult): string => {
  if (result.entries.length === 0) {
    return `${result.path}:\n(empty directory)`;
  }

  const lines = [`${result.path}:`];

  for (const entry of result.entries) {
    lines.push(entry.kind === "directory" ? `${entry.name}/` : entry.name);
  }

  if (result.truncated) {
    appendTruncationNotice(
      lines,
      result.entries.length,
      "entries",
      "Use a higher limit if needed.",
    );
  }

  return lines.join("\n");
};

export const listDir = (
  options: ListDirOptions,
): Effect.Effect<ListDirResult, ListDirError> =>
  Effect.gen(function* () {
    const limit = options.limit ?? DEFAULT_SEARCH_LIMIT;
    const directory = resolveSearchPath(options.searchPath);

    const info = yield* Effect.tryPromise({
      try: () => stat(directory),
      catch: (cause) =>
        new ListDirError({
          message: `failed to inspect path "${directory}": ${String(cause)}`,
        }),
    });

    if (!info.isDirectory()) {
      return yield* Effect.fail(
        new ListDirError({
          message: `path is not a directory: ${directory}`,
        }),
      );
    }

    const dirents = yield* Effect.tryPromise({
      try: () => readdir(directory, { withFileTypes: true }),
      catch: (cause) =>
        new ListDirError({
          message: `failed to list directory "${directory}": ${String(cause)}`,
        }),
    });

    const sorted = [...dirents].sort((left, right) =>
      left.name.localeCompare(right.name),
    );
    const entries: ListDirEntry[] = [];
    let truncated = false;

    for (const dirent of sorted) {
      if (entries.length >= limit) {
        truncated = true;
        break;
      }

      entries.push({
        name: dirent.name,
        kind: dirent.isDirectory() ? "directory" : "file",
      });
    }

    return { path: directory, entries, truncated };
  });
