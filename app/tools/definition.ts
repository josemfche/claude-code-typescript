export type ToolDefinition = {
  readonly type: "function";
  readonly function: {
    readonly name: string;
    readonly description: string;
    readonly parameters: Record<string, unknown>;
  };
};
