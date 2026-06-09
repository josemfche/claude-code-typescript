import { readFile } from "node:fs/promises";
import { Effect } from "effect";
import type { AssistantMessage } from "./domain.ts";
import { FileReadFailed, type ProgramError } from "./errors.ts";
import {
  decodeReadToolArgs,
  decodeToolName,
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

const toolExecutors: Record<ToolName, ToolExecutor> = {
  Read: executeReadTool,
};

const dispatchToolCall = (toolCall: FunctionToolCall, name: ToolName) =>
  toolExecutors[name](toolCall);

export const executeToolCall = (toolCall: FunctionToolCall) =>
  Effect.gen(function* () {
    const name = yield* decodeToolName(toolCall.function.name);
    return yield* dispatchToolCall(toolCall, name);
  });

export const handleAssistantMessage = (message: AssistantMessage) =>
  Effect.gen(function* () {
    switch (message._tag) {
      case "Text":
        return message.content;
      case "ToolCall":
        return yield* executeToolCall(message.raw);
    }
  });
