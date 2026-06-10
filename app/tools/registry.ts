import { readFile, writeFile } from "node:fs/promises";
import { Context, Effect, Layer } from "effect";
import type { ToolName } from "../domain.ts";
import type { FunctionToolCall } from "../domain.ts";
import { runShellCommand } from "../bash.ts";
import {
  BashExecutionFailed,
  FileReadFailed,
  FileWriteFailed,
  type ProgramError,
} from "../errors.ts";
import {
  decodeBashToolArgs,
  decodeReadToolArgs,
  decodeToolName,
  decodeWriteToolArgs,
} from "../schemas.ts";

export type ToolRegistryApi = {
  readonly execute: (
    toolCall: FunctionToolCall,
  ) => Effect.Effect<string, ProgramError>;
};

export class ToolRegistry extends Context.Tag("ToolRegistry")<
  ToolRegistry,
  ToolRegistryApi
>() {}

type ToolExecutor = (
  toolCall: FunctionToolCall,
) => Effect.Effect<string, ProgramError>;

const executeReadTool: ToolExecutor = (toolCall) =>
  Effect.gen(function* () {
    const args = yield* decodeReadToolArgs(toolCall.function.arguments);
    return yield* Effect.tryPromise({
      try: () => readFile(args.file_path, "utf-8"),
      catch: (cause) =>
        new FileReadFailed({ path: args.file_path, cause }),
    });
  });

const executeWriteTool: ToolExecutor = (toolCall) =>
  Effect.gen(function* () {
    const args = yield* decodeWriteToolArgs(toolCall.function.arguments);
    yield* Effect.tryPromise({
      try: () => writeFile(args.file_path, args.content, "utf-8"),
      catch: (cause) =>
        new FileWriteFailed({ path: args.file_path, cause }),
    });
    return `Successfully wrote to ${args.file_path}`;
  });

const executeBashTool: ToolExecutor = (toolCall) =>
  Effect.gen(function* () {
    const args = yield* decodeBashToolArgs(toolCall.function.arguments);
    return yield* runShellCommand(args.command).pipe(
      Effect.mapError(
        (cause) =>
          new BashExecutionFailed({ command: args.command, cause }),
      ),
    );
  });

const toolExecutors: Record<ToolName, ToolExecutor> = {
  Read: executeReadTool,
  Write: executeWriteTool,
  Bash: executeBashTool,
};

const dispatchToolCall = (toolCall: FunctionToolCall, name: ToolName) =>
  toolExecutors[name](toolCall);

const executeToolCall = (toolCall: FunctionToolCall) =>
  Effect.gen(function* () {
    const name = yield* decodeToolName(toolCall.function.name);
    return yield* dispatchToolCall(toolCall, name);
  });

export const ToolRegistryLive = Layer.succeed(ToolRegistry, {
  execute: executeToolCall,
});
