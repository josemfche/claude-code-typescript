import { readFile, writeFile } from "node:fs/promises";
import { Effect } from "effect";
import {
  FileReadFailed,
  FileWriteFailed,
  type ProgramError,
} from "./errors.ts";
import {
  decodeReadToolArgs,
  decodeToolName,
  decodeWriteToolArgs,
  type FunctionToolCall,
  type ToolName,
} from "./schemas.ts";

type ToolExecutor = (
  toolCall: FunctionToolCall,
) => Effect.Effect<string, ProgramError>;

const executeReadTool = (toolCall: FunctionToolCall) =>
  Effect.gen(function* () {
    const args = yield* decodeReadToolArgs(toolCall.function.arguments);
    return yield* Effect.tryPromise({
      try: () => readFile(args.file_path, "utf-8"),
      catch: (cause) =>
        new FileReadFailed({ path: args.file_path, cause }),
    });
  });

const executeWriteTool = (toolCall: FunctionToolCall) =>
  Effect.gen(function* () {
    const args = yield* decodeWriteToolArgs(toolCall.function.arguments);
    yield* Effect.tryPromise({
      try: () => writeFile(args.file_path, args.content, "utf-8"),
      catch: (cause) =>
        new FileWriteFailed({ path: args.file_path, cause }),
    });
    return `Successfully wrote to ${args.file_path}`;
  });

const toolExecutors: Record<ToolName, ToolExecutor> = {
  Read: executeReadTool,
  Write: executeWriteTool,
};

const dispatchToolCall = (toolCall: FunctionToolCall, name: ToolName) =>
  toolExecutors[name](toolCall);

export const executeToolCall = (toolCall: FunctionToolCall) =>
  Effect.gen(function* () {
    const name = yield* decodeToolName(toolCall.function.name);
    return yield* dispatchToolCall(toolCall, name);
  });
