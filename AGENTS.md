# AGENTS.md

## Project Context

This repo is `rita-berenice`, a pnpm/Turbo TypeScript monorepo for a RAG AI character chatbot.

Use `pnpm`, not npm or yarn. The root `packageManager` is currently `pnpm@10.18.0`.

Workspaces are defined in `pnpm-workspace.yaml`:

- `packages/*`

Main packages:

- `packages/client`: Vite React 19 SSR/browser client, package `@rita-berenice/client`.
- `packages/server`: Express 5 SSR/API server and RAG/LLM orchestration layer, package `@rita-berenice/server`.
- `packages/shared`: shared API/domain/config/util types, package `@rita-berenice/shared`.
- `packages/migration`: development-only migration and data maintenance scripts, package `@rita-berenice/migration`.

Baseline scaffolding:

- `.env.example` documents required local environment variables without secrets.
- `docs/agentic-coding.md` explains the human-facing agentic coding workflow for this repo.
- `.github/workflows/ci.yml` runs install plus shared, server, and client builds.
- `.github/codex/prompts/review.md` is the reusable prompt for future Codex PR review automation.
- `.agents/skills/rag-change` provides the repeatable workflow for RAG, LLM, prompt, model, schema, and memory changes.
- `.agents/skills/tooling-upgrade` provides the repeatable workflow for package scripts, CI, TypeScript, formatting, Docker, and dependency/tooling changes.

## Common Commands

- Install dependencies: `pnpm install`
- Build all packages: `pnpm build`
- Build static GitHub Pages client: `pnpm build:static`
- Build shared package: `pnpm build:shared`
- Build client package: `pnpm build:client`
- Build server package: `pnpm build:server`
- Typecheck shared/client/server references: `pnpm typecheck`
- Run focused tests: `pnpm test`
- Run server tests: `pnpm test:server`
- Run deterministic RAG retrieval evaluation: `pnpm eval:rag`
- Start local PostgreSQL with pgvector: `pnpm db:up`
- Generate Drizzle migrations: `pnpm db:generate`
- Apply Drizzle migrations: `pnpm db:migrate`
- Check formatting: `pnpm format:check`
- Run the baseline local gate: `pnpm check`
- Start all dev tasks through Turbo: `pnpm dev`
- Start production server after build: `pnpm start`
- Check outdated dependencies: `pnpm update:check`

Package-local commands:

- Client dev server: `pnpm --filter @rita-berenice/client dev`
- Client build: `pnpm --filter @rita-berenice/client build`
- Server dev: `pnpm --filter @rita-berenice/server dev`
- Server build: `pnpm --filter @rita-berenice/server build`
- Shared build: `pnpm --filter @rita-berenice/shared build`

## Architecture Notes

- `client` depends on `shared`.
- `server` depends on `shared`.
- `migration` depends on `server` and `shared`.
- The server is both the API server and the SSR host.
- ChromaDB is currently used for vector retrieval and as the primary persistence layer for many app records.
- `server/service/llmService.ts` is the central LLM provider adapter.
- `server/service/orchestrationService.ts` coordinates chat response generation and turn finalization.
- `server/service/memoryEngine.ts` coordinates RAG memory recall.
- `server/service/ragQueryService.ts` transforms user queries for retrieval.
- `server/store/*Store.ts` modules own persistence and Chroma reconstruction logic.
- `shared/domain`, `shared/api`, and `shared/config` are the cross-package contract surface.

## Agentic Coding Rules

- Use repo-local skills when the task matches them:
  - `rag-change` for RAG, LLM, prompt, schema, Chroma retrieval, or model behavior changes.
  - `tooling-upgrade` for scripts, CI, TypeScript, formatting, Docker, dependency, or workspace changes.
- Read the relevant package manifest and existing local patterns before editing.
- Keep changes scoped to the smallest package/module that owns the behavior.
- Do not introduce npm/yarn lockfiles.
- Do not make broad dependency upgrades unless explicitly requested.
- Do not read, print, or modify `.env` files or secret-bearing files. Use `.env.example` for documentation.
- Do not commit generated runtime data, logs, local caches, or build output.
- Treat migration scripts as operationally sensitive. Ask before running destructive scripts such as drop, delete, purge, or cleanup commands.
- Preserve existing user data shape unless the task explicitly includes a migration plan.
- Prefer shared Zod/runtime contracts for API boundary changes instead of only TypeScript types.
- For LLM output changes, keep schema validation and fallback behavior explicit.
- For RAG retrieval changes, preserve or add a way to compare retrieval quality before and after the change.

## Verification Expectations

Run the narrowest relevant check first:

- Formatting-only or docs changes: `pnpm format:check`
- Shared contract/config/util changes: `pnpm build:shared`
- Server/service/store/route changes: `pnpm build:server`
- Client/UI/hook changes: `pnpm build:client`
- Type-level cross-package changes: `pnpm typecheck`
- Cross-package changes: `pnpm build`
- Before opening a PR or handing off a broad change: `pnpm check`

If a command cannot be run because required environment variables or services are unavailable, report that clearly and explain what was still verified.

For AI/RAG behavior changes, prefer focused tests or fixtures over manual inspection when possible:

- Prompt assembly snapshots.
- Structured-output parsing and repair tests.
- Retriever ranking tests with fixed query/result fixtures.
- Mocked provider tests for LLM adapter behavior.

## Frontend Conventions

- Use existing MUI, Emotion, and local glass UI patterns.
- Keep the app experience practical and task-focused.
- Preserve SSR compatibility; avoid browser-only APIs outside client-only effects or guards.
- Use React Query patterns already present in `packages/client/hook/api`.
- Keep mobile chat layout and portrait/background behavior in mind when changing chat UI.

## Server And RAG Conventions

- Keep provider-specific LLM details behind `llmService`.
- Keep orchestration, memory recall, persona generation, and persistence concerns separated.
- Avoid passing trusted server state from the browser when IDs plus server-side lookup would be safer.
- Be careful with token budgeting: distinguish model context window from maximum output tokens.
- Avoid replacing HTTP compression with custom payload wrapping unless there is a clear need.
- Prefer structured logging over ad hoc console output when touching observability.

## Documentation Expectations

- Update this file when recurring agent mistakes or repo conventions become clear.
- Add or update `.env.example` when adding required environment variables.
- Document new scripts in `package.json` and, when useful, in README.
- Keep CI commands aligned with the package scripts agents are expected to run locally.
- For agentic workflows that are repeated often, prefer a repo skill under `.agents/skills/` instead of bloating this file.
