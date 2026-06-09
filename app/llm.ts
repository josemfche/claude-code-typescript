import OpenAI from "openai";
import { Effect } from "effect";
import type { AssistantMessage } from "./domain.ts";
import type { AppConfig } from "./config.ts";
import { CompletionFailed, EmptyCompletion, type ProgramError } from "./errors.ts";
import { decodeFunctionToolCall } from "./schemas.ts";
import { toolDefinitions } from "./tool-definitions.ts";

const createClient = (config: AppConfig) =>
  new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });

const toDomainMessage = (
  message: OpenAI.Chat.Completions.ChatCompletionMessage,
): Effect.Effect<AssistantMessage, ProgramError> =>
  Effect.gen(function* () {
    const firstToolCall = message.tool_calls?.[0];
    if (firstToolCall) {
      const toolCall = yield* decodeFunctionToolCall(firstToolCall);
      return { _tag: "ToolCall", raw: toolCall };
    }

    return {
      _tag: "Text",
      content: message.content ?? "",
    };
  });

export const requestCompletion = (config: AppConfig, prompt: string) =>
  Effect.gen(function* () {
    const client = createClient(config);
    const response = yield* Effect.tryPromise({
      try: () =>
        client.chat.completions.create({
          model: config.model,
          messages: [{ role: "user", content: prompt }],
          tools: [...toolDefinitions],
        }),
      catch: (cause) => new CompletionFailed({ cause }),
    });

    const choice = response.choices?.[0];
    if (!choice) {
      return yield* Effect.fail(new EmptyCompletion());
    }

    return yield* toDomainMessage(choice.message);
  });
