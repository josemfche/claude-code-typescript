import { Effect, Schema } from "effect";
import { editFile, formatEditOutput } from "../edit.ts";
import { defineTool, ToolFailure } from "./tool.ts";

export const Input = Schema.Struct({
  file_path: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({ description: "The path of the file to edit" }),
  ),
  old_string: Schema.String.pipe(
    Schema.annotations({
      description: "Exact text to replace in the file",
    }),
  ),
  new_string: Schema.String.pipe(
    Schema.annotations({
      description: "Replacement text, which must differ from old_string",
    }),
  ),
  replace_all: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({
        description:
          "Replace all exact occurrences of old_string (default false)",
      }),
    ),
  ),
}).pipe(
  Schema.filter((input) => {
    if (input.old_string === input.new_string) {
      return {
        path: ["new_string"],
        message: "new_string must differ from old_string",
      };
    }

    return true;
  }),
);

export type Input = typeof Input.Type;

export const EditTool = defineTool({
  name: "Edit",
  description:
    "Replace an exact string in a file with new text. Use replace_all to change every occurrence.",
  input: Input,
  execute: (input) =>
    editFile({
      file_path: input.file_path,
      old_string: input.old_string,
      new_string: input.new_string,
      replace_all: input.replace_all,
    }).pipe(
      Effect.mapError(
        (error) => new ToolFailure({ message: error.message }),
      ),
    ),
  toModelOutput: ({ output }) => formatEditOutput(output),
});
