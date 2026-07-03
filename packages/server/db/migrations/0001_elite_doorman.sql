DROP INDEX "terms_scope_korean_unique";--> statement-breakpoint
ALTER TABLE "terms" ADD COLUMN "scope_id" text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "terms_scope_korean_unique" ON "terms" USING btree ("term_type","scope_id","korean_term");