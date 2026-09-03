CREATE TABLE "lore_character_links" (
	"lore_id" text NOT NULL,
	"character_id" text NOT NULL,
	CONSTRAINT "lore_character_links_lore_id_character_id_pk" PRIMARY KEY("lore_id","character_id")
);
--> statement-breakpoint
DROP INDEX "lores_user_id_idx";--> statement-breakpoint
ALTER TABLE "lores" ADD COLUMN "session_id" text;--> statement-breakpoint
ALTER TABLE "lores" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "lores" ADD COLUMN "generated_title" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "lores" ADD COLUMN "content" text;--> statement-breakpoint
ALTER TABLE "lores" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "lores" ADD COLUMN "retrieval_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "lores" ADD COLUMN "keyword_list" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "lores" ADD COLUMN "topic_list" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "lores" ADD COLUMN "entity_list" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
UPDATE "lores"
SET
	"session_id" = CASE
		WHEN jsonb_typeof("data" -> 'sessionId') = 'string'
			THEN NULLIF(btrim("data" ->> 'sessionId'), '')
		ELSE NULL
	END,
	"title" = COALESCE(
		NULLIF(btrim("data" ->> 'title'), ''),
		NULLIF(btrim("data" ->> 'generatedTitle'), ''),
		"lore_id"
	),
	"generated_title" = COALESCE("data" ->> 'generatedTitle', ''),
	"content" = COALESCE("data" ->> 'content', ''),
	"source" = NULLIF("data" ->> 'source', ''),
	"retrieval_enabled" = CASE
		WHEN jsonb_typeof("data" -> 'retrievalEnabled') = 'boolean'
			THEN ("data" ->> 'retrievalEnabled')::boolean
		ELSE true
	END,
	"keyword_list" = ARRAY(
		SELECT jsonb_array_elements_text(
			CASE WHEN jsonb_typeof("data" -> 'keywordList') = 'array' THEN "data" -> 'keywordList' ELSE '[]'::jsonb END
		)
	),
	"topic_list" = ARRAY(
		SELECT jsonb_array_elements_text(
			CASE WHEN jsonb_typeof("data" -> 'topicList') = 'array' THEN "data" -> 'topicList' ELSE '[]'::jsonb END
		)
	),
	"entity_list" = ARRAY(
		SELECT jsonb_array_elements_text(
			CASE WHEN jsonb_typeof("data" -> 'entityList') = 'array' THEN "data" -> 'entityList' ELSE '[]'::jsonb END
		)
	);--> statement-breakpoint
INSERT INTO "lore_character_links" ("lore_id", "character_id")
SELECT DISTINCT "lores"."lore_id", "characters"."character_id"
FROM "lores"
CROSS JOIN LATERAL jsonb_array_elements_text(
	CASE WHEN jsonb_typeof("lores"."data" -> 'characterIds') = 'array'
		THEN "lores"."data" -> 'characterIds'
		ELSE '[]'::jsonb
	END
) AS "characters"("character_id")
WHERE btrim("characters"."character_id") <> '';--> statement-breakpoint
ALTER TABLE "lores" ALTER COLUMN "title" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lores" ALTER COLUMN "content" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lore_character_links" ADD CONSTRAINT "lore_character_links_lore_id_lores_lore_id_fk" FOREIGN KEY ("lore_id") REFERENCES "public"."lores"("lore_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "lore_character_links_character_idx" ON "lore_character_links" USING btree ("character_id","lore_id");--> statement-breakpoint
ALTER TABLE "lores" ADD CONSTRAINT "lores_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lores" ADD CONSTRAINT "lores_session_id_sessions_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("session_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lores_user_session_idx" ON "lores" USING btree ("user_id","session_id");--> statement-breakpoint
CREATE INDEX "lores_retrieval_scope_idx" ON "lores" USING btree ("user_id","session_id","category") WHERE "lores"."retrieval_enabled" = true;--> statement-breakpoint
ALTER TABLE "lores" DROP COLUMN "data";--> statement-breakpoint
ALTER TABLE "lores" ADD CONSTRAINT "lores_type_check" CHECK ("lores"."lore_type" in ('world', 'lore'));--> statement-breakpoint
ALTER TABLE "lores" ADD CONSTRAINT "lores_world_category_check" CHECK (("lores"."lore_type" = 'world' and "lores"."category" = 'World') or ("lores"."lore_type" = 'lore' and "lores"."category" <> 'World'));--> statement-breakpoint
ALTER TABLE "lores" ADD CONSTRAINT "lores_session_length_check" CHECK ("lores"."session_id" is null or (char_length("lores"."title") between 1 and 100 and char_length("lores"."content") between 1 and 1500));
