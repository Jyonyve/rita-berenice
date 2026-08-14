CREATE TABLE "documents" (
	"document_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"session_id" text NOT NULL,
	"character_id" text NOT NULL,
	"origin" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"retrieval_enabled" boolean DEFAULT false NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "documents_origin_check" CHECK ("documents"."origin" in ('manual', 'generated')),
	CONSTRAINT "documents_status_check" CHECK ("documents"."status" in ('draft', 'approved', 'archived')),
	CONSTRAINT "documents_retrieval_requires_approval_check" CHECK (not "documents"."retrieval_enabled" or "documents"."status" = 'approved')
);
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_session_id_sessions_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("session_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_character_id_characters_character_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("character_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_user_session_idx" ON "documents" USING btree ("user_id","session_id");--> statement-breakpoint
CREATE INDEX "documents_retrieval_idx" ON "documents" USING btree ("user_id","session_id","status","retrieval_enabled");