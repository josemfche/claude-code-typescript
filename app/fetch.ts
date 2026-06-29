import { Data, Effect } from "effect";

const MAX_BODY_CHARS = 100_000;
const DEFAULT_TIMEOUT_MS = 30_000;

export class FetchError extends Data.TaggedError("FetchError")<{
  readonly message: string;
}> {}

export type FetchMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD";

export type FetchOptions = {
  readonly url: string;
  readonly method?: FetchMethod | undefined;
  readonly headers?: Record<string, string> | undefined;
  readonly body?: string | undefined;
  readonly timeoutMs?: number | undefined;
};

export type FetchResult = {
  readonly url: string;
  readonly method: FetchMethod;
  readonly status: number;
  readonly statusText: string;
  readonly contentType: string | null;
  readonly body: string;
  readonly truncated: boolean;
};

export const fetchUrl = (
  options: FetchOptions,
): Effect.Effect<FetchResult, FetchError> =>
  Effect.gen(function* () {
    const method: FetchMethod = options.method ?? "GET";

    const parsed = yield* Effect.try({
      try: () => new URL(options.url),
      catch: () => new FetchError({ message: `invalid URL: ${options.url}` }),
    });

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return yield* Effect.fail(
        new FetchError({
          message: `unsupported URL protocol "${parsed.protocol}". Only http and https are allowed.`,
        }),
      );
    }

    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const response = yield* Effect.tryPromise({
      try: (signal) =>
        fetch(parsed, {
          method,
          headers: options.headers,
          body: options.body,
          // Abort on Effect interruption or when the timeout elapses.
          signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
        }),
      catch: (cause) =>
        new FetchError({ message: `request failed: ${String(cause)}` }),
    });

    const rawBody = yield* Effect.tryPromise({
      try: () => (method === "HEAD" ? Promise.resolve("") : response.text()),
      catch: (cause) =>
        new FetchError({
          message: `failed to read response body: ${String(cause)}`,
        }),
    });

    const truncated = rawBody.length > MAX_BODY_CHARS;

    return {
      url: parsed.toString(),
      method,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get("content-type"),
      body: truncated ? rawBody.slice(0, MAX_BODY_CHARS) : rawBody,
      truncated,
    };
  });
