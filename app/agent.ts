import { Effect } from "effect";
import { startConversation } from "./conversation.ts";
import { MaxTurnsExceeded, type ProgramError } from "./errors.ts";
import { LlmService } from "./llm/service.ts";
import { ToolRegistry } from "./tools/registry.ts";
import { runTurn } from "./turn.ts";

const MAX_AGENT_TURNS = 50;

export const runAgentSession = (
  prompt: string,
): Effect.Effect<string, ProgramError, LlmService | ToolRegistry> =>
  Effect.gen(function* () {
    let conversation = startConversation(prompt);
    let turns = 0;

    while (true) {
      turns += 1;
      if (turns > MAX_AGENT_TURNS) {
        return yield* Effect.fail(
          new MaxTurnsExceeded({ limit: MAX_AGENT_TURNS }),
        );
      }

      const outcome = yield* runTurn(conversation);

      if (outcome._tag === "Done") {
        return outcome.content;
      }

      conversation = outcome.conversation;
    }
  });
