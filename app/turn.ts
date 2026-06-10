import { Console, Effect } from "effect";
import { appendToolResult, resolveTurn } from "./conversation.ts";
import type { Conversation, FunctionToolCall, TurnOutcome } from "./domain.ts";
import type { ProgramError } from "./errors.ts";
import { LlmService } from "./llm/service.ts";
import { ToolRegistry } from "./tools/registry.ts";

const TOOL_CONCURRENCY = 10;

type ToolSettlement = {
  readonly toolCallId: string;
  readonly result: string;
};

const settleToolCalls = (
  conversation: Conversation,
  toolCalls: readonly FunctionToolCall[],
) =>
  Effect.gen(function* () {
    const tools = yield* ToolRegistry;

    const results = yield* Effect.forEach(
      toolCalls,
      (toolCall) =>
        Effect.gen(function* () {
          yield* Console.error(`Executing tool: ${toolCall.function.name}`);
          const result = yield* tools.execute(toolCall);
          return { toolCallId: toolCall.id, result } satisfies ToolSettlement;
        }),
      { concurrency: TOOL_CONCURRENCY },
    );

    return results.reduce(
      (nextConversation, { toolCallId, result }) =>
        appendToolResult(nextConversation, toolCallId, result),
      conversation,
    );
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

    const continueOutcome: TurnOutcome = {
      _tag: "Continue",
      conversation: conversationWithResults,
    };

    return continueOutcome;
  });
