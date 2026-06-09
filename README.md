# codecrafters-claude-code-typescript

My TypeScript solution for the [Build Your Own Claude Code](https://codecrafters.io/challenges/claude-code) challenge on CodeCrafters.

A small CLI assistant that talks to an OpenAI-compatible API, runs an agent loop, and executes tools on behalf of the model. Built with **Bun**, **Effect**, and **Effect Schema**.

[![progress-banner](https://backend.codecrafters.io/progress/claude-code/5f18ff56-c341-4959-a80d-8cadbd0ba473)](https://app.codecrafters.io/users/josemfche?r=2qF)

## What it does

- Sends a prompt to the model with tool definitions
- Runs an agent loop until the model returns a final answer (`finish_reason: stop`)
- Executes tool calls (`Read`, `Write`) and feeds results back into the conversation
- Prints only the final answer to stdout; debug output goes to stderr

## Project layout

```
app/
  main.ts              Entry point
  program.ts           CLI orchestration
  agent.ts             Agent loop
  llm.ts               API client
  tools.ts               Tool registry and execution
  schemas.ts           Request/response validation
  config.ts            Environment config
  errors.ts            Tagged errors
  tool-definitions.ts  Tool specs sent to the model
```

## Requirements

- [Bun](https://bun.sh) 1.3+
- `OPENROUTER_API_KEY` in your environment (or `.env`)

Optional:

- `OPENROUTER_BASE_URL` (defaults to `https://openrouter.ai/api/v1`)
- `OPENROUTER_MODEL` (defaults to `tencent/hy3-preview`)

## Run locally

```sh
bun install
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
