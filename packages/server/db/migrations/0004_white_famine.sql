ALTER TABLE "finalization_jobs" ADD COLUMN "error_code" text;--> statement-breakpoint
ALTER TABLE "finalization_jobs" ADD COLUMN "key_type" text;--> statement-breakpoint
ALTER TABLE "finalization_jobs" ADD COLUMN "resume_count" integer DEFAULT 0 NOT NULL;