import { Cause, Effect, Exit, Option } from "effect";
import { formatProgramError, isProgramError } from "./errors.ts";
import { program } from "./program.ts";

const [, , flag, prompt] = process.argv;

const exit = await Effect.runPromiseExit(program(flag, prompt));

if (Exit.isFailure(exit)) {
  const failure = Cause.failureOption(exit.cause);
  if (Option.isSome(failure) && isProgramError(failure.value)) {
    console.error(formatProgramError(failure.value));
  } else {
    console.error(Cause.pretty(exit.cause));
  }
  process.exit(1);
}
