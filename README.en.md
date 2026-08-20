# Rita-Berenice v2

[한국어](README.md)

Rita-Berenice v2 is a personal-use AI character framework with a long-term-memory RAG layer,
built as a pnpm/Turbo TypeScript monorepo: a Vite React 19 client, an Express 5 SSR/API server,
shared domain contracts, and PostgreSQL/pgvector persistence.

It is not a hosted product and not a multi-tenant service. Every LLM call runs on API keys the user
supplies and the server stores encrypted per user, so provider choice, spend, and model selection
stay with the account owner rather than the deployment. That constraint shapes the design: model
access is resolved per request from user credentials, retrieval budgets are small and explicit, and
expensive work (metadata enrichment, embedding) is deferred to background jobs instead of the
response path.

- A DB check constraint makes it impossible for an unapproved generated document to reach a prompt — [Memory tiers](#memory-tiers)
- `groundingDecision` is a required response-schema field, and a `contradicted` verdict triggers one revision pass — [LLM invocation and structured output](#llm-invocation-and-structured-output)
- Streaming buffers the span where the verdict is unresolved, then discards the buffer on a contradiction and streams the revision instead — [LLM invocation and structured output](#llm-invocation-and-structured-output)
- Embedding and turn post-processing run as background jobs outside the response path — [Response candidates and human selection](#response-candidates-and-human-selection)
- Three corrections for distinct retrieval failures: keyword fallback, critical-term rescue, intent-sensitive selection — [Retrieval and precedence](#retrieval-and-precedence)

## Demo

- Demo deployment: <https://rita-berenice-demo.fly.dev> — deployed from `main` by
  [.github/workflows/fly-deploy-demo.yml](.github/workflows/fly-deploy-demo.yml).
- Static client build: `pnpm build:static` produces a server-less client bundle, which the GitHub
  Pages workflow [.github/workflows/deploy.yml](.github/workflows/deploy.yml) publishes from the
  `mock` branch.
- Chat generation requires the user's own provider API key, entered through the in-app key dialog
  ([ApiKeyDialog.tsx](packages/client/page/chat/ApiKeyDialog.tsx)). Signing in without a key gives
  access to the UI and stored data, not to model output.

## Architecture

### Memory tiers

Memory is split by lifetime and by who may edit it, rather than being one undifferentiated vector
store. Schema for all tiers is in [schema.ts](packages/server/db/schema.ts).

| Tier               | Table             | Scope and lifetime                                                                                                                                        | Written by                                                                             |
| ------------------ | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Profile            | `profiles`        | One profile per session (unique index on `session_id`); the user's in-fiction identity                                                                    | User, via [profileStore.ts](packages/server/store/profileStore.ts)                     |
| Character          | `characters`      | Persona baseline: world introduction, description, acting instruction                                                                                     | User, via [characterStore.ts](packages/server/store/characterStore.ts)                 |
| Lore               | `lores`           | Character-scoped by default; `LoreInfo.sessionId`, when set, restricts an entry to one session ([lore.type.ts](packages/shared/domain/lore/lore.type.ts)) | User, via [loreStore.ts](packages/server/store/loreStore.ts)                           |
| History            | `histories`       | Character-level past events, shared across that character's sessions                                                                                      | User, via [historyStore.ts](packages/server/store/historyStore.ts)                     |
| In-world documents | `documents`       | Session-scoped; `draft` → `approved` → `archived`                                                                                                         | User or LLM generation, via [documentStore.ts](packages/server/store/documentStore.ts) |
| Session memory     | `chat_turns`      | One row per committed turn, append-only, enriched with LLM metadata                                                                                       | [finalizationJobService.ts](packages/server/service/finalizationJobService.ts)         |
| Recaps             | `recaps`          | Span summaries keyed by `turn_start`–`turn_end`                                                                                                           | Client, via [recap.routes.ts](packages/server/route/recap.routes.ts)                   |
| Candidates         | `temp_chat_turns` | Keyed by `(session_id, sequence)`; holds the unresolved current turn only                                                                                 | [orchestrationService.ts](packages/server/service/orchestrationService.ts)             |

Separating these matters because they update on different clocks. Profile and character settings are
edited deliberately and are current by definition. Lore and history are authored reference material.
Chat turns accumulate automatically and are never edited after commit. Recaps compress ranges of
chat turns. Collapsing them into one store would make "what the user set up" and "what happened in
conversation" compete on cosine distance alone.

Embeddings for every tier live in one table, `memory_embeddings`, discriminated by `source_type`
(`chat` | `lore` | `history` | `recap` | `document`) with an HNSW cosine index over 1536-dimensional
vectors — see [embeddingService.ts](packages/server/service/embeddingService.ts). Writes go through
`replaceMemoryEmbedding`, which is content-hash guarded, and are queued through
[embeddingJobService.ts](packages/server/service/embeddingJobService.ts) so re-embedding never
blocks a response. A generation counter invalidates in-flight jobs when a source is edited again
before its embedding lands.

Retrieval access is gated in SQL, not only in application code: `documents` carries a check
constraint (`documents_retrieval_requires_approval_check`) that makes `retrieval_enabled` legal only
when `status = 'approved'`, and `queryApproved` filters on both columns. A generated document cannot
reach a prompt before a human approves it.

### Retrieval and precedence

Query transformation — [ragQueryService.ts](packages/server/service/ragQueryService.ts):

1. Session glossary terms are substituted into the raw text (`terms` table, Korean → English).
2. Translation and structured filter extraction run concurrently under `Promise.allSettled`, so
   either can fail without failing the turn; translation falls back to the substituted text and
   extraction falls back to empty criteria.
3. Extracted topics, keywords, entities, and the `criticalTerm` are expanded into additional query
   texts without another LLM call.

Retrieval — [memoryEngine.ts](packages/server/service/memoryEngine.ts) fans out across chat turns,
lore, history, recaps, and documents in parallel, sharing one `QueryEmbeddingCache` so a query text
is embedded once per turn rather than once per source.

Ranking combines semantic distance with recency at a fixed 0.7 / 0.3 weighting
([queryUtils.ts](packages/server/util/queryUtils.ts)), then applies three correction passes:

- **Keyword fallback.** `queryChatTurnsByKeywords` / `queryRecapsByKeywords` run a lexical pass and
  merge hits the vector search missed. Pure embedding retrieval loses rare proper nouns, which is
  exactly the class of term a long-running fiction depends on.
- **Critical-term rescue.** If all sources together return fewer than three results and the query
  had a `criticalTerm`, a second unfiltered search runs on that term alone.
- **Intent-sensitive selection.** `hasEarliestEventIntent` routes "when did X first happen"-shaped
  queries to `selectEarliestRelevantMatches` (lowest sequence wins) instead of the default
  `selectHighConfidenceQueryMatches` (most term hits wins) —
  [ragKeywordUtils.ts](packages/server/util/ragKeywordUtils.ts).

Selected chat turns are then expanded with up to four immediately following turns
([ragContinuityUtils.ts](packages/server/util/ragContinuityUtils.ts)), because a retrieved turn is
usually the start of an exchange and the answer is in the reply, not the question.

Precedence is enforced in prompt text, since retrieval order alone does not tell the model which
source outranks which. The rules in [templateUtils.ts](packages/server/util/templateUtils.ts) are:

- Lore and history are labelled "Official Lore (Absolute Truth)" / "Past Events (Absolute Truth)";
  recalled conversation is labelled ordinary past memory.
- In-world documents are labelled issuer claims, carrying `claimMode`
  (`record` / `statement` / `report` / `rumor` / `opinion` / `propaganda` / `unknown`), issuer,
  viewpoint, and a temporal identity (`eventKey`, `timelineOrder`, `inWorldTime`). A rumor document
  supports only that the rumor circulated. Documents with differing temporal identity stay separate
  events even when the same people and actions repeat.
- Direct conversation evidence overrides summaries, and speaker and action direction taken from
  direct evidence may not be reversed.
- If the user's premise conflicts with memory, the character corrects the premise; memory is never
  rewritten to agree with it.

Profile and character settings are re-read from their stores on every request and rendered into the
system prompt, while retrieved memory is injected as labelled evidence beneath it.

Retrieval evidence can be inspected without adding an endpoint: setting `RITA_RAG_TRACE=true` in
development emits per-query candidate IDs, ranks, and cosine distances to the structured log, with
content stripped — see [docs/rag-tracing.md](docs/rag-tracing.md) and
[ragTraceUtils.ts](packages/server/util/ragTraceUtils.ts).

### Context assembly

`buildPersonaMessages` in [personaEngine.ts](packages/server/service/personaEngine.ts) assembles a
fixed message order:

1. Static system prompt — language enforcement, narration rules, character baseline, profile name.
2. Long-term memory block — recaps, lore, history, in-world documents, past conversations, each
   under an explicit label.
3. Persona response contract — speaker identity, evidence handling, refusal-to-confabulate rules.
4. Short-term history — the most recent turns, replayed as real `user`/`assistant` messages.
5. The current user message.

The contract sits at position 3 rather than being folded into the system prompt at position 1. The
reason is recorded at the builder itself: recalled memory is third-person summary text, and when it
is the last thing before the current turn the model tends to adopt the memory narrator's voice.
Restating the contract after the memory block keeps speaker identity attached to the current turn.

Budgeting — [tokenBudgetUtils.ts](packages/server/util/tokenBudgetUtils.ts) and `validateTokenCount`
in [llmService.ts](packages/server/service/llmService.ts): input is counted with `tiktoken`
(`cl100k_base`), and the available input budget is the model's context window minus
`min(requested maxTokens, model maxOutputTokens)`. Distinguishing context window from maximum output
tokens is deliberate; conflating them silently overcommits the window.

Over-budget requests are rejected, not truncated — there is no drop-oldest ladder. What bounds the
prompt instead is fixed retrieval caps applied before assembly: `FINAL_MEMORY_LIMIT = 5` per source,
an initial candidate limit of 30 for chat turns and 20 for recaps, at most 4 continuation turns, and
document bodies sliced to 4,000 characters. If a model's limits are unknown, budgeting is skipped
with a warning rather than guessed.

### LLM invocation and structured output

All provider differences are confined to [llmService.ts](packages/server/service/llmService.ts).
Clients are constructed per request from the user's decrypted keys
([credentialStore.ts](packages/server/store/credentialStore.ts)) across OpenAI, Anthropic, Google,
and OpenRouter.

Structured output takes one of two paths:

- **Native.** For `platform: 'direct'` with OpenAI, Anthropic, or Google, the Zod schema is passed to
  `withStructuredOutput({ includeRaw: true })`. If the provider's own parse yields nothing, the raw
  message is re-parsed through the manual path rather than failing.
- **Manual.** Everything else — including OpenRouter, and including every streaming call — gets Zod
  format instructions prepended as a system message and parses the raw text afterwards.

Parsing and validation are one function, `parseStructuredLlmOutput` in
[structuredOutputUtils.ts](packages/server/util/structuredOutputUtils.ts): strip markdown fences,
`JSON.parse`, then `schema.safeParse`. Every failure mode — empty output, malformed JSON, schema
mismatch — raises a single `StructuredOutputValidationError` carrying the raw output, so the
recovery path has something to work with.

Recovery is bounded and explicit:

- **One repair attempt.** `repairStructuredLlmOutput` sends the raw output, the failure reason, and a
  literal schema description to the cheap extraction model and re-validates the result. A second
  failure throws; there is no retry loop.
- **Per-call fallbacks where a degraded answer is acceptable.** Query transformation falls back to
  the original text, and enrichment fields are coerced field by field in
  `_extractChatTurnMetadataInfoFromLlm` so one missing key does not discard a whole turn's metadata.
- **Grounding as a schema field.** The persona schema requires `groundingDecision`
  (`not_applicable` | `supported` | `contradicted` | `uncertain`) alongside `response` and `emotion`.
  A `contradicted` verdict triggers one revision pass that re-sends the rejected draft with
  instructions to deny the false premise outright — the failure it targets is the model conceding a
  premise in qualified form ("I did, but…") after correctly detecting the contradiction.
- **Streaming honours the same contract.** `PartialJsonStringDecoder`
  ([partialJsonUtils.ts](packages/server/util/partialJsonUtils.ts)) decodes one JSON string field out
  of a partial token stream, so the client receives `response` text as it arrives while
  `groundingDecision` is still being read. While the decision is unresolved the text is buffered; if
  it resolves to `contradicted` the buffer is dropped and never reaches the client, and the revised
  answer is streamed instead. The final structured object is still validated against the schema
  after the stream ends.

Every chat request carries an `AbortSignal` chained to a server-side `ABORT_TIMEOUT` timer, so a
hung provider call fails the turn rather than holding the connection
([orchestrationService.ts](packages/server/service/orchestrationService.ts)).

### Response candidates and human selection

A turn does not commit on generation. `receiveBotResponse` appends each generated `ChatMessageSet`
to the current `TempChatTurn`, so regeneration accumulates candidates rather than replacing the
previous one. [TempTurnDisplay.tsx](packages/client/page/chat/TempTurnDisplay.tsx) lets the user page
through candidates, edit either side inline, or regenerate again.

Commit happens on the next send ([ChatPage.tsx](packages/client/page/chat/ChatPage.tsx)): the
candidate on screen becomes a `ChatTurnCdo` and is handed to
[finalizationJobService.ts](packages/server/service/finalizationJobService.ts), which persists the
job in `finalization_jobs` (up to 3 attempts, unique per `(session_id, sequence)`) and runs
enrichment off the response path. Enrichment extracts proper nouns, resolves them against the
session glossary, and produces summary, keywords, topics, entities, emotions, and lore/history
references under a schema built for the specific character and profile names. Only then does the
turn enter `chat_turns` and get embedded.

Unselected candidates are discarded with the temp row; they are not stored as rejected examples.
`TempChatTurn.fixedSetNo` exists in the domain type but is only ever written as a constant (`-1` on
the server, `0` in the new-chat loader) — no preference signal is currently derived from which
candidate a user picks.

### Contract boundary

`packages/shared` is the only module both other packages import. It exports four subpaths — `./api`,
`./domain`, `./config`, `./util` — with a `development` condition pointing at source and `default`
pointing at built output, so the dev server type-checks against source while builds consume `dist`.

What it guarantees is compile-time: response envelopes
([ModuleResponse.ts](packages/shared/api/ModuleResponse.ts)), domain entities, the model catalogue
and its limits ([supportAiModelInfo.ts](packages/shared/config/supportAiModelInfo.ts)), and ID
construction helpers used by both sides, so session, profile, and turn IDs are built by one
implementation rather than two.

Runtime validation is deliberately not in `shared`: request-body and LLM-output Zod schemas live in
[schemaUtils.ts](packages/server/util/schemaUtils.ts), and the server treats its own lookups as
authoritative. The chat endpoint accepts only `sessionId`, `sequence`, `entries`, and `modelName`;
character, profile, model configuration, and recent turns are re-resolved server-side from those IDs
and re-checked for ownership
([orchestration.routes.ts](packages/server/route/orchestration.routes.ts)). Character visibility
follows the same pattern — `filterCharacterResponseByViewer` and `assertCharacterVisibleToUser` in
[characterStore.ts](packages/server/store/characterStore.ts) are authoritative, and the client's
equivalent check is defence in depth only.

## Packages

- [packages/client](packages/client): React 19 + Vite client and SSR entrypoints.
- [packages/server](packages/server): Express API/SSR server, PostgreSQL stores, RAG services, and LLM orchestration.
- [packages/shared](packages/shared): shared API, domain, config, and utility contracts.

## Agentic Coding

This repo includes project-level guidance for Codex and other coding agents:

- [AGENTS.md](AGENTS.md): always-on repository rules and verification expectations.
- [.agents/skills/rag-change](.agents/skills/rag-change): workflow for RAG, LLM, prompt, schema, memory, and model changes.
- [.agents/skills/tooling-upgrade](.agents/skills/tooling-upgrade): workflow for scripts, CI, Docker, TypeScript, pnpm, formatting, and dependency/tooling changes.
- [docs/agentic-coding.md](docs/agentic-coding.md): human-facing guide to the agentic workflow.
- [.github/codex/prompts/review.md](.github/codex/prompts/review.md): reusable prompt for future Codex PR review automation.

Use the relevant skill before changing RAG/LLM behavior or repository tooling.

The split into two skills follows the two failure modes that differ most: a RAG change is judged by
output quality and needs prompt text, schema, parsing, and fallback reviewed together, while a
tooling change is judged by reproducibility and needs the pinned pnpm version, Docker, and CI kept
aligned.

Verification is ordered narrowest-first because the full gate is slow and a broad failing command
does not say which package broke; running the owning package's build first localizes the failure
before `pnpm check` is spent.

`AGENTS.md` also carries server and RAG conventions that are easy to violate without noticing: keep
trusted state out of browser-supplied payloads, distinguish context window from maximum output
tokens, and do not replace HTTP compression with custom payload wrapping.

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

For workflows that cannot use `drizzle-kit` (deploy-time runners), the app ships a lightweight
migration runner based on `drizzle-orm`:

```bash
DATABASE_URL=... DATABASE_SSL=true pnpm --filter @rita-berenice/server db:migrate:run
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

## Verification

Run the narrowest relevant command first:

- Shared types/config/util changes: `pnpm build:shared`
- Server/RAG/store/route changes: `pnpm build:server`
- Client/UI/hook changes: `pnpm build:client`
- Cross-package or handoff-ready changes: `pnpm check`

If a command requires unavailable local services or secrets, report that clearly and run the checks that do not require them.

## Deployment

- [.github/workflows/ci.yml](.github/workflows/ci.yml) runs formatting, typecheck, and package builds.
- [.github/workflows/fly-deploy-demo.yml](.github/workflows/fly-deploy-demo.yml) deploys the demo app (`rita-berenice-demo.fly.dev`) from `main`.
- [.github/workflows/deploy.yml](.github/workflows/deploy.yml) builds the static client for GitHub Pages from the `mock` branch.
- The demo [fly.toml](fly.toml) uses `release_command` to apply committed schema migrations automatically
  before each deploy, and sets `AUTO_PROVISION_USERS=true` so a fresh SuperTokens signup creates
  the linked Rita user and identity mapping automatically.

## License

This project is licensed under the Rita-Berenice Enhanced Use License v1.0.

- English: [LICENSE](LICENSE)
- Korean: [LICENSE.ko](LICENSE.ko)

This software is provided "as is" without any warranties. Use at your own risk. See the license files for full terms.
