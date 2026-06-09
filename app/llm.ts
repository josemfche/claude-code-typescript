import OpenAI from "openai";
import { Effect } from "effect";
import type { AppConfig } from "./config.ts";
import { CompletionFailed, EmptyCompletion } from "./errors.ts";
import { toolDefinitions } from "./tool-definitions.ts";

const createClient = (config: AppConfig) =>
  new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });

export type CompletionChoice = {
  readonly message: OpenAI.Chat.Completions.ChatCompletionMessage;
  readonly finishReason: OpenAI.Chat.Completions.ChatCompletion.Choice["finish_reason"];
};

export const requestCompletion = (
  config: AppConfig,
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
) =>
  Effect.gen(function* () {
    const client = createClient(config);
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
