import OpenAI from "openai";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { parseFunctionToolCall } from "./schemas.ts";
import { executeToolCall } from "./tools.ts";

async function main() {
  const [, , flag, prompt] = process.argv;
  const apiKey = process.env.OPENROUTER_API_KEY;
  const baseURL =
    process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }
  if (flag !== "-p" || !prompt) {
    throw new Error("error: -p flag is required");
  }

  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: baseURL,
  });

  const tools = [
    {
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
    },
  ] as const satisfies readonly ChatCompletionTool[];

  const response = await client.chat.completions.create({
    // model: "tencent/hy3-preview", // cheapest mainstream model
    model: "anthropic/claude-haiku-4.5", // cheapest mainstream model
    messages: [{ role: "user", content: prompt }],
    tools: [...tools],
  });

  if (!response.choices || response.choices.length === 0) {
    throw new Error("no choices in response");
  }

  // You can use print statements as follows for debugging, they'll be visible when running tests.
  console.error("Logs from your program will appear here!");

  const message = response.choices[0].message;

  if (message.tool_calls?.length) {
    // This stage only requires handling a single tool call.
    const toolCall = parseFunctionToolCall(message.tool_calls[0]);
    const result = await executeToolCall(toolCall);
    console.log(result);
  } else {
    console.log(message.content);
  }
}

main();
