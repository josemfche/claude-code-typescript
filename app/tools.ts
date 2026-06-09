import { readFile } from "node:fs/promises";
import {
  parseReadToolArgs,
  ToolNameSchema,
  type FunctionToolCall,
} from "./schemas.ts";

async function executeReadTool(argumentsJson: string): Promise<string> {
  const args = parseReadToolArgs(argumentsJson);
  return readFile(args.file_path, "utf-8");
}

export async function executeToolCall(toolCall: FunctionToolCall): Promise<string> {
  const toolName = ToolNameSchema.parse(toolCall.function.name);

  switch (toolName) {
    case "Read":
      return executeReadTool(toolCall.function.arguments);
  }
}
