# AGENTS.md

## Project Context

This repo is `rita-berenice`, a pnpm/Turbo TypeScript monorepo for a personal-use AI character and long-term-memory RAG framework.

Use `pnpm`, not npm or yarn. The root `packageManager` is currently `pnpm@10.18.0`.

Workspaces are defined in `pnpm-workspace.yaml`:

- `packages/*`

Main packages:

- `packages/client`: Vite React 19 SSR/browser client, package `@rita-berenice/client`.
- `packages/server`: Express 5 SSR/API server and RAG/LLM orchestration layer, package `@rita-berenice/server`.
- `packages/shared`: shared API/domain/config/util types, package `@rita-berenice/shared`.

Baseline scaffolding:

- `.env.example` documents required local environment variables without secrets.
- `docs/agentic-coding.md` explains the human-facing agentic coding workflow for this repo.
- `.github/workflows/ci.yml` runs install plus formatting, typechecking, and package builds.
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
- Start local PostgreSQL, pgvector, and SuperTokens: `pnpm db:up`
- Generate Drizzle migrations: `pnpm db:generate`
- Apply Drizzle migrations: `pnpm db:migrate`
- Check formatting: `pnpm format:check`
- Run the baseline local gate: `pnpm check`
- Clear Vite dev optimizer cache after Windows cache lock/rename errors: `pnpm clean:vite`
- Start the Express SSR/API host with Vite middleware: `pnpm dev`
- Start the standalone Vite client only: `pnpm dev:client`
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
- The server is both the API server and the SSR host.
- PostgreSQL with `pgvector` is the active persistence and vector retrieval layer.
- `server/service/llmService.ts` is the central LLM provider adapter.
- `server/service/orchestrationService.ts` coordinates chat response generation and turn finalization.
- `server/service/memoryEngine.ts` coordinates RAG memory recall.
- `server/service/ragQueryService.ts` transforms user queries for retrieval.
- `server/store/*Store.ts` modules own persistence and retrieval-facing data access.
- `shared/domain`, `shared/api`, and `shared/config` are the cross-package contract surface.

## Agentic Coding Rules

- Use repo-local skills when the task matches them:
  - `rag-change` for RAG, LLM, prompt, schema, retrieval, or model behavior changes.
  - `tooling-upgrade` for scripts, CI, TypeScript, formatting, Docker, dependency, or workspace changes.
- Read the relevant package manifest and existing local patterns before editing.
- Keep changes scoped to the smallest package/module that owns the behavior.
- Do not introduce npm/yarn lockfiles.
- Do not make broad dependency upgrades unless explicitly requested.
- Reading `.env` is allowed when it is needed to diagnose which environment the app is actually
  talking to (database host, SuperTokens connection URI, feature flags). Do not print secret
  values into the transcript, do not paste them into commits, issues, or external services, and
  do not modify `.env`. Quote the minimum needed — a hostname or a flag value, never a key or
  password. Keep `.env.example` as the documentation surface for required variables.
- Do not commit generated runtime data, logs, local caches, or build output.
- Ask before running destructive database operations.
- Preserve existing user data shape unless the task explicitly includes a migration plan.
- Prefer shared Zod/runtime contracts for API boundary changes instead of only TypeScript types.
- For LLM output changes, keep schema validation and fallback behavior explicit.
- For RAG retrieval changes, preserve or add a way to compare retrieval quality before and after the change.
- Exports marked `NOT WIRED` (see `server/util/templateUtils.ts` and `server/util/schemaUtils.ts`)
  have no caller on purpose: they are drafts for planned lore, history, and recap enrichment flows.
  Do not delete them as dead code, and do not "clean up" the commented-out prompt builders next to
  them. Having no caller is not evidence that code is unwanted in this repo.

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
- Character exposure is controlled by `CharacterInfo.visibility`
  (`CHARACTER_VISIBILITY.PRIVATE`/`PUBLIC` in `shared/config/constants.ts`). Server-side
  filtering (`filterCharacterResponseByViewer`/`assertCharacterVisibleToUser` in
  `server/store/characterStore.ts`) is authoritative; the client mirrors it as
  defense-in-depth.

## Documentation Expectations

- Update this file when recurring agent mistakes or repo conventions become clear.
- Add or update `.env.example` when adding required environment variables.
- Document new scripts in `package.json` and, when useful, in README.
- `README.md` (Korean) and `README.en.md` (English) are the same document in two languages. When one
  changes, update the other in the same commit. Do not let claims, structure, or level of detail
  diverge between them.
- Keep CI commands aligned with the package scripts agents are expected to run locally.
- For agentic workflows that are repeated often, prefer a repo skill under `.agents/skills/` instead of bloating this file.
