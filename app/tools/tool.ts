import { Data, Effect, JSONSchema, ParseResult, Schema } from "effect";
import type { FunctionToolCall, ToolName } from "../domain.ts";
import { formatParseError } from "../parse.ts";
import type { ToolDefinition } from "./definition.ts";

export class ToolFailure extends Data.TaggedError("ToolFailure")<{
  readonly message: string;
}> {}

export const mapToToolFailure = <E extends { readonly message: string }>(
  error: E,
): ToolFailure => new ToolFailure({ message: error.message });

const jsonSchemaMetaKeys = new Set(["$schema", "$defs"]);

const toOpenAiParameters = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(JSONSchema.make(schema)).filter(
      ([key]) => !jsonSchemaMetaKeys.has(key),
    ),
  );

export type ToolConfig<
  Input extends Schema.Schema.AnyNoContext,
  Output,
> = {
  readonly name: ToolName;
  readonly description: string;
  readonly input: Input;
  readonly execute: (
    input: Schema.Schema.Type<Input>,
  ) => Effect.Effect<Output, ToolFailure>;
  readonly toModelOutput: (result: {
    readonly input: Schema.Schema.Type<Input>;
    readonly output: Output;
  }) => string;
};

export type RegisteredTool = {
  readonly name: ToolName;
  readonly definition: ToolDefinition;
  readonly run: (toolCall: FunctionToolCall) => Effect.Effect<string>;
};

export const defineTool = <Input extends Schema.Schema.AnyNoContext, Output>(
  config: ToolConfig<Input, Output>,
): RegisteredTool => {
  const decodeInput = (argumentsJson: string) =>
    Effect.try({
      try: () => {
        const json: unknown = JSON.parse(argumentsJson);
        return Schema.decodeUnknownSync(config.input)(json);
      },
      catch: (error) => {
        if (ParseResult.isParseError(error)) {
          return new ToolFailure({
            message: `invalid tool arguments: ${formatParseError(error)}`,
          });
        }

        return new ToolFailure({
          message: `invalid tool arguments: ${String(error)}`,
        });
      },
    });

  const definition: ToolDefinition = {
    type: "function",
    function: {
      name: config.name,
      description: config.description,
      parameters: toOpenAiParameters(config.input),
    },
  };

  const run = (toolCall: FunctionToolCall): Effect.Effect<string> =>
    Effect.gen(function* () {
      const input = yield* decodeInput(toolCall.function.arguments);
      const output = yield* config.execute(input);
      return config.toModelOutput({ input, output });
    }).pipe(
      Effect.catchTag("ToolFailure", (failure) =>
        Effect.succeed(`error: ${failure.message}`),
      ),
    );

  return {
    name: config.name,
    definition,
    run,
  };
};

export const toolDefinitionsFrom = (
  tools: readonly RegisteredTool[],
): ToolDefinition[] => tools.map((tool) => tool.definition);
