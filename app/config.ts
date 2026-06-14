import { Config, ConfigError, Context, Effect, Layer } from "effect";
import { ConfigFailed, MissingApiKey } from "./errors.ts";

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

const formatConfigError = (error: ConfigError.ConfigError): string =>
  ConfigError.reduceWithContext(error, void 0, {
    andCase: (_context, left, right) => `${left}; ${right}`,
    orCase: (_context, left, right) => `${left} or ${right}`,
    invalidDataCase: (_context, path, message) =>
      `invalid config at ${path.join(".")}: ${message}`,
    missingDataCase: (_context, path, message) =>
      `missing config at ${path.join(".")}: ${message}`,
    sourceUnavailableCase: (_context, path, message) =>
      `config source unavailable at ${path.join(".")}: ${message}`,
    unsupportedCase: (_context, path, message) =>
      `unsupported config at ${path.join(".")}: ${message}`,
  });

const mapConfigError = (error: ConfigError.ConfigError) => {
  const reason = formatConfigError(error);

  if (reason.includes("OPENROUTER_API_KEY")) {
    return new MissingApiKey();
  }

  return new ConfigFailed({ reason });
};

export const AppConfigLive = Layer.effect(
  AppConfigService,
  Effect.gen(function* () {
    return yield* AppConfigSchema;
  }).pipe(Effect.mapError(mapConfigError)),
);
