export type FunctionToolCall = {
  readonly id: string;
  readonly type: "function";
  readonly function: {
    readonly name: string;
    readonly arguments: string;
  };
};

export type ToolName = "Read" | "Write" | "Bash" | "Grep" | "Glob";

export type UserMessage = {
  readonly role: "user";
  readonly content: string;
};

export type AssistantMessage = {
  readonly role: "assistant";
  readonly content: string | null;
  readonly toolCalls: readonly FunctionToolCall[];
};

export type ToolResultMessage = {
  readonly role: "tool";
  readonly toolCallId: string;
  readonly content: string;
};

export type ChatMessage = UserMessage | AssistantMessage | ToolResultMessage;

export type Conversation = readonly ChatMessage[];

export type FinishReason =
  | "stop"
  | "tool_calls"
  | "length"
  | "content_filter"
  | "function_call"
  | null;

export type TurnResult = {
  readonly assistant: AssistantMessage;
  readonly finishReason: FinishReason;
};

export type TurnOutcome =
  | { readonly _tag: "Done"; readonly content: string }
  | { readonly _tag: "Continue"; readonly conversation: Conversation };
