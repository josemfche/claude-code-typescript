import { Config, Context, Effect, Layer } from "effect";
import { MissingApiKey } from "./errors.ts";

export const AppConfigSchema = Config.all({
  apiKey: Config.string("OPENROUTER_API_KEY"),
  baseURL: Config.string("OPENROUTER_BASE_URL").pipe(
    Config.withDefault("https://openrouter.ai/api/v1"),
  ),
  model: Config.string("OPENROUTER_MODEL").pipe(
    Config.withDefault("anthropic/claude-haiku-4.5"),
  ),
});

export type AppConfig = Config.Config.Success<typeof AppConfigSchema>;

export class AppConfigService extends Context.Tag("AppConfigService")<
  AppConfigService,
  AppConfig
>() {}

export const AppConfigLive = Layer.effect(
  AppConfigService,
  AppConfigSchema.pipe(Effect.mapError(() => new MissingApiKey())),
);
