CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "characters" (
	"character_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"show_name" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_turns" (
	"chat_turn_id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"character_id" text NOT NULL,
	"profile_id" text NOT NULL,
	"user_id" text NOT NULL,
	"sequence" integer NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credentials" (
	"user_id" text PRIMARY KEY NOT NULL,
	"encrypted_data" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finalization_jobs" (
	"job_id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"sequence" integer NOT NULL,
	"status" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"input" jsonb NOT NULL,
	"result" jsonb,
	"error" text,
	"locked_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "histories" (
	"history_id" text PRIMARY KEY NOT NULL,
	"character_id" text NOT NULL,
	"user_id" text NOT NULL,
	"category" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lores" (
	"lore_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"lore_type" text NOT NULL,
	"category" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memory_embeddings" (
	"embedding_id" text PRIMARY KEY NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"content_type" text NOT NULL,
	"user_id" text NOT NULL,
	"character_id" text,
	"session_id" text,
	"content" text NOT NULL,
	"content_hash" text NOT NULL,
	"embedding_model" text NOT NULL,
	"embedding_version" integer DEFAULT 1 NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"profile_id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"user_id" text NOT NULL,
	"show_name" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recaps" (
	"recap_id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"character_id" text NOT NULL,
	"user_id" text NOT NULL,
	"recap_type" text NOT NULL,
	"turn_start" integer NOT NULL,
	"turn_end" integer NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"character_id" text NOT NULL,
	"profile_id" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "temp_chat_turns" (
	"session_id" text NOT NULL,
	"sequence" integer NOT NULL,
	"user_id" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "temp_chat_turns_session_id_sequence_pk" PRIMARY KEY("session_id","sequence")
);
--> statement-breakpoint
CREATE TABLE "terms" (
	"term_id" text PRIMARY KEY NOT NULL,
	"term_type" text NOT NULL,
	"character_id" text NOT NULL,
	"session_id" text,
	"korean_term" text NOT NULL,
	"english_term" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"user_id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"show_name" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_turns" ADD CONSTRAINT "chat_turns_session_id_sessions_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("session_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_session_id_sessions_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("session_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recaps" ADD CONSTRAINT "recaps_session_id_sessions_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("session_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_character_id_characters_character_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("character_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temp_chat_turns" ADD CONSTRAINT "temp_chat_turns_session_id_sessions_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("session_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "characters_user_id_idx" ON "characters" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "characters_show_name_idx" ON "characters" USING btree ("show_name");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_turns_session_sequence_unique" ON "chat_turns" USING btree ("session_id","sequence");--> statement-breakpoint
CREATE INDEX "chat_turns_character_id_idx" ON "chat_turns" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "finalization_jobs_status_idx" ON "finalization_jobs" USING btree ("status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "finalization_jobs_session_sequence_unique" ON "finalization_jobs" USING btree ("session_id","sequence");--> statement-breakpoint
CREATE INDEX "histories_character_id_idx" ON "histories" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "lores_user_id_idx" ON "lores" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "memory_embeddings_source_idx" ON "memory_embeddings" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "memory_embeddings_session_idx" ON "memory_embeddings" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "memory_embeddings_character_idx" ON "memory_embeddings" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "memory_embeddings_hnsw_idx" ON "memory_embeddings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "profiles_user_id_idx" ON "profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_session_id_unique" ON "profiles" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "recaps_session_type_idx" ON "recaps" USING btree ("session_id","recap_type");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_character_id_idx" ON "sessions" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "temp_chat_turns_user_id_idx" ON "temp_chat_turns" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "terms_character_id_idx" ON "terms" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "terms_session_id_idx" ON "terms" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "terms_scope_korean_unique" ON "terms" USING btree ("term_type","character_id","session_id","korean_term");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_show_name_unique" ON "users" USING btree ("show_name");
