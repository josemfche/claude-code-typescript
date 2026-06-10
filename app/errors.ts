import { Data } from "effect";

export class MissingApiKey extends Data.TaggedError("MissingApiKey") {}

export class ConfigFailed extends Data.TaggedError("ConfigFailed")<{
  readonly reason: string;
}> {}

export class InvalidCliArgs extends Data.TaggedError("InvalidCliArgs")<{
  readonly reason: string;
}> {}

export class CompletionFailed extends Data.TaggedError("CompletionFailed")<{
  readonly cause: unknown;
}> {}

export class EmptyCompletion extends Data.TaggedError("EmptyCompletion") {}

export class InvalidToolCall extends Data.TaggedError("InvalidToolCall")<{
  readonly reason: string;
}> {}

export class MaxTurnsExceeded extends Data.TaggedError("MaxTurnsExceeded")<{
  readonly limit: number;
}> {}

export type ProgramError =
  | MissingApiKey
  | ConfigFailed
  | InvalidCliArgs
  | CompletionFailed
  | EmptyCompletion
  | InvalidToolCall
  | MaxTurnsExceeded;

const programErrorTags = new Set<ProgramError["_tag"]>([
  "MissingApiKey",
  "ConfigFailed",
  "InvalidCliArgs",
  "CompletionFailed",
  "EmptyCompletion",
  "InvalidToolCall",
  "MaxTurnsExceeded",
]);

export const isProgramError = (error: unknown): error is ProgramError =>
  typeof error === "object" &&
  error !== null &&
  "_tag" in error &&
  programErrorTags.has(error._tag as ProgramError["_tag"]);

export const formatProgramError = (error: ProgramError): string => {
  switch (error._tag) {
    case "MissingApiKey":
      return "OPENROUTER_API_KEY is not set";
    case "ConfigFailed":
      return `configuration error: ${error.reason}`;
    case "InvalidCliArgs":
      return error.reason;
    case "CompletionFailed":
      return `completion request failed: ${String(error.cause)}`;
    case "EmptyCompletion":
      return "no choices in response";
    case "InvalidToolCall":
      return `invalid tool call: ${error.reason}`;
    case "MaxTurnsExceeded":
      return `agent exceeded maximum turns (${error.limit})`;
  }
};
