import type { ToolName } from "../domain.ts";
import { BashTool } from "./bash-tool.ts";
import { ReadTool } from "./read.ts";
import { type RegisteredTool, toolDefinitionsFrom } from "./tool.ts";
import { WriteTool } from "./write.ts";

export const builtinTools = [
  ReadTool,
  WriteTool,
  BashTool,
] as const satisfies readonly RegisteredTool[];

export const toolNames: readonly ToolName[] = builtinTools.map(
  (tool) => tool.name,
);

export const toolDefinitions = toolDefinitionsFrom(builtinTools);

const toolsByName = {
  Read: ReadTool,
  Write: WriteTool,
  Bash: BashTool,
} as const satisfies Record<ToolName, RegisteredTool>;

export const getBuiltinTool = (name: ToolName): RegisteredTool =>
  toolsByName[name];
