import { Config, Effect } from "effect";
import { MissingApiKey } from "./errors.ts";

export const AppConfig = Config.all({
  apiKey: Config.string("OPENROUTER_API_KEY"),
  baseURL: Config.string("OPENROUTER_BASE_URL").pipe(
    Config.withDefault("https://openrouter.ai/api/v1"),
  ),
  model: Config.string("OPENROUTER_MODEL").pipe(
    // Config.withDefault("tencent/hy3-preview"),
    Config.withDefault("anthropic/claude-haiku-4.5"),
  ),
});

export type AppConfig = Config.Config.Success<typeof AppConfig>;

export const loadAppConfig = AppConfig.pipe(
  Effect.mapError(() => new MissingApiKey()),
);
