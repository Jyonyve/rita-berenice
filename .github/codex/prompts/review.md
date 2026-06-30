# Codex PR Review Prompt

Review this pull request for Rita-Berenice.

Focus on:

- Bugs and behavioral regressions.
- RAG, LLM, prompt, schema, memory, and retrieval risks.
- Client/server/shared contract mismatches.
- Missing verification for changed behavior.
- Secret exposure, `.env` handling, and migration safety.
- Tooling or CI drift from `AGENTS.md`.

Use repository guidance from `AGENTS.md` and repo-local skills when applicable.

Return findings first, ordered by severity, with file and line references when possible. If no issues are found, say that clearly and mention any remaining test gaps.
