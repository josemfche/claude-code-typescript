import type {
  AssistantMessage,
  ChatMessage,
  Conversation,
  TurnOutcome,
  TurnResult,
} from "./domain.ts";

export const startConversation = (prompt: string): Conversation => [
  { role: "user", content: prompt },
];

export const appendAssistantMessage = (
  conversation: Conversation,
  assistant: AssistantMessage,
): Conversation => [...conversation, assistant];

export const appendToolResult = (
  conversation: Conversation,
  toolCallId: string,
  content: string,
): Conversation => [
  ...conversation,
  { role: "tool", toolCallId, content },
];

const shouldStopTurn = (toolCallCount: number): boolean => toolCallCount === 0;

export const resolveTurn = (
  conversation: Conversation,
  turn: TurnResult,
): TurnOutcome => {
  const nextConversation = appendAssistantMessage(conversation, turn.assistant);

  if (shouldStopTurn(turn.assistant.toolCalls.length)) {
    return {
      _tag: "Done",
      content: turn.assistant.content ?? "",
    };
  }

  return {
    _tag: "Continue",
    conversation: nextConversation,
  };
};

export const isUserMessage = (message: ChatMessage): message is Extract<ChatMessage, { role: "user" }> =>
  message.role === "user";

export const isAssistantMessage = (
  message: ChatMessage,
): message is Extract<ChatMessage, { role: "assistant" }> =>
  message.role === "assistant";

export const isToolResultMessage = (
  message: ChatMessage,
): message is Extract<ChatMessage, { role: "tool" }> =>
  message.role === "tool";
