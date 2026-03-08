import { pgTable, uuid, text, timestamp, integer, index } from "drizzle-orm/pg-core";
import { githubApps } from "./github_apps.js";

export const githubAppInstallations = pgTable(
  "github_app_installations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    githubAppId: uuid("github_app_id")
      .notNull()
      .references(() => githubApps.id, { onDelete: "cascade" }),
    installationId: integer("installation_id").notNull(),
    accountLogin: text("account_login").notNull(),
    accountType: text("account_type").notNull(),
    repositorySelection: text("repository_selection"),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    appIdx: index("github_app_installations_app_idx").on(table.githubAppId),
    installationIdIdx: index("github_app_installations_installation_id_idx").on(table.installationId),
  }),
);
