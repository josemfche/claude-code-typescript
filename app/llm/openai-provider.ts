import OpenAI from "openai";
import { Context, Effect, Layer } from "effect";
import { AppConfigService } from "../config.ts";
import type {
  AssistantMessage,
  ChatMessage,
  Conversation,
  FinishReason,
  FunctionToolCall,
} from "../domain.ts";
import { CompletionFailed, EmptyCompletion } from "../errors.ts";
import {
  isAssistantMessage,
  isToolResultMessage,
  isUserMessage,
} from "../conversation.ts";
import { decodeFunctionToolCall } from "../schemas.ts";
import { toolDefinitions } from "../tool-definitions.ts";
import { LlmService, type LlmServiceApi } from "./service.ts";

const toProviderToolCall = (
  toolCall: FunctionToolCall,
): OpenAI.Chat.Completions.ChatCompletionMessageToolCall => ({
  id: toolCall.id,
  type: "function",
  function: {
    name: toolCall.function.name,
    arguments: toolCall.function.arguments,
  },
});

const toProviderMessage = (
  message: ChatMessage,
): OpenAI.Chat.Completions.ChatCompletionMessageParam => {
  if (isUserMessage(message)) {
    return { role: "user", content: message.content };
  }

  if (isAssistantMessage(message)) {
    return {
      role: "assistant",
      content: message.content,
      tool_calls: message.toolCalls.map(toProviderToolCall),
    };
  }

  if (isToolResultMessage(message)) {
    return {
      role: "tool",
      tool_call_id: message.toolCallId,
      content: message.content,
    };
  }

  return { role: "user", content: "" };
};

const toProviderMessages = (
  conversation: Conversation,
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] =>
  conversation.map(toProviderMessage);

const toAssistantMessage = (
  toolCalls: readonly FunctionToolCall[],
  content: string | null,
): AssistantMessage => ({
  role: "assistant",
  content,
  toolCalls,
});

const decodeAssistantToolCalls = (
  rawToolCalls: ReadonlyArray<unknown>,
) =>
  Effect.forEach(rawToolCalls, (raw) => decodeFunctionToolCall(raw), {
    concurrency: "unbounded",
  });

const toFinishReason = (
  reason: OpenAI.Chat.Completions.ChatCompletion.Choice["finish_reason"],
): FinishReason => reason ?? null;

const makeComplete =
  (client: OpenAI, model: string): LlmServiceApi["complete"] =>
  (conversation) =>
    Effect.gen(function* () {
      const response = yield* Effect.tryPromise({
        try: () =>
          client.chat.completions.create({
            model,
            messages: toProviderMessages(conversation),
            tools: [...toolDefinitions],
          }),
        catch: (cause) => new CompletionFailed({ cause }),
      });

      const choice = response.choices?.[0];
      if (!choice) {
        return yield* Effect.fail(new EmptyCompletion());
      }

      const toolCalls = yield* decodeAssistantToolCalls(
        choice.message.tool_calls ?? [],
      );

      return {
        assistant: toAssistantMessage(toolCalls, choice.message.content),
        finishReason: toFinishReason(choice.finish_reason),
      };
    });

export const OpenAiLlmLive = Layer.effect(
  LlmService,
  Effect.gen(function* () {
    const config = yield* AppConfigService;
    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });

    return {
      complete: makeComplete(client, config.model),
    } satisfies LlmServiceApi;
  }),
);
