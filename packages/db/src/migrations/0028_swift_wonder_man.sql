ALTER TABLE "issues" ADD COLUMN "external_url" text;--> statement-breakpoint
CREATE INDEX "issues_external_url_idx" ON "issues" USING btree ("external_url");