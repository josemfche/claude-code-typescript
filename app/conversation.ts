import type OpenAI from "openai";

export type Conversation =
  OpenAI.Chat.Completions.ChatCompletionMessageParam[];

export const startConversation = (prompt: string): Conversation => [
  { role: "user", content: prompt },
];

export const appendAssistantMessage = (
  conversation: Conversation,
  message: OpenAI.Chat.Completions.ChatCompletionMessage,
): Conversation => [
  ...conversation,
  {
    role: "assistant",
    content: message.content,
    tool_calls: message.tool_calls,
    refusal: message.refusal,
  },
];

export const appendToolResult = (
  conversation: Conversation,
  toolCallId: string,
  content: string,
): Conversation => [
  ...conversation,
  {
    role: "tool",
    tool_call_id: toolCallId,
    content,
  },
];
