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

export const AppConfigLive = Layer.effect(
  AppConfigService,
  Effect.gen(function* () {
    const apiKey = yield* Config.string("OPENROUTER_API_KEY").pipe(
      Effect.mapError(() => new MissingApiKey()),
    );

    const rest = yield* Config.all({
      baseURL: Config.string("OPENROUTER_BASE_URL").pipe(
        Config.withDefault("https://openrouter.ai/api/v1"),
      ),
      model: Config.string("OPENROUTER_MODEL").pipe(
        Config.withDefault("anthropic/claude-haiku-4.5"),
      ),
    }).pipe(
      Effect.mapError(
        (error) => new ConfigFailed({ reason: formatConfigError(error) }),
      ),
    );

    return { apiKey, ...rest };
  }),
);
