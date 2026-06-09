import type { ChatCompletionTool } from "openai/resources/chat/completions";

export const readToolDefinition = {
  type: "function",
  function: {
    name: "Read",
    description: "Read and return the contents of a file",
    parameters: {
      type: "object",
      properties: {
        file_path: {
          type: "string",
          description: "The path to the file to read",
        },
      },
      required: ["file_path"],
    },
  },
} as const satisfies ChatCompletionTool;

export const toolDefinitions = [readToolDefinition] as const satisfies readonly ChatCompletionTool[];
