import { Effect, Schema } from "effect";
import { globFiles, type GlobResult } from "../glob.ts";
import { appendTruncationNotice, truncateForModel } from "../tool-limits.ts";
import { defineTool, mapToToolFailure } from "./tool.ts";

export const Input = Schema.Struct({
  pattern: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({
      description:
        'Glob pattern to match files (for example, "*.ts" or "**/*.ts")',
    }),
  ),
  path: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description:
          "Directory to search. Defaults to the current working directory.",
      }),
    ),
  ),
  limit: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.positive(),
      Schema.annotations({
        description: "Maximum number of file paths to return (default: 50)",
      }),
    ),
  ),
});

export type Input = typeof Input.Type;

const formatGlobOutput = (result: GlobResult): string => {
  if (result.files.length === 0) {
    return "No files found";
  }

  const lines = [...result.files];

  if (result.truncated) {
    appendTruncationNotice(
      lines,
      result.files.length,
      "files",
      "More matches may exist.",
    );
  }

  return truncateForModel(lines.join("\n"));
};

export const GlobTool = defineTool({
  name: "Glob",
  description: "Find files by glob pattern in a directory",
  input: Input,
  execute: (input) =>
    globFiles({
      pattern: input.pattern,
      searchPath: input.path,
      limit: input.limit,
    }).pipe(Effect.mapError(mapToToolFailure)),
  toModelOutput: ({ output }) => formatGlobOutput(output),
});
