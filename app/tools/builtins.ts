import type { ToolName } from "../domain.ts";
import { BashTool } from "./bash-tool.ts";
import { EditTool } from "./edit.ts";
import { FetchTool } from "./fetch.ts";
import { GlobTool } from "./glob.ts";
import { GrepTool } from "./grep.ts";
import { LsTool } from "./ls.ts";
import { MultiEditTool } from "./multi-edit.ts";
import { ReadTool } from "./read.ts";
import { TodoWriteTool } from "./todo-write.ts";
import { type RegisteredTool, toolDefinitionsFrom } from "./tool.ts";
import { WriteTool } from "./write.ts";

export const builtinTools = [
  ReadTool,
  WriteTool,
  EditTool,
  MultiEditTool,
  BashTool,
  GrepTool,
  GlobTool,
  LsTool,
  FetchTool,
  TodoWriteTool,
] as const satisfies readonly RegisteredTool[];

export const toolDefinitions = toolDefinitionsFrom(builtinTools);

export const toolsByName = Object.fromEntries(
  builtinTools.map((tool) => [tool.name, tool]),
) as Record<ToolName, RegisteredTool>;

export const isToolName = (name: string): name is ToolName => name in toolsByName;
