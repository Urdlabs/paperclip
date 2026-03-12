import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const skillProfiles = pgTable(
  "skill_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    systemPromptAdditions: text("system_prompt_additions").notNull(),
    toolPreferences: jsonb("tool_preferences").$type<Record<string, unknown>>(),
    outputFormatHints: text("output_format_hints"),
    isBuiltin: boolean("is_builtin").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companySlugIdx: uniqueIndex("skill_profiles_company_slug_idx").on(table.companyId, table.slug),
    companyIdx: index("skill_profiles_company_idx").on(table.companyId),
  }),
);
