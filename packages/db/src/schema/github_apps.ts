import { pgTable, uuid, text, timestamp, jsonb, integer } from "drizzle-orm/pg-core";

export const githubApps = pgTable("github_apps", {
  id: uuid("id").primaryKey().defaultRandom(),
  githubAppId: integer("github_app_id").notNull(),
  githubAppSlug: text("github_app_slug").notNull(),
  appName: text("app_name").notNull(),
  clientId: text("client_id").notNull(),
  clientSecretEncrypted: text("client_secret_encrypted").notNull(),
  privateKeyEncrypted: text("private_key_encrypted").notNull(),
  webhookSecretEncrypted: text("webhook_secret_encrypted").notNull(),
  permissions: jsonb("permissions").$type<Record<string, string>>(),
  events: jsonb("events").$type<string[]>(),
  htmlUrl: text("html_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
