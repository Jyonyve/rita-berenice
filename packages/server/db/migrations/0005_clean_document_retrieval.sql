WITH "document_preferences" AS (
  SELECT
    "document_id",
    "status",
    CASE
      WHEN "status" = 'archived' THEN false
      WHEN jsonb_typeof("data" -> 'includeInRag') = 'boolean'
        THEN ("data" ->> 'includeInRag')::boolean
      WHEN jsonb_typeof("data" -> 'retrievalEnabled') = 'boolean'
        THEN ("data" ->> 'retrievalEnabled')::boolean
      ELSE "retrieval_enabled"
    END AS "retrieval_preference"
  FROM "documents"
),
"normalized_documents" AS (
  SELECT
    "document_id",
    "retrieval_preference",
    CASE
      WHEN "status" = 'approved' THEN "retrieval_preference"
      ELSE false
    END AS "normalized_retrieval_enabled"
  FROM "document_preferences"
)
UPDATE "documents" AS "document"
SET
  "retrieval_enabled" = "normalized"."normalized_retrieval_enabled",
  "data" = jsonb_set(
    "document"."data" - 'includeInRag',
    '{retrievalEnabled}',
    to_jsonb("normalized"."retrieval_preference"),
    true
  )
FROM "normalized_documents" AS "normalized"
WHERE
  "document"."document_id" = "normalized"."document_id"
  AND (
    "document"."data" ? 'includeInRag'
    OR "document"."retrieval_enabled" IS DISTINCT FROM "normalized"."normalized_retrieval_enabled"
    OR "document"."data" -> 'retrievalEnabled'
      IS DISTINCT FROM to_jsonb("normalized"."retrieval_preference")
  );
