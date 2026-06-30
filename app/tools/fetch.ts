import { Effect, Schema } from "effect";
import { type FetchResult, fetchUrl } from "../fetch.ts";
import { truncateForModel } from "../tool-limits.ts";
import { defineTool, mapToToolFailure } from "./tool.ts";

export const Input = Schema.Struct({
  url: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({ description: "The absolute http(s) URL to request" }),
  ),
  method: Schema.optional(
    Schema.Literal("GET", "POST", "PUT", "PATCH", "DELETE", "HEAD").pipe(
      Schema.annotations({ description: "HTTP method (default GET)" }),
    ),
  ),
  headers: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.String }).pipe(
      Schema.annotations({ description: "Optional request headers" }),
    ),
  ),
  body: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description: "Optional request body (for POST/PUT/PATCH)",
      }),
    ),
  ),
});

export type Input = typeof Input.Type;

const formatFetchOutput = (result: FetchResult): string => {
  const lines = [
    `${result.method} ${result.url} -> ${result.status} ${result.statusText}`.trimEnd(),
  ];

  if (result.contentType) {
    lines.push(`content-type: ${result.contentType}`);
  }

  lines.push("", result.body.length > 0 ? result.body : "(empty response body)");

  if (result.truncated) {
    lines.push("", "(response body truncated)");
  }

  return truncateForModel(lines.join("\n"));
};

export const FetchTool = defineTool({
  name: "Fetch",
  description:
    "Make an HTTP(S) request and return the response status, content type, and body.",
  input: Input,
  execute: (input) =>
    fetchUrl({
      url: input.url,
      method: input.method,
      headers: input.headers ? { ...input.headers } : undefined,
      body: input.body,
    }).pipe(Effect.mapError(mapToToolFailure)),
  toModelOutput: ({ output }) => formatFetchOutput(output),
});
