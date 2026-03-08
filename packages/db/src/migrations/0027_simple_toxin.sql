ALTER TABLE "github_apps" ADD COLUMN "company_id" uuid;--> statement-breakpoint
ALTER TABLE "github_apps" ADD CONSTRAINT "github_apps_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "github_apps_company_idx" ON "github_apps" USING btree ("company_id");