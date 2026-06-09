import { Console, Effect } from "effect";
import { loadAppConfig } from "./config.ts";
import { handleAssistantMessage } from "./tools.ts";
import { requestCompletion } from "./llm.ts";
import { decodeCliArgs } from "./schemas.ts";

export const program = (
  flag: string | undefined,
  prompt: string | undefined,
) =>
  Effect.gen(function* () {
    const args = yield* decodeCliArgs(flag, prompt);
    const config = yield* loadAppConfig;
    const message = yield* requestCompletion(config, args.prompt);

    yield* Console.error("Logs from your program will appear here!");

    const output = yield* handleAssistantMessage(message);
    yield* Console.log(output);
  });
