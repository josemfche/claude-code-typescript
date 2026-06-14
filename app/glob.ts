import path from "node:path";
import { Data, Effect } from "effect";
import { collectFiles } from "./file-walk.ts";

const DEFAULT_LIMIT = 50;

export class GlobSearchError extends Data.TaggedError("GlobSearchError")<{
  readonly message: string;
}> {}

export type GlobResult = {
  readonly files: readonly string[];
  readonly truncated: boolean;
};

export type GlobOptions = {
  readonly pattern: string;
  readonly searchPath?: string | undefined;
  readonly limit?: number | undefined;
};

const escapeRegexChar = (char: string): string =>
  /[\\^$+?.()|{}[\]]/.test(char) ? `\\${char}` : char;

const globToRegExp = (glob: string): RegExp => {
  let regex = "";
  let index = 0;

  while (index < glob.length) {
    const char = glob[index];

    if (char === "*") {
      if (glob[index + 1] === "*") {
        if (glob[index + 2] === "/") {
          regex += "(?:.*/)?";
          index += 3;
          continue;
        }

        regex += ".*";
        index += 2;
        continue;
      }

      regex += "[^/]*";
      index += 1;
      continue;
    }

    if (char === "?") {
      regex += "[^/]";
      index += 1;
      continue;
    }

    if (char === "{") {
      const end = glob.indexOf("}", index + 1);
      if (end === -1) {
        regex += escapeRegexChar(char);
        index += 1;
        continue;
      }

      const alternatives = glob
        .slice(index + 1, end)
        .split(",")
        .map((part) => part.split("").map(escapeRegexChar).join(""));

      regex += `(?:${alternatives.join("|")})`;
      index = end + 1;
      continue;
    }

    regex += escapeRegexChar(char);
    index += 1;
  }

  return new RegExp(`^${regex}$`);
};

const compilePattern = (pattern: string) =>
  Effect.try({
    try: () => globToRegExp(pattern),
    catch: () =>
      new GlobSearchError({
        message: `invalid glob pattern: ${JSON.stringify(pattern)}`,
      }),
  });

const toRelativePath = (root: string, filePath: string): string =>
  path.relative(root, filePath).split(path.sep).join("/");

const matchesPattern = (
  pattern: RegExp,
  globPattern: string,
  root: string,
  filePath: string,
): boolean => {
  const relativePath = toRelativePath(root, filePath);

  if (pattern.test(relativePath)) {
    return true;
  }

  if (!globPattern.includes("/")) {
    return pattern.test(path.basename(filePath));
  }

  return false;
};

export const globFiles = (
  options: GlobOptions,
): Effect.Effect<GlobResult, GlobSearchError> =>
  Effect.gen(function* () {
    const pattern = yield* compilePattern(options.pattern);
    const limit = options.limit ?? DEFAULT_LIMIT;
    const root = path.resolve(
      process.cwd(),
      options.searchPath ?? ".",
    );

    const candidates = yield* Effect.tryPromise({
      try: () => collectFiles(root),
      catch: (cause) =>
        new GlobSearchError({
          message: `failed to search path "${root}": ${String(cause)}`,
        }),
    });

    const files: string[] = [];
    let truncated = false;

    for (const filePath of candidates) {
      if (files.length >= limit) {
        truncated = true;
        break;
      }

      if (matchesPattern(pattern, options.pattern, root, filePath)) {
        files.push(filePath);
      }
    }

    if (files.length >= limit) {
      truncated = true;
    }

    return {
      files: files.slice(0, limit),
      truncated,
    };
  });
