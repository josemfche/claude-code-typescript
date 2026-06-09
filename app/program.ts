import { Console, Effect } from "effect";
import { runAgentLoop } from "./agent.ts";
import { loadAppConfig } from "./config.ts";
import { decodeCliArgs } from "./schemas.ts";

export const program = (
  flag: string | undefined,
  prompt: string | undefined,
) =>
  Effect.gen(function* () {
    const args = yield* decodeCliArgs(flag, prompt);
    const config = yield* loadAppConfig;

    yield* Console.error("Logs from your program will appear here!");

    const output = yield* runAgentLoop(config, args.prompt);
    yield* Console.log(output);
  });
