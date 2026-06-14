import { Effect, Schema } from "effect";
import { grepFiles, type GrepResult } from "../grep.ts";
import { appendTruncationNotice, truncateForModel } from "../tool-limits.ts";
import { defineTool, mapToToolFailure } from "./tool.ts";

export const Input = Schema.Struct({
  pattern: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({
      description: "Regular expression pattern to search for in file contents",
    }),
  ),
  path: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description:
          "File or directory to search. Defaults to the current working directory.",
      }),
    ),
  ),
  limit: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.positive(),
      Schema.annotations({
        description: "Maximum number of matching lines to return (default: 50)",
      }),
    ),
  ),
});

export type Input = typeof Input.Type;

const unreadableFiles = (count: number): string =>
  `${count} unreadable file${count === 1 ? "" : "s"}`;

const formatGrepOutput = (result: GrepResult): string => {
  if (result.matches.length === 0) {
    if (result.skippedFiles > 0) {
      return `No matches found (${unreadableFiles(result.skippedFiles)} skipped)`;
    }

    return "No matches found";
  }

  const lines: string[] = [`Found ${result.matches.length} matches`];
  let currentFile = "";

  for (const match of result.matches) {
    if (currentFile !== match.file) {
      if (currentFile) {
        lines.push("");
      }

      currentFile = match.file;
      lines.push(`${match.file}:`);
    }

    lines.push(`  Line ${match.line}: ${match.text}`);
  }

  if (result.truncated) {
    appendTruncationNotice(
      lines,
      result.matches.length,
      "matches",
      "Use a more specific path or pattern.",
    );
  }

  if (result.skippedFiles > 0) {
    lines.push("", `(Skipped ${unreadableFiles(result.skippedFiles)}.)`);
  }

  return truncateForModel(lines.join("\n"));
};

export const GrepTool = defineTool({
  name: "Grep",
  description:
    "Search file contents by regular expression in a file or directory",
  input: Input,
  execute: (input) =>
    grepFiles({
      pattern: input.pattern,
      searchPath: input.path,
      limit: input.limit,
    }).pipe(Effect.mapError(mapToToolFailure)),
  toModelOutput: ({ output }) => formatGrepOutput(output),
});
