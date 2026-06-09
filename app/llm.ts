import OpenAI from "openai";
import { Effect } from "effect";
import type { Conversation } from "./conversation.ts";
import type { AppConfig } from "./config.ts";
import { CompletionFailed, EmptyCompletion } from "./errors.ts";
import { toolDefinitions } from "./tool-definitions.ts";

export type LlmClient = OpenAI;

export const createLlmClient = (config: AppConfig): LlmClient =>
  new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });

export type CompletionChoice = {
  readonly message: OpenAI.Chat.Completions.ChatCompletionMessage;
  readonly finishReason: OpenAI.Chat.Completions.ChatCompletion.Choice["finish_reason"];
};

export const requestCompletion = (
  client: LlmClient,
  config: AppConfig,
  messages: Conversation,
) =>
  Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: () =>
        client.chat.completions.create({
          model: config.model,
          messages,
          tools: [...toolDefinitions],
        }),
      catch: (cause) => new CompletionFailed({ cause }),
    });

    const choice = response.choices?.[0];
    if (!choice) {
      return yield* Effect.fail(new EmptyCompletion());
    }

    return {
      message: choice.message,
      finishReason: choice.finish_reason,
    } satisfies CompletionChoice;
  });
