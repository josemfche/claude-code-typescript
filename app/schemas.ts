import { z } from "zod";

export const ReadToolArgsSchema = z.object({
  file_path: z.string().min(1),
});

export type ReadToolArgs = z.infer<typeof ReadToolArgsSchema>;

export const FunctionToolCallSchema = z.object({
  id: z.string(),
  type: z.literal("function"),
  function: z.object({
    name: z.string(),
    arguments: z.string(),
  }),
});

export type FunctionToolCall = z.infer<typeof FunctionToolCallSchema>;

export const ToolNameSchema = z.enum(["Read"]);

export type ToolName = z.infer<typeof ToolNameSchema>;

export function parseFunctionToolCall(toolCall: unknown): FunctionToolCall {
  return FunctionToolCallSchema.parse(toolCall);
}

export function parseReadToolArgs(argumentsJson: string): ReadToolArgs {
  const json: unknown = JSON.parse(argumentsJson);
  return ReadToolArgsSchema.parse(json);
}
