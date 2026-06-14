import { Context, Effect, Layer } from "effect";
import type { FunctionToolCall } from "../domain.ts";
import { decodeToolName } from "../schemas.ts";
import { toolsByName } from "./builtins.ts";

export type ToolRegistryApi = {
  readonly execute: (toolCall: FunctionToolCall) => Effect.Effect<string>;
};

export class ToolRegistry extends Context.Tag("ToolRegistry")<
  ToolRegistry,
  ToolRegistryApi
>() {}

const executeToolCall = (toolCall: FunctionToolCall): Effect.Effect<string> =>
  Effect.gen(function* () {
    const nameResult = yield* Effect.either(
      decodeToolName(toolCall.function.name),
    );

    if (nameResult._tag === "Left") {
      return `error: ${nameResult.left.reason}`;
    }

    return yield* toolsByName[nameResult.right].run(toolCall);
  });

export const ToolRegistryLive = Layer.succeed(ToolRegistry, {
  execute: executeToolCall,
});
