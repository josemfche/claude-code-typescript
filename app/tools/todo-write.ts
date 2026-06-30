import { Effect, Schema } from "effect";
import { truncateForModel } from "../tool-limits.ts";
import { defineTool } from "./tool.ts";

const TodoStatus = Schema.Literal(
  "pending",
  "in_progress",
  "completed",
  "cancelled",
);

const TodoItem = Schema.Struct({
  content: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({ description: "Description of the task" }),
  ),
  status: TodoStatus.pipe(
    Schema.annotations({
      description: "One of: pending, in_progress, completed, cancelled",
    }),
  ),
  id: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description: "Optional stable identifier for the task",
      }),
    ),
  ),
});

export const Input = Schema.Struct({
  todos: Schema.Array(TodoItem).pipe(
    Schema.minItems(1),
    Schema.annotations({
      description:
        "The full, ordered todo list representing the current plan. Always pass the entire list.",
    }),
  ),
});

export type Input = typeof Input.Type;

type Todo = typeof TodoItem.Type;
type TodoStatusType = typeof TodoStatus.Type;

const STATUS_SYMBOL: Record<TodoStatusType, string> = {
  pending: "[ ]",
  in_progress: "[~]",
  completed: "[x]",
  cancelled: "[-]",
};

export const formatTodoList = (todos: ReadonlyArray<Todo>): string => {
  const lines = todos.map(
    (todo, index) =>
      `${STATUS_SYMBOL[todo.status]} ${index + 1}. ${todo.content}`,
  );

  const counts: Record<TodoStatusType, number> = {
    pending: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
  };

  for (const todo of todos) {
    counts[todo.status] += 1;
  }

  const summary = `${counts.completed} completed, ${counts.in_progress} in progress, ${counts.pending} pending${
    counts.cancelled > 0 ? `, ${counts.cancelled} cancelled` : ""
  }`;

  return [`Updated todo list (${todos.length}):`, ...lines, "", summary].join(
    "\n",
  );
};

export const TodoWriteTool = defineTool({
  name: "TodoWrite",
  description:
    "Record or update the structured todo list for the current task. Always pass the full, ordered list. Use this to plan and track progress on multi-step work, marking each item pending, in_progress, completed, or cancelled.",
  input: Input,
  execute: (input) => Effect.succeed({ todos: input.todos }),
  toModelOutput: ({ output }) => truncateForModel(formatTodoList(output.todos)),
});
