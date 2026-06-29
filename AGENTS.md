# AGENTS.md

## Cursor Cloud specific instructions

This is a Bun + TypeScript CLI ("build your own Claude Code" agent). There is a single service:
the CLI agent itself, which talks to an OpenAI-compatible chat-completions endpoint and runs an
agent loop that executes built-in tools (`Read`, `Write`, `Edit`, `Bash`, `Grep`, `Glob`, `Ls`).

### Runtime / commands (see `package.json` + `README.md`)
- Runtime is **Bun** (installed at `~/.bun/bin/bun`, also symlinked to `/usr/local/bin/bun`). Node is not used to run the app.
- Lint/typecheck: `bun run typecheck` (`bunx tsc --noEmit`).
- Tests: `bun test` (unit tests in `test/`; they do not hit the network).
- Run the app: `./your_program.sh -p "<prompt>"` (wraps `bun run app/main.ts`).

### Required configuration (non-obvious)
- The agent needs `OPENROUTER_API_KEY` to make real LLM calls. Without it the CLI exits 1 with
  `OPENROUTER_API_KEY is not set` (config is validated via Effect Config in `app/config.ts`).
- Optional overrides: `OPENROUTER_BASE_URL` (default `https://openrouter.ai/api/v1`) and
  `OPENROUTER_MODEL` (default `anthropic/claude-haiku-4.5`).
- The app uses the official `openai` SDK pointed at `OPENROUTER_BASE_URL`, so it works against ANY
  OpenAI-compatible `/chat/completions` endpoint. To exercise the full agent loop without a real
  key, point `OPENROUTER_BASE_URL` at a local mock server and set `OPENROUTER_API_KEY` to any
  non-empty value (`bun test`/`typecheck` need neither).
