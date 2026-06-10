import { Effect, Schema } from "effect";
import { runShellCommand, type ShellResult } from "../bash.ts";
import { defineTool } from "./tool.ts";

export const Input = Schema.Struct({
  command: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({ description: "The command to execute" }),
  ),
});

export type Input = typeof Input.Type;

const formatShellOutput = (result: ShellResult): string => {
  const chunks: string[] = [];

  if (result.stdout) {
    chunks.push(result.stdout);
  }

  if (result.stderr) {
    chunks.push(result.stderr);
  }

  const combined = chunks.join("\n").trim();

  if (result.spawnError) {
    return combined
      ? `${combined}\n\nerror: ${result.spawnError}`
      : `error: ${result.spawnError}`;
  }

  if (result.exitCode === 0) {
    return combined;
  }

  if (combined) {
    return `${combined}\n\nCommand exited with code ${result.exitCode}.`;
  }

  return `Command exited with code ${result.exitCode}.`;
};

export const BashTool = defineTool({
  name: "Bash",
  description: "Execute a shell command",
  input: Input,
  execute: (input) => runShellCommand(input.command),
  toModelOutput: ({ output }) => formatShellOutput(output),
});
