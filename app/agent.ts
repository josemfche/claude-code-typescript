import { Effect } from "effect";
import { startConversation } from "./conversation.ts";
import type { ProgramError } from "./errors.ts";
import { LlmService } from "./llm/service.ts";
import { ToolRegistry } from "./tools/registry.ts";
import { runTurn } from "./turn.ts";

export const runAgentSession = (
  prompt: string,
): Effect.Effect<string, ProgramError, LlmService | ToolRegistry> =>
  Effect.gen(function* () {
    let conversation = startConversation(prompt);

    while (true) {
      const outcome = yield* runTurn(conversation);

      if (outcome._tag === "Done") {
        return outcome.content;
      }

      conversation = outcome.conversation;
    }
  });
