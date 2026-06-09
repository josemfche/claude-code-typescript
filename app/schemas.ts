import { Effect, ParseResult, Schema } from "effect";
import type { FunctionToolCall as FunctionToolCallType } from "./domain.ts";
import { toolNames } from "./domain.ts";
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

export const BashToolArgs = Schema.Struct({
  command: Schema.String.pipe(Schema.minLength(1)),
});

export type BashToolArgs = typeof BashToolArgs.Type;

export const ToolNameSchema = Schema.Literal(
  toolNames[0],
  toolNames[1],
  toolNames[2],
);

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

const decodeToolArgs =
  <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  (argumentsJson: string) =>
    Schema.decodeUnknown(Schema.parseJson(schema))(argumentsJson).pipe(
      Effect.mapError(
        (error) => new InvalidToolCall({ reason: formatParseError(error) }),
      ),
    );

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
  Schema.decodeUnknown(ToolNameSchema)(name).pipe(
    Effect.mapError(
      (error) => new InvalidToolCall({ reason: formatParseError(error) }),
    ),
  );

export const decodeReadToolArgs = decodeToolArgs(ReadToolArgs);
export const decodeWriteToolArgs = decodeToolArgs(WriteToolArgs);
export const decodeBashToolArgs = decodeToolArgs(BashToolArgs);
