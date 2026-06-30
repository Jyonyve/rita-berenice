---
name: rag-change
description: Guide safe changes to Rita-Berenice RAG, LLM, prompt, memory, retrieval, structured-output, embedding, Chroma store, or AI model behavior. Use when modifying server/service, server/store retrieval logic, shared AI model config, prompt templates, schema parsing, or chat orchestration.
---

# RAG Change

Use this workflow before changing AI behavior.

## Workflow

1. Identify the behavior owner:
   - LLM provider calls: `packages/server/service/llmService.ts`.
   - Chat orchestration: `packages/server/service/orchestrationService.ts`.
   - Memory recall: `packages/server/service/memoryEngine.ts`.
   - Query transformation: `packages/server/service/ragQueryService.ts`.
   - Prompt templates: `packages/server/util/templateUtils.ts`.
   - Runtime schemas: `packages/server/util/schemaUtils.ts`.
   - Model config and shared types: `packages/shared/config` and `packages/shared/domain/aimodel`.
   - Chroma access and reconstruction: `packages/server/db` and `packages/server/store`.
2. Preserve user data shape unless the task explicitly includes a migration.
3. Keep provider-specific behavior behind `llmService`.
4. Keep prompt text, schema shape, parsing, and fallback behavior reviewed together.
5. Check token budgeting when changing prompts or model limits.
6. Prefer fixed fixtures or snapshots for retrieval and prompt changes.

## Verification

Run the narrowest command that covers the change:

- Shared AI config/types: `pnpm typecheck:shared` and `pnpm build:shared`.
- Server RAG/LLM changes: `pnpm typecheck:server` and `pnpm build:server`.
- Cross-package behavior: `pnpm typecheck` and `pnpm build`.
- Broad changes before handoff: `pnpm check`.

If no RAG fixture exists yet, document what was manually inspected and what fixture should be added.
