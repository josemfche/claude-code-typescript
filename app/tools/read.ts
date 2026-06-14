import { readFile } from "node:fs/promises";
import { Effect, Schema } from "effect";
import { resolveToolPath } from "../tool-path.ts";
import { truncateForModel } from "../tool-limits.ts";
import { defineTool, ToolFailure } from "./tool.ts";

export const Input = Schema.Struct({
  file_path: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({ description: "The path to the file to read" }),
  ),
});

export type Input = typeof Input.Type;

export type Output = {
  readonly path: string;
  readonly content: string;
};

export const ReadTool = defineTool({
  name: "Read",
  description: "Read and return the contents of a file",
  input: Input,
  execute: (input) => {
    const filePath = resolveToolPath(input.file_path);

    return Effect.tryPromise({
      try: () => readFile(filePath, "utf-8"),
      catch: (cause) =>
        new ToolFailure({
          message: `failed to read file "${filePath}": ${String(cause)}`,
        }),
    }).pipe(Effect.map((content) => ({ path: filePath, content })));
  },
  toModelOutput: ({ output }) => truncateForModel(output.content),
});
