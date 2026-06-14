import { access, writeFile } from "node:fs/promises";
import { Effect, Schema } from "effect";
import { resolveToolPath } from "../tool-path.ts";
import { defineTool, ToolFailure } from "./tool.ts";

export const Input = Schema.Struct({
  file_path: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({ description: "The path of the file to write to" }),
  ),
  content: Schema.String.pipe(
    Schema.annotations({ description: "The content to write to the file" }),
  ),
});

export type Input = typeof Input.Type;

export type Output = {
  readonly path: string;
  readonly existed: boolean;
};

const fileExists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );

export const WriteTool = defineTool({
  name: "Write",
  description: "Write content to a file",
  input: Input,
  execute: (input) =>
    Effect.gen(function* () {
      const filePath = resolveToolPath(input.file_path);

      const existed = yield* Effect.tryPromise({
        try: () => fileExists(filePath),
        catch: (cause) =>
          new ToolFailure({
            message: `failed to inspect file "${filePath}": ${String(cause)}`,
          }),
      });

      yield* Effect.tryPromise({
        try: () => writeFile(filePath, input.content, "utf-8"),
        catch: (cause) =>
          new ToolFailure({
            message: `failed to write file "${filePath}": ${String(cause)}`,
          }),
      });

      return { path: filePath, existed };
    }),
  toModelOutput: ({ output }) =>
    output.existed
      ? `Wrote file successfully: ${output.path}`
      : `Created file successfully: ${output.path}`,
});
