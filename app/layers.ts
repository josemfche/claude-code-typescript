import { Layer } from "effect";
import { AppConfigLive } from "./config.ts";
import { OpenAiLlmLive } from "./llm/openai-provider.ts";
import { ToolRegistryLive } from "./tools/registry.ts";

export const AppLive = OpenAiLlmLive.pipe(
  Layer.provideMerge(AppConfigLive),
  Layer.provideMerge(ToolRegistryLive),
);
