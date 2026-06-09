import { Effect, ParseResult, Schema } from "effect";
import type { FunctionToolCall as FunctionToolCallType } from "./domain.ts";
import { InvalidCliArgs, InvalidToolCall } from "./errors.ts";

export const CliArgs = Schema.Struct({
  flag: Schema.Literal("-p"),
  prompt: Schema.String.pipe(Schema.minLength(1)),
});

export type CliArgs = typeof CliArgs.Type;

export const ReadToolArgs = Schema.Struct({
  file_path: Schema.String.pipe(Schema.minLength(1)),
});

export type ReadToolArgs = typeof ReadToolArgs.Type;

export const WriteToolArgs = Schema.Struct({
  file_path: Schema.String.pipe(Schema.minLength(1)),
  content: Schema.String,
});

export type WriteToolArgs = typeof WriteToolArgs.Type;

export const ToolName = Schema.Literal("Read", "Write");

export type ToolName = typeof ToolName.Type;

export const FunctionToolCallSchema = Schema.Struct({
  id: Schema.String,
  type: Schema.Literal("function"),
  function: Schema.Struct({
    name: Schema.String,
    arguments: Schema.String,
  }),
}) satisfies Schema.Schema<FunctionToolCallType>;

export type FunctionToolCall = FunctionToolCallType;

const formatParseError = (error: ParseResult.ParseError): string =>
  ParseResult.TreeFormatter.formatErrorSync(error);

export const decodeCliArgs = (
  flag: string | undefined,
  prompt: string | undefined,
) =>
  Schema.decodeUnknown(CliArgs)({ flag, prompt }).pipe(
    Effect.mapError(
      (error) =>
        new InvalidCliArgs({
          reason:
            flag !== "-p" || !prompt
              ? "error: -p flag is required"
              : formatParseError(error),
        }),
    ),
  );

export const decodeFunctionToolCall = (raw: unknown) =>
  Schema.decodeUnknown(FunctionToolCallSchema)(raw).pipe(
    Effect.mapError(
      (error) => new InvalidToolCall({ reason: formatParseError(error) }),
    ),
  );

export const decodeToolName = (name: string) =>
  Schema.decodeUnknown(ToolName)(name).pipe(
    Effect.mapError(
      (error) => new InvalidToolCall({ reason: formatParseError(error) }),
    ),
  );

export const decodeReadToolArgs = (argumentsJson: string) =>
  Schema.decodeUnknown(Schema.parseJson(ReadToolArgs))(argumentsJson).pipe(
    Effect.mapError(
      (error) => new InvalidToolCall({ reason: formatParseError(error) }),
    ),
  );

export const decodeWriteToolArgs = (argumentsJson: string) =>
  Schema.decodeUnknown(Schema.parseJson(WriteToolArgs))(argumentsJson).pipe(
    Effect.mapError(
      (error) => new InvalidToolCall({ reason: formatParseError(error) }),
    ),
  );
