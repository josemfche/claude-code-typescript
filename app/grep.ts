import { readFile } from "node:fs/promises";
import path from "node:path";
import { Data, Effect } from "effect";
import { collectFiles } from "./file-walk.ts";

const DEFAULT_LIMIT = 50;

export class GrepSearchError extends Data.TaggedError("GrepSearchError")<{
  readonly message: string;
}> {}

export type GrepMatch = {
  readonly file: string;
  readonly line: number;
  readonly text: string;
};

export type GrepResult = {
  readonly matches: readonly GrepMatch[];
  readonly truncated: boolean;
};

export type GrepOptions = {
  readonly pattern: string;
  readonly searchPath?: string | undefined;
  readonly limit?: number | undefined;
};

const compilePattern = (pattern: string) =>
  Effect.try({
    try: () => {
      const regex = new RegExp(pattern);
      return new RegExp(regex.source, regex.flags.replaceAll("g", ""));
    },
    catch: () =>
      new GrepSearchError({
        message: `invalid grep pattern: ${JSON.stringify(pattern)}`,
      }),
  });

const searchFile = async (
  filePath: string,
  pattern: RegExp,
  remaining: number,
): Promise<{ readonly matches: GrepMatch[]; readonly consumed: number }> => {
  const content = await readFile(filePath, "utf-8");
  const lines = content.split("\n");
  const matches: GrepMatch[] = [];

  for (const [index, text] of lines.entries()) {
    if (matches.length >= remaining) {
      break;
    }

    if (pattern.test(text)) {
      matches.push({
        file: filePath,
        line: index + 1,
        text,
      });
    }
  }

  return { matches, consumed: matches.length };
};

const trySearchFile = async (
  filePath: string,
  pattern: RegExp,
  remaining: number,
): Promise<readonly GrepMatch[]> => {
  try {
    const result = await searchFile(filePath, pattern, remaining);
    return result.matches;
  } catch {
    return [];
  }
};

export const grepFiles = (
  options: GrepOptions,
): Effect.Effect<GrepResult, GrepSearchError> =>
  Effect.gen(function* () {
    const pattern = yield* compilePattern(options.pattern);
    const limit = options.limit ?? DEFAULT_LIMIT;
    const root = path.resolve(
      process.cwd(),
      options.searchPath ?? ".",
    );

    const files = yield* Effect.tryPromise({
      try: () => collectFiles(root),
      catch: (cause) =>
        new GrepSearchError({
          message: `failed to search path "${root}": ${String(cause)}`,
        }),
    });

    const matches: GrepMatch[] = [];
    let truncated = false;

    for (const filePath of files) {
      if (matches.length >= limit) {
        truncated = true;
        break;
      }

      const fileMatches = yield* Effect.promise(() =>
        trySearchFile(filePath, pattern, limit - matches.length),
      );

      matches.push(...fileMatches);

      if (matches.length >= limit) {
        truncated = true;
        break;
      }
    }

    return { matches, truncated };
  });
