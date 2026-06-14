import type { ToolName } from "../domain.ts";
import { BashTool } from "./bash-tool.ts";
import { EditTool } from "./edit.ts";
import { GlobTool } from "./glob.ts";
import { GrepTool } from "./grep.ts";
import { ReadTool } from "./read.ts";
import { type RegisteredTool, toolDefinitionsFrom } from "./tool.ts";
import { WriteTool } from "./write.ts";

export const builtinTools = [
  ReadTool,
  WriteTool,
  EditTool,
  BashTool,
  GrepTool,
  GlobTool,
] as const satisfies readonly RegisteredTool[];

export const toolDefinitions = toolDefinitionsFrom(builtinTools);

export const toolsByName = builtinTools.reduce(
  (tools, tool) => ({ ...tools, [tool.name]: tool }),
  {} as Record<ToolName, RegisteredTool>,
);

export const isToolName = (name: string): name is ToolName => name in toolsByName;

export const getBuiltinTool = (name: ToolName): RegisteredTool =>
  toolsByName[name];
