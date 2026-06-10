import { Console, Effect } from "effect";
import { appendToolResult, resolveTurn } from "./conversation.ts";
import type { Conversation, FunctionToolCall, TurnOutcome } from "./domain.ts";
import type { ProgramError } from "./errors.ts";
import { LlmService } from "./llm/service.ts";
import { ToolRegistry } from "./tools/registry.ts";

const settleToolCalls = (
  conversation: Conversation,
  toolCalls: readonly FunctionToolCall[],
) =>
  Effect.gen(function* () {
    const tools = yield* ToolRegistry;
    let nextConversation = conversation;

    for (const toolCall of toolCalls) {
      yield* Console.error(`Executing tool: ${toolCall.function.name}`);
      const result = yield* tools.execute(toolCall);
      nextConversation = appendToolResult(
        nextConversation,
        toolCall.id,
        result,
      );
    }

    return nextConversation;
  });

export const runTurn = (
  conversation: Conversation,
): Effect.Effect<TurnOutcome, ProgramError, LlmService | ToolRegistry> =>
  Effect.gen(function* () {
    const llm = yield* LlmService;
    const turn = yield* llm.complete(conversation);
    const outcome = resolveTurn(conversation, turn);

    if (outcome._tag === "Done") {
      return outcome;
    }

    const conversationWithResults = yield* settleToolCalls(
      outcome.conversation,
      turn.assistant.toolCalls,
    );

    return {
      _tag: "Continue",
      conversation: conversationWithResults,
    } as const;
  });
