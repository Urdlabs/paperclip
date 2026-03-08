CREATE TABLE "github_app_installations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"github_app_id" uuid NOT NULL,
	"installation_id" integer NOT NULL,
	"account_login" text NOT NULL,
	"account_type" text NOT NULL,
	"repository_selection" text,
	"suspended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_apps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"github_app_id" integer NOT NULL,
	"github_app_slug" text NOT NULL,
	"app_name" text NOT NULL,
	"client_id" text NOT NULL,
	"client_secret_encrypted" text NOT NULL,
	"private_key_encrypted" text NOT NULL,
	"webhook_secret_encrypted" text NOT NULL,
	"permissions" jsonb,
	"events" jsonb,
	"html_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "github_app_installations" ADD CONSTRAINT "github_app_installations_github_app_id_github_apps_id_fk" FOREIGN KEY ("github_app_id") REFERENCES "public"."github_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "github_app_installations_app_idx" ON "github_app_installations" USING btree ("github_app_id");--> statement-breakpoint
CREATE INDEX "github_app_installations_installation_id_idx" ON "github_app_installations" USING btree ("installation_id");