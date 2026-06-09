import { Data } from "effect";

export class MissingApiKey extends Data.TaggedError("MissingApiKey") {}

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

export class FileReadFailed extends Data.TaggedError("FileReadFailed")<{
  readonly path: string;
  readonly cause: unknown;
}> {}

export class FileWriteFailed extends Data.TaggedError("FileWriteFailed")<{
  readonly path: string;
  readonly cause: unknown;
}> {}

export type ProgramError =
  | MissingApiKey
  | InvalidCliArgs
  | CompletionFailed
  | EmptyCompletion
  | InvalidToolCall
  | FileReadFailed
  | FileWriteFailed;

export const formatProgramError = (error: ProgramError): string => {
  switch (error._tag) {
    case "MissingApiKey":
      return "OPENROUTER_API_KEY is not set";
    case "InvalidCliArgs":
      return error.reason;
    case "CompletionFailed":
      return `completion request failed: ${String(error.cause)}`;
    case "EmptyCompletion":
      return "no choices in response";
    case "InvalidToolCall":
      return `invalid tool call: ${error.reason}`;
    case "FileReadFailed":
      return `failed to read file "${error.path}": ${String(error.cause)}`;
    case "FileWriteFailed":
      return `failed to write file "${error.path}": ${String(error.cause)}`;
  }
};
