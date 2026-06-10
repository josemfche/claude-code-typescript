import { readFile } from "node:fs/promises";
import { Effect, Schema } from "effect";
import { defineTool, ToolFailure } from "./tool.ts";

const MAX_MODEL_CHARS = 8_000;

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

const truncateForModel = (content: string): string => {
  if (content.length <= MAX_MODEL_CHARS) {
    return content;
  }

  const omitted = content.length - MAX_MODEL_CHARS;
  return `${content.slice(0, MAX_MODEL_CHARS)}\n\n[truncated ${omitted} characters]`;
};

export const ReadTool = defineTool({
  name: "Read",
  description: "Read and return the contents of a file",
  input: Input,
  execute: (input) =>
    Effect.tryPromise({
      try: () => readFile(input.file_path, "utf-8"),
      catch: (cause) =>
        new ToolFailure({
          message: `failed to read file "${input.file_path}": ${String(cause)}`,
        }),
    }).pipe(Effect.map((content) => ({ path: input.file_path, content }))),
  toModelOutput: ({ output }) => truncateForModel(output.content),
});
