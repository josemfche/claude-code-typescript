import { Effect, Schema } from "effect";
import { formatListDirOutput, listDir } from "../ls.ts";
import { truncateForModel } from "../tool-limits.ts";
import { defineTool, mapToToolFailure } from "./tool.ts";

export const Input = Schema.Struct({
  path: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description:
          "Directory to list. Defaults to the current working directory.",
      }),
    ),
  ),
  limit: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.positive(),
      Schema.annotations({
        description: "Maximum number of entries to return (default: 50)",
      }),
    ),
  ),
});

export type Input = typeof Input.Type;

export const LsTool = defineTool({
  name: "Ls",
  description: "List files and directories at a path",
  input: Input,
  execute: (input) =>
    listDir({
      searchPath: input.path,
      limit: input.limit,
    }).pipe(Effect.mapError(mapToToolFailure)),
  toModelOutput: ({ output }) => truncateForModel(formatListDirOutput(output)),
});
