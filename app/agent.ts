import type OpenAI from "openai";
import { Console, Effect } from "effect";
import type { AppConfig } from "./config.ts";
import { requestCompletion } from "./llm.ts";
import { decodeFunctionToolCall } from "./schemas.ts";
import { executeToolCall } from "./tools.ts";

const toAssistantMessageParam = (
  message: OpenAI.Chat.Completions.ChatCompletionMessage,
): OpenAI.Chat.Completions.ChatCompletionMessageParam => ({
  role: "assistant",
  content: message.content,
  tool_calls: message.tool_calls,
  refusal: message.refusal,
});

export const runAgentLoop = (config: AppConfig, prompt: string) =>
  Effect.gen(function* () {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "user", content: prompt },
    ];

    while (true) {
      const { message, finishReason } = yield* requestCompletion(config, messages);
      messages.push(toAssistantMessageParam(message));

      if (finishReason === "stop" || !message.tool_calls?.length) {
        return message.content ?? "";
      }

      for (const rawToolCall of message.tool_calls) {
        const toolCall = yield* decodeFunctionToolCall(rawToolCall);
        yield* Console.error(`Executing tool: ${toolCall.function.name}`);
        const result = yield* executeToolCall(toolCall);
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        });
      }
    }
  });
