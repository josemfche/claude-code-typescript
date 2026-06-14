## What it does

- Sends a prompt to the model with tool definitions
- Runs an agent loop until the model returns a final answer with no pending tool calls
- Executes tool calls (`Read`, `Write`, `Edit`, `Bash`, `Grep`, `Glob`) and feeds results back into the conversation
- Prints only the final answer to stdout; debug output goes to stderr

## Project layout

```
app/
  main.ts                 Entry point
  program.ts              CLI orchestration
  agent.ts                Agent loop
  conversation.ts         Message history
  config.ts               Environment config (Effect Config)
  errors.ts               Tagged errors
  layers.ts               AppLive composition
  tool-limits.ts          Shared model output limits
  tool-path.ts            Shared path resolution
  file-walk.ts            Directory traversal for search tools
  edit.ts / grep.ts / glob.ts / bash.ts
  llm/
    service.ts            LlmService port
    openai-provider.ts    OpenAI adapter
  tools/
    tool.ts               defineTool factory
    builtins.ts           Built-in tool registry
    registry.ts           ToolRegistry service
    read.ts / write.ts / edit.ts / bash-tool.ts / grep.ts / glob.ts
test/
  tools.test.ts           Unit tests for core tool and turn logic
```

## Requirements

- [Bun](https://bun.sh) 1.3+
- `OPENROUTER_API_KEY` in your environment (or `.env`)

Optional:

- `OPENROUTER_BASE_URL` (defaults to `https://openrouter.ai/api/v1`)
- `OPENROUTER_MODEL` (defaults to `anthropic/claude-haiku-4.5`)

## Run locally

```sh
bun install
bun run typecheck
bun test
./your_program.sh -p "What is 10+4? Respond with only a number."
```

Agent loop example:

```sh
./your_program.sh -p "Use README.md to determine the chemical expiry period in months. Number only."
```

Submit to CodeCrafters:

```sh
codecrafters submit
```

## Bash cleanup task

Delete the old readme file:

```sh
./your_program.sh -p "Delete the old readme file."
```

Expected stdout: `Deleted README_old.md`

## File setup task

Read this README, then create `app/greeting.txt` with exactly one line:

```
Hello from the Write tool
```

Reply with `Created the file` when done.

## Chemical safety reference

Chemical expiry period: 6 months

## Author

[Jose Martinez](https://github.com/josemfche) — learning by building, one stage at a time.
