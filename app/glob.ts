import path from "node:path";
import { Data, Effect } from "effect";
import { collectFilesWithMeta } from "./file-walk.ts";
import { DEFAULT_SEARCH_LIMIT } from "./tool-limits.ts";
import { resolveToolPath } from "./tool-path.ts";

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

export const globToRegExp = (glob: string): RegExp => {
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

const toRelativePath = (root: string, filePath: string): string =>
  path.relative(root, filePath).split(path.sep).join("/");

const matchTargets = (
  root: string,
  filePath: string,
  rootIsFile: boolean,
): readonly string[] => {
  const targets = new Set<string>();
  const relativeToRoot = toRelativePath(root, filePath);

  if (relativeToRoot.length > 0 && relativeToRoot !== ".") {
    targets.add(relativeToRoot);
  }

  targets.add(path.basename(filePath));

  if (rootIsFile) {
    const relativeToCwd = path
      .relative(process.cwd(), filePath)
      .split(path.sep)
      .join("/");

    if (relativeToCwd.length > 0) {
      targets.add(relativeToCwd);
    }
  }

  return [...targets];
};

export const matchesPattern = (
  pattern: RegExp,
  globPattern: string,
  root: string,
  filePath: string,
  rootIsFile: boolean,
): boolean => {
  const targets = matchTargets(root, filePath, rootIsFile);

  for (const target of targets) {
    if (pattern.test(target)) {
      return true;
    }
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
    let pattern: RegExp;

    try {
      pattern = globToRegExp(options.pattern);
    } catch {
      return yield* Effect.fail(
        new GlobSearchError({
          message: `invalid glob pattern: ${JSON.stringify(options.pattern)}`,
        }),
      );
    }

    const limit = options.limit ?? DEFAULT_SEARCH_LIMIT;
    const root = resolveToolPath(options.searchPath ?? ".");

    const collected = yield* Effect.tryPromise({
      try: () => collectFilesWithMeta(root),
      catch: (cause) =>
        new GlobSearchError({
          message: `failed to search path "${root}": ${String(cause)}`,
        }),
    });

    const files: string[] = [];
    let truncated = false;

    for (const filePath of collected.files) {
      if (!matchesPattern(
        pattern,
        options.pattern,
        root,
        filePath,
        collected.rootIsFile,
      )) {
        continue;
      }

      if (files.length >= limit) {
        truncated = true;
        break;
      }

      files.push(filePath);
    }

    return { files, truncated };
  });
