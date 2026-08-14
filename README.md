# Rita-Berenice v2

Rita-Berenice v2 is a pnpm/Turbo TypeScript monorepo for a personal-use AI character and long-term-memory RAG framework.

It combines a Vite React client, an Express SSR/API server, shared domain contracts, and PostgreSQL/pgvector persistence.

## Packages

- `packages/client`: React 19 + Vite client and SSR entrypoints.
- `packages/server`: Express API/SSR server, PostgreSQL stores, RAG services, and LLM orchestration.
- `packages/shared`: shared API, domain, config, and utility contracts.

## Setup

Use pnpm only. The repository is pinned to `pnpm@10.18.0`.

```bash
corepack enable pnpm
corepack install -g pnpm@10.18.0
pnpm install
```

Copy `.env.example` to `.env` for local development and fill in the required values. Do not commit real secrets.

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

## Local Development

Start the local PostgreSQL, pgvector, and SuperTokens services:

```bash
pnpm db:up
```

The default local service values from `.env.example` are:

- `DATABASE_URL=postgresql://rita:rita@localhost:5432/rita_berenice`
- `DATABASE_SSL=false`
- `SUPERTOKENS_CONNECTION_URI=http://localhost:3567`
- `AUTH_IDENTITY_NAMESPACE=supertokens-dev`

Apply database migrations, then start the combined Express SSR/API host with Vite middleware:

```bash
pnpm db:migrate
pnpm dev
```

Open `http://localhost:3000`.

Use `pnpm db:down` to stop the local Docker services.

If Vite reports a Windows `EPERM` rename error under `.vite_cache`, stop `pnpm dev`, run
`pnpm clean:vite`, then start `pnpm dev` again.

## Common Commands

```bash
pnpm dev
pnpm build
pnpm build:client
pnpm build:server
pnpm build:shared
pnpm build:static
pnpm typecheck
pnpm format:check
pnpm check
```

`pnpm check` runs formatting, typechecking, and the full Turbo build.

## Agentic Coding

This repo includes project-level guidance for Codex and other coding agents:

- `AGENTS.md`: always-on repository rules and verification expectations.
- `.agents/skills/rag-change`: workflow for RAG, LLM, prompt, schema, memory, and model changes.
- `.agents/skills/tooling-upgrade`: workflow for scripts, CI, Docker, TypeScript, pnpm, formatting, and dependency/tooling changes.
- `docs/agentic-coding.md`: human-facing guide to the agentic workflow.
- `.github/codex/prompts/review.md`: reusable prompt for future Codex PR review automation.

Use the relevant skill before changing RAG/LLM behavior or repository tooling.

## Verification

Run the narrowest relevant command first:

- Shared types/config/util changes: `pnpm build:shared`
- Server/RAG/store/route changes: `pnpm build:server`
- Client/UI/hook changes: `pnpm build:client`
- Cross-package or handoff-ready changes: `pnpm check`

If a command requires unavailable local services or secrets, report that clearly and run the checks that do not require them.

## Deployment

- `.github/workflows/ci.yml` runs formatting, typecheck, and package builds.
- `.github/workflows/fly-deploy.yml` deploys the server app to Fly.io from `main`.
- `.github/workflows/deploy.yml` builds the static client for GitHub Pages from the `mock` branch.

## License

This project is licensed under the Rita-Berenice Enhanced Use License v1.0.

- English: [LICENSE](LICENSE)
- Korean: [LICENSE.ko](LICENSE.ko)

This software is provided "as is" without any warranties. Use at your own risk. See the license files for full terms.
