import type {
  AssistantMessage,
  ChatMessage,
  Conversation,
  FinishReason,
  TurnOutcome,
  TurnResult,
} from "./domain.ts";

const EMPTY_RESPONSE_NUDGE =
  "Your previous response was empty. Provide a final answer or use tools to complete the task.";

export const startConversation = (prompt: string): Conversation => [
  { role: "user", content: prompt },
];

const appendAssistantMessage = (
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

const appendUserMessage = (
  conversation: Conversation,
  content: string,
): Conversation => [...conversation, { role: "user", content }];

const formatFinalContent = (
  content: string,
  finishReason: FinishReason,
): string => {
  if (finishReason !== "length") {
    return content;
  }

  return `${content}\n\n[response truncated: model hit length limit]`;
};

export const resolveTurn = (
  conversation: Conversation,
  turn: TurnResult,
): TurnOutcome => {
  const nextConversation = appendAssistantMessage(conversation, turn.assistant);
  const toolCallCount = turn.assistant.toolCalls.length;

  if (toolCallCount > 0 || turn.finishReason === "tool_calls") {
    return {
      _tag: "Continue",
      conversation: nextConversation,
    };
  }

  const content = turn.assistant.content?.trim() ?? "";

  if (content.length === 0) {
    return {
      _tag: "Continue",
      conversation: appendUserMessage(nextConversation, EMPTY_RESPONSE_NUDGE),
    };
  }

  return {
    _tag: "Done",
    content: formatFinalContent(turn.assistant.content ?? "", turn.finishReason),
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
