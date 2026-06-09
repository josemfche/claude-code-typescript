export type FunctionToolCall = {
  readonly id: string;
  readonly type: "function";
  readonly function: {
    readonly name: string;
    readonly arguments: string;
  };
};

export type AssistantMessage =
  | { readonly _tag: "Text"; readonly content: string }
  | { readonly _tag: "ToolCall"; readonly raw: FunctionToolCall };
