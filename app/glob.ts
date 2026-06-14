import path from "node:path";
import { Data, Effect } from "effect";
import { collectFilesWithMeta } from "./file-walk.ts";
import { DEFAULT_SEARCH_LIMIT } from "./tool-limits.ts";
import { resolveSearchPath } from "./tool-path.ts";

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
  const parts: string[] = [];
  let index = 0;

  while (index < glob.length) {
    const char = glob[index];

    if (char === "*") {
      if (glob[index + 1] === "*") {
        if (glob[index + 2] === "/") {
          parts.push("(?:.*/)?");
          index += 3;
          continue;
        }

        parts.push(".*");
        index += 2;
        continue;
      }

      parts.push("[^/]*");
      index += 1;
      continue;
    }

    if (char === "?") {
      parts.push("[^/]");
      index += 1;
      continue;
    }

    if (char === "{") {
      const end = glob.indexOf("}", index + 1);
      if (end === -1) {
        parts.push(escapeRegexChar(char));
        index += 1;
        continue;
      }

      const alternatives = glob
        .slice(index + 1, end)
        .split(",")
        .map((part) => part.split("").map(escapeRegexChar).join(""));

      parts.push(`(?:${alternatives.join("|")})`);
      index = end + 1;
      continue;
    }

    parts.push(escapeRegexChar(char));
    index += 1;
  }

  return new RegExp(`^${parts.join("")}$`);
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
  root: string,
  filePath: string,
  rootIsFile: boolean,
): boolean =>
  matchTargets(root, filePath, rootIsFile).some((target) => pattern.test(target));

export const globFiles = (
  options: GlobOptions,
): Effect.Effect<GlobResult, GlobSearchError> =>
  Effect.gen(function* () {
    const pattern = globToRegExp(options.pattern);
    const limit = options.limit ?? DEFAULT_SEARCH_LIMIT;
    const root = resolveSearchPath(options.searchPath);

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
      if (!matchesPattern(pattern, root, filePath, collected.rootIsFile)) {
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
