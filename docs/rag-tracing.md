# Development RAG Tracing

RAG tracing records retrieval evidence in the existing structured development log. It is disabled
by default and cannot be enabled in production or test mode.

## Enable locally

Set the following in the local development environment and restart the server:

```text
NODE_ENV=development
RITA_RAG_TRACE=true
```

Run a normal authenticated chat request, then inspect entries whose `module` is `ragTrace` in:

```text
logs/rita-combined-flow.jsonl
```

Disable the flag after inspection. The trace is local runtime output and must not be committed.

## Recorded events

- `query.transformed`: transformed query texts, critical term, and extracted filter criteria.
- `search.results`: source scope, query index, embedding-cache reuse, candidate IDs, rank, and cosine
  distance for one vector query.
- `search.complete`: deduplicated semantic ranking for one memory source search.
- `retrieval.selected`: keyword fallback IDs and final chat, lore, history, and recap selections.
- `retrieval.failed`: error name and message when recall falls back to short-term context.

Every event includes a request-local trace ID plus session, user, character, message, and sequence
context. Retrieved document content, prompts, requests, responses, and memory chunks are removed by
the trace utility even if a caller includes them accidentally.

Transformed query text and extracted terms can still contain private conversation details. Treat
the JSONL file as sensitive local debugging data and do not upload or commit it.

## Current boundary

This is the first inspection layer. It does not add an API endpoint, persist evaluation judgments,
generate an answer, or call an extra LLM. The authenticated retrieval-only inspection endpoint
described in `docs/rag-quality-and-lore-prototype.md` remains a later option if local traces are not
sufficient for the human evaluation workflow.
