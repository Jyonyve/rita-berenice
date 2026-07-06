---
name: tooling-upgrade
description: Guide safe tooling, dependency, CI, package manager, TypeScript, Prettier, build, Docker, or workspace script upgrades in Rita-Berenice. Use when changing package.json scripts, pnpm versions, Turbo config, tsconfig files, CI workflows, Dockerfile, formatting, or dependency versions.
---

# Tooling Upgrade

Use this workflow for repo infrastructure changes.

## Workflow

1. Inspect root `package.json`, package-level manifests, `pnpm-workspace.yaml`, `turbo.json`, and relevant `tsconfig` files before editing.
2. Keep `pnpm` as the only package manager. Do not create npm or yarn lockfiles.
3. Keep the root `packageManager`, Docker pnpm version, and CI pnpm version aligned.
4. Prefer adding stable scripts before adding heavier tools.
5. Avoid broad dependency upgrades unless explicitly requested.
6. Keep generated data, build output, logs, and local caches ignored by format/check tooling.
7. Update `AGENTS.md` when commands or verification expectations change.

## Verification

For metadata-only changes:

- Parse changed JSON with PowerShell `ConvertFrom-Json` or the package manager command that consumes it.
- Run `pnpm format:check`.

For command or TypeScript config changes:

- Run `pnpm typecheck`.
- Run package builds touched by the change.
- Run `pnpm check` before handoff when practical.

If a command requires network access or missing local services, report the exact command and failure reason.
