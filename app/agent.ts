import { Console, Effect } from "effect";
import {
  appendAssistantMessage,
  appendToolResult,
  startConversation,
  type Conversation,
} from "./conversation.ts";
import type { AppConfig } from "./config.ts";
import { createLlmClient, requestCompletion } from "./llm.ts";
import { decodeFunctionToolCall } from "./schemas.ts";
import { executeToolCall } from "./tools.ts";

const shouldStopLoop = (
  finishReason: string | null | undefined,
  toolCallCount: number,
): boolean => finishReason === "stop" || toolCallCount === 0;

const processToolCalls = (
  conversation: Conversation,
  rawToolCalls: ReadonlyArray<unknown>,
) =>
  Effect.gen(function* () {
    let nextConversation = conversation;

    for (const rawToolCall of rawToolCalls) {
      const toolCall = yield* decodeFunctionToolCall(rawToolCall);
      yield* Console.error(`Executing tool: ${toolCall.function.name}`);
      const result = yield* executeToolCall(toolCall);
      nextConversation = appendToolResult(
        nextConversation,
        toolCall.id,
        result,
      );
    }

    return nextConversation;
  });

export const runAgentLoop = (config: AppConfig, prompt: string) =>
  Effect.gen(function* () {
    const client = createLlmClient(config);
    let conversation = startConversation(prompt);

    while (true) {
      const { message, finishReason } = yield* requestCompletion(
        client,
        config,
        conversation,
      );
      conversation = appendAssistantMessage(conversation, message);

      const toolCalls = message.tool_calls ?? [];
      if (shouldStopLoop(finishReason, toolCalls.length)) {
        return message.content ?? "";
      }

      conversation = yield* processToolCalls(conversation, toolCalls);
    }
  });
