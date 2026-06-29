import { Effect, Schema } from "effect";
import { formatEditOutput } from "../edit.ts";
import { multiEditFile } from "../multi-edit.ts";
import { defineTool, mapToToolFailure } from "./tool.ts";

const EditEntry = Schema.Struct({
  old_string: Schema.String.pipe(
    Schema.annotations({ description: "Exact text to replace in the file" }),
  ),
  new_string: Schema.String.pipe(
    Schema.annotations({ description: "Replacement text" }),
  ),
  replace_all: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({
        description:
          "Replace all exact occurrences of old_string (default false)",
      }),
    ),
  ),
});

export const Input = Schema.Struct({
  file_path: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({ description: "The path of the file to edit" }),
  ),
  edits: Schema.Array(EditEntry).pipe(
    Schema.minItems(1),
    Schema.annotations({
      description:
        "Edits applied sequentially to the same file, in the given order",
    }),
  ),
});

export type Input = typeof Input.Type;

export const MultiEditTool = defineTool({
  name: "MultiEdit",
  description:
    "Apply multiple sequential string replacements to a single file in one atomic operation. Edits run in order, each operating on the result of the previous one. If any edit fails, the file is left unchanged.",
  input: Input,
  execute: (input) =>
    multiEditFile({
      file_path: input.file_path,
      edits: input.edits,
    }).pipe(Effect.mapError(mapToToolFailure)),
  toModelOutput: ({ output }) => formatEditOutput(output),
});
