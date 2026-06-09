export type FunctionToolCall = {
  readonly id: string;
  readonly type: "function";
  readonly function: {
    readonly name: string;
    readonly arguments: string;
  };
};

export const toolNames = ["Read", "Write", "Bash"] as const;

export type ToolName = (typeof toolNames)[number];
