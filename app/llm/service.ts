import { Context, type Effect } from "effect";
import type { Conversation, TurnResult } from "../domain.ts";
import type { ProgramError } from "../errors.ts";

export type LlmServiceApi = {
  readonly complete: (
    conversation: Conversation,
  ) => Effect.Effect<TurnResult, ProgramError>;
};

export class LlmService extends Context.Tag("LlmService")<
  LlmService,
  LlmServiceApi
>() {}
