import { Console, Effect } from "effect";
import { runAgentSession } from "./agent.ts";
import { AppLive } from "./layers.ts";
import { decodeCliArgs } from "./schemas.ts";

export const program = (
  flag: string | undefined,
  prompt: string | undefined,
) =>
  Effect.gen(function* () {
    const args = yield* decodeCliArgs(flag, prompt);

    yield* Console.error("Logs from your program will appear here!");

    const output = yield* runAgentSession(args.prompt);
    yield* Console.log(output);
  }).pipe(Effect.provide(AppLive));
