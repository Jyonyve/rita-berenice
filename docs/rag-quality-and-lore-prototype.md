# RAG Quality and Session Lore Prototype Review

## Scope

This document records the current implementation before any major RAG debug or generated-lore
schema work. It covers the current request flow, retrieval parameters, observability gaps, storage
relationships, draft-lore behavior, the minimum prototype contract, and model/cost placement.

The recommended order is:

1. Add an authenticated development-only RAG inspection path.
2. Run human answer-quality cases and record failure modes.
3. Tune retrieval only from those observations.
4. Prototype one session-based lore document type as a non-retrievable draft.
5. Add candidate suggestions, conflict detection, and broader automation later.

## Current RAG Request Flow

1. `orchestration.routes.ts` authenticates the request and verifies session ownership.
2. The route loads the character, profile, all finalized session turns, and model information.
3. The newest three finalized turns become short-term context (`RECENT_CHAT_TURN = 3`).
4. `orchestrationService.ts` calls `memoryEngine.recallRelevantMemories` before persona generation.
5. `ragQueryService.ts` runs two extraction-model tasks concurrently:
   - translate the user input to English, applying the session terminology map first;
   - extract English-normalized entities, emotion, topics, keywords, a critical term, and period.
6. The final retrieval query list contains the translated input plus each extracted topic, keyword,
   character name, and critical term.
7. `memoryEngine.ts` searches four sources concurrently:
   - chat turns in the current session;
   - lore associated with the current character or world lore;
   - history associated with the current character;
   - factual recaps in the current session.
8. Semantic results are reordered by critical-term presence and query-term hit count. Chat and recap
   keyword fallback results are merged in.
9. The first five chat anchors are selected, then up to four immediate following turns are added for
   continuity. Up to five recaps are included. Lore and history currently use their store defaults.
10. `personaEngine.ts` builds two system messages: the static persona prompt and the RAG background
    prompt. It then appends the three recent turns and the current user input.
11. The selected model streams a structured persona response. The chosen temporary response is
    finalized asynchronously, enriched, stored, and embedded.

If memory recall fails, generation continues with recent context and no long-term context. This is
good availability behavior, but the UI currently cannot distinguish a response generated without
RAG from a response generated after successful retrieval.

## Current Retrieval Parameters

| Parameter                       | Current value or behavior                                                   |
| ------------------------------- | --------------------------------------------------------------------------- |
| Short-term turns                | 3 finalized turns                                                           |
| Initial chat semantic limit     | 30                                                                          |
| Initial recap semantic limit    | 20                                                                          |
| Lore semantic limit             | 10 store default                                                            |
| History semantic limit          | 10 store default                                                            |
| Final chat anchors              | 5                                                                           |
| Following continuity turns      | Up to 4                                                                     |
| Final recaps                    | 5                                                                           |
| Similarity threshold            | None                                                                        |
| Query expansion                 | Translation plus topics, keywords, characters, and critical term            |
| Emotion expansion               | Adds an emotion-specific semantic query for chat turns                      |
| Critical-term boost             | Stable partition for exact substring presence; nominal 1.5 marker           |
| Query-term boost                | Sort by number of substring term hits, preserving semantic order on ties    |
| Keyword fallback                | Chat and recap only; candidate pool is at least 50, final fallback limit 10 |
| Low-result fallback             | Critical-term-only chat search when total results are below 3               |
| Recency weighting               | None in live long-term ranking                                              |
| Cross-session chat/recap search | Not supported                                                               |
| Draft/canonical lore filter     | Not supported                                                               |

The store layer converts embedding search results back to domain objects and drops the cosine
distance. By the time `memoryEngine` ranks results, semantic scores are unavailable. Current boosts
therefore reorder result lists rather than combine semantic, keyword, recency, and source scores into
one explainable score.

Metadata filtering is also inconsistent:

- Chat and history require an exact metadata match when extracted criteria are present. A plausible
  semantic result can be excluded before vector ranking.
- Recaps require exact equality between requested terms and recap flags.
- Lore admits world lore, character-linked lore, or any lore matching extracted criteria. This is
  broad and can include unrelated-character lore when a generic criterion matches.
- Lore queries are user-scoped before embedding search. Lore without `sessionId` remains available
  as world/character lore; lore with `sessionId` is included only for that exact session. This
  allows generated drafts to be promoted deliberately to either scope without leaking session
  events into sibling sessions.

## API Cost Characteristics

One chat request currently performs:

- up to two extraction-model calls for query transformation;
- one embedding call per transformed query inside each source search;
- the persona-generation call;
- later finalization calls for named-entity extraction and turn enrichment;
- a background embedding call for the finalized turn.

The same transformed query is embedded separately by chat, lore, history, and recap searches. A
request with five query texts can therefore request the same five embeddings four times. The first
cost optimization should be request-scoped query-vector reuse or batched query embedding, without
changing ranking behavior.

The token budget logger records estimated input tokens and reserved output tokens. It does not yet
record provider-reported input/output usage or actual cost.

## Human Quality Scenario Readiness

| Scenario                                | Current readiness                                                               |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| Explicit recent information             | Supported by three-turn verbatim context                                        |
| Older information in the same session   | Supported by chat and recap retrieval                                           |
| Information only in another session     | Not supported unless promoted into lore/history                                 |
| Synthesis across multiple sessions      | Not supported                                                                   |
| Similar characters or events            | Partial; metadata filters can help or incorrectly exclude                       |
| Current session conflicts with lore     | Both may enter the prompt, but no conflict representation exists                |
| Intentionally false premise             | No explicit retrieval or response policy                                        |
| Relationship/emotional inference        | Partial through turn metadata and recap flags                                   |
| No relevant result                      | Weak; no similarity threshold or abstention signal                              |
| Point-in-time answer                    | Partial; a period string is extracted but temporal constraints are not enforced |
| Character knowledge vs global knowledge | Not represented in schema or prompt context                                     |

The deterministic retrieval evaluation is a useful regression gate, but it does not judge
the final answer, false-premise handling, knowledge boundaries, conflicts, or no-result behavior.

## Existing Observability

Structured JSONL logging records the normal operational fields below. An optional development-only
trace (`RITA_RAG_TRACE=true`) now adds transformed query text, per-query cosine distances,
embedding-cache reuse, raw ranked source IDs, fallback IDs, and final selections. See
`docs/rag-tracing.md`.

- request, session, user, turn, character, and model context;
- orchestration timing checkpoints;
- query counts and query-transform fallback state;
- source result counts and final selected IDs;
- selected continuation counts;
- prompt section counts;
- token-budget estimates;
- structured-output parse failures.

The trace still does not retain or expose:

- a combined ranking score;
- complete per-result inclusion and exclusion reasons after all boosts;
- exact prompt sections sent to the persona model;
- provider-reported token usage;
- actual cost;
- whether the final answer grounded each selected source correctly.

Full prompts and private memory content are not added to normal or trace logs. If they become
necessary, they should be returned only through an authenticated, development-only inspection
response.

## Minimum RAG Inspection Prototype

Add an authenticated endpoint such as `POST /api/dev/rag/inspect` with these restrictions:

- available only when `NODE_ENV=development` and an explicit debug flag is enabled;
- verifies that the authenticated user owns the requested session;
- never included in the public demo API;
- defaults to retrieval-only mode so answer generation is an explicit paid action;
- does not persist full prompts unless the evaluator explicitly saves a run.

The request should contain `sessionId`, `question`, and optional `generateAnswer` and `modelName`.
The response should contain:

- transformed query texts and extracted filter criteria;
- searched scopes and configured limits;
- raw candidate source IDs, source type, cosine distance, keyword hit count, and sequence/date;
- selected sources and a machine-readable inclusion reason;
- excluded candidates and exclusion reason;
- the exact RAG background block and an estimated token count;
- optional final answer, model, provider usage, and timings.

Implement this by adding a server-only `RagTrace` object to the existing recall path. Do not create a
second retriever for the debug endpoint. Store methods need an optional scored-result form so normal
callers can keep receiving domain objects while inspection retains distance and ranking evidence.

For the first human pass, saving evaluations can remain a local ignored JSONL artifact produced by a
script. Add a database evaluation table only when the internal screen is built and multiple users
need durable judgments.

## Current Data Relationships

- `sessions` belongs to one user and one character. Its JSON data holds the profile ID, lifecycle
  status, user note, and content policy.
- `profiles` belongs to one session and user; the database enforces one profile per session.
- `chat_turns` belongs to one session. Its JSON data contains request/response message IDs, enriched
  metadata, and soft lore/history references.
- `recaps` belongs to one session and records a turn range. Recap lore/history references are soft
  JSON references.
- `histories` belongs to one character. It has no source-session or source-message relationship.
- `lores` belongs to one user at the row level. Character associations live inside the JSON data.
  There is no session association, review status, canonical flag, or provenance contract.
- `documents` belongs to one user, session, and character. Lifecycle and retrieval eligibility are
  indexed columns; free-form content, viewpoint, grounding mode, and provenance are typed JSONB.
- `memory_embeddings` is a polymorphic index keyed by `sourceType` and `sourceId`. It can carry a
  denormalized session and character ID, but it has no foreign key to the source table. `active`
  controls which embedding version is searchable, not whether the source document is approved.

## Why In-World Documents Are Separate From Lore

The initial proposal considered storing generated drafts in lore JSONB. The agreed product behavior
is broader: a document is a free-form artifact written from an in-world issuer or viewpoint, can be
entered manually or generated, can be revised independently, and is not necessarily objective
canon. Reusing `storeLore` would also embed every draft immediately.

Documents therefore use a dedicated `documents` table. This is a focused lifecycle boundary, not a
general lore-schema redesign. The table stores ownership and retrieval-critical fields as columns:

- `user_id`, `session_id`, and `character_id` establish scope;
- `origin` is `manual` or `generated`;
- `status` is `draft`, `approved`, or `archived`;
- `retrieval_enabled` is constrained so it can only be true for approved rows;
- `retrievalEnabled` is the single typed JSONB preference used by document and lore contracts; drafts may store the preference while the retrieval column remains false;
- typed JSONB holds the free-form body, title, document kind, issuer/viewpoint, grounding mode,
  server-derived source references, model/prompt metadata, and revision.

The body does not use a fixed report schema. Document kind, issuer, and viewpoint are descriptive
labels, so the same storage can represent an observatory case report, a letter, a newspaper article, a
field log, or a form invented for the current setting.

## Document Safety Contract

- Manual and generated documents are persisted as non-retrievable drafts.
- Draft creation and editing never create embeddings.
- The browser cannot provide `userId`, `characterId`, status, or source IDs. It may explicitly set the `retrievalEnabled` preference through validated document endpoints.
- The server derives ownership and character scope from the authenticated session.
- Generated-document and AI-rewrite source IDs are derived from the server's RAG result and
  revalidated before persistence. A model may invent narrative details but cannot invent provenance
  IDs.
- AI rewrite/edit is allowed only for existing drafts. The request uses the current draft content and
  metadata, a natural-language edit instruction, the selected model, server-selected RAG context, and
  the draft's existing `retrievalEnabled` preference.
- AI rewrite/edit returns a complete replacement draft, not a diff. It keeps the same document ID,
  user/session/character scope, draft status, and retrieval isolation, and it uses the existing
  revision token so a concurrently saved draft is not overwritten.
- The client keeps only the immediately preceding draft in local comparison state after an AI
  rewrite. It renders removed and added lines as a red/green diff, updates the comparison while the
  rewritten draft is manually edited, and does not persist a version-history record.
- The latest generation or rewrite request remains in the document's `requestText` metadata and is
  shown beside the rewrite controls so the user can refer to it without treating it as new input.
- `grounded` means the document stays within selected evidence, `mixed` means evidence plus invented
  detail, and `invented` means no supporting source was claimed.
- Approval is an explicit server transition that locks direct draft editing. It enables retrieval
  and queues an embedding only when `retrievalEnabled` is selected.
- New manual and generated documents default to `retrievalEnabled: false`. An approved document can
  enable or disable the preference later; disabling it removes its embedding.
- Archiving disables retrieval and removes document embeddings without deleting the document or its
  provenance.
- Normal RAG must prefilter approved, retrieval-enabled rows before searching document embeddings.
  This remains necessary even if a stale background embedding exists.

Normalized provenance/version tables are intentionally deferred. JSONB source arrays and a revision
counter are sufficient for the first workflow; a migration should be justified later by actual
cross-session queries, deletion analysis, collaborative editing, or audit requirements.

## In-World Document Workflow

1. The user opens the document workspace from a session.
2. The user can paste or write free-form text into a persisted manual draft.
3. For generation, the user enters a natural-language request and uses the current model choice.
4. The server verifies session ownership and runs RAG to select relevant turns, lore, history,
   recaps, and already approved documents. Sources are not manually selected by the user.
5. Structured output supplies a title, free-form body, inferred document kind, issuer/viewpoint, and
   grounding mode. If the request omits a kind or issuer, the model may choose a fitting fictional
   one.
6. The generated result is automatically stored as a draft with server-derived source references.
7. The user can edit the draft directly or request a targeted AI rewrite using natural language. If
   there are unsaved direct edits in the browser, the client saves them first and then sends the
   updated revision token to the rewrite endpoint.
8. The rewrite endpoint verifies ownership from the persisted document, recalls relevant session/RAG
   context, sends the current draft and edit instruction to the selected model, validates structured
   output, and stores the complete replacement as the same draft with an incremented revision. The
   client then compares it with the former draft and leaves the rewritten fields editable; Save
   persists any subsequent manual cleanup through the normal revision-checked draft update.
9. Explicit approval finalizes the document. The independent RAG preference controls whether it is
   eligible for viewpoint-labeled retrieval.

The implemented slice covers dedicated storage, authenticated manual drafts, natural-language
generation, approval/archive lifecycle, the independent RAG preference, and viewpoint-labeled live
retrieval. Targeted AI rewrite/edit is now implemented for drafts without adding version history.

## Model Routing and Cost Records

Use the existing model catalog and user override rather than a new model registry:

- candidate extraction and metadata: default extraction model or a user-selected low-cost model;
- final document: user-selected model, with a recommendation based on document type;
- editing: targeted context and the selected model, never automatic full regeneration.

For the prototype, preserve `model`, `promptVersion`, estimated input/output tokens, and optional
provider usage inside a generation-run object referenced by the lore draft. Do not put mutable price
tables into lore itself.

Before session-level accounting, add a separate `generation_runs` table owned by `userId` with:

- `generationRunId`, `taskType`, `sessionId`, and optional `loreId`;
- platform, provider, model, and prompt version;
- estimated and actual input/output tokens;
- input/output unit prices captured at execution time;
- estimated and actual cost;
- status, elapsed time, and timestamps.

OpenRouter catalog pricing can be captured when available. Direct-provider pricing needs an explicit
maintained rate source and must be nullable rather than guessed. Provider-reported token usage should
be captured in `llmService` and returned as invocation metadata before actual-cost UI is promised.

## Recommended Next Implementation Sequence

1. Use the completed server-only RAG trace during the human quality pass.
2. Build the ten human quality cases and record answer-level judgments.
3. Add the authenticated retrieval-only debug endpoint only if local traces are insufficient.
4. Tune thresholds, filters, and ranking from the human results.
5. Evaluate generated, rewritten, and manually authored documents in focused retrieval scenarios.
6. Decide whether normalized provenance, generation runs, and versioning are justified.

Image generation remains a separate milestone after document generation.

## Lore Retrieval Preference

- Lore and document JSONB use the same `retrievalEnabled` field name.
- Only `retrievalEnabled === true` is eligible for semantic retrieval or chat-turn enrichment.
  Missing values remain disabled until the owner explicitly enables them.
- Character and world lore use separate read and edit APIs: read views receive only enabled entries,
  while an owner editing the character receives every entry.
- An owned session's memory API returns every session-scoped entry so disabled memories remain
  visible and editable. RAG and enrichment use the separate enabled candidate path.
- Disabling lore preserves its embedding. Re-enabling queues an idempotent embedding replacement,
  which reuses the existing vector when content, model, and content hash are unchanged.
