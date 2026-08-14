# Agentic Coding Guide

This project uses agentic coding as a layered workflow:

1. `AGENTS.md` gives always-on repository rules.
2. `.agents/skills/*` gives task-specific workflows.
3. Package scripts and CI provide enforceable verification gates.
4. Optional Codex automation can be added later for PR review or scheduled checks.

## Daily Workflow

Start each task by identifying the owner package:

- Client UI and browser behavior: `packages/client`.
- Server routes, RAG, LLM orchestration, and persistence: `packages/server`.
- Shared contracts, constants, and helpers: `packages/shared`.

Use the repo-local skills when relevant:

- `rag-change`: RAG, LLM, prompt, schema, retrieval, memory, or model behavior.
- `tooling-upgrade`: package scripts, CI, Docker, TypeScript, formatting, pnpm, Turbo, or dependencies.

Run the narrowest useful gate first:

```bash
pnpm format:check
pnpm typecheck
pnpm build:server
pnpm build:client
pnpm build:static
pnpm check
```

Use `pnpm check` before handing off broad changes.

## What Agents Should Avoid

- Do not read or print `.env` files.
- Do not run destructive database operations without explicit approval.
- Do not change stored data shapes without a migration plan.
- Do not add broad dependency upgrades while doing unrelated work.
- Do not commit generated logs, build output, caches, or local runtime data.

## Future Automation

The next safe automation layer is a Codex PR review workflow that uses a prompt from `.github/codex/prompts/review.md`.

Before enabling that workflow:

1. Add an `OPENAI_API_KEY` repository secret.
2. Limit the workflow to trusted actors or require manual approval.
3. Keep the Codex run read-only for review-only tasks.
4. Keep deployment workflows separate from agent review workflows.
