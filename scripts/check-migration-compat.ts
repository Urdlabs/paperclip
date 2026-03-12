/**
 * Migration Compatibility Check Script
 *
 * Verifies that upstream's renumbered migrations (0031-0032) apply cleanly
 * against a fork-state database where migrations 0000-0030 are already applied.
 *
 * When to run:
 *   Before applying new migrations on production/staging databases, to ensure
 *   upstream schema additions (new tables, columns) don't conflict with fork's
 *   existing schema.
 *
 * How to run:
 *   DATABASE_URL=postgres://user:pass@host:5432/dbname npx tsx scripts/check-migration-compat.ts
 *
 * Exit codes:
 *   0 - All migrations are compatible
 *   1 - Compatibility check failed (see error output)
 */

import postgres from "postgres";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error(
    "Usage: DATABASE_URL=postgres://user:pass@host:5432/dbname npx tsx scripts/check-migration-compat.ts",
  );
  process.exit(1);
}

const MIGRATIONS_DIR = resolve(
  import.meta.dirname ?? __dirname,
  "../packages/db/src/migrations",
);

const MIGRATION_FILES = [
  "0031_lying_pete_wisdom.sql",
  "0032_tranquil_tenebrous.sql",
] as const;

const DRIZZLE_MIGRATIONS_TABLE = "__drizzle_migrations";

function splitStatements(content: string): string[] {
  return content
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function checkForkMigrationsApplied(
  sql: ReturnType<typeof postgres>,
): Promise<{ applied: boolean; count: number }> {
  // Check if the drizzle migrations table exists
  const tableRows = await sql`
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = ${DRIZZLE_MIGRATIONS_TABLE}
      AND c.relkind = 'r'
    LIMIT 1
  `;

  if (tableRows.length === 0) {
    return { applied: false, count: 0 };
  }

  // Discover which schema the migration table lives in
  const schemaRows = await sql<{ schema_name: string }[]>`
    SELECT n.nspname AS schema_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = ${DRIZZLE_MIGRATIONS_TABLE}
      AND c.relkind = 'r'
    ORDER BY CASE WHEN n.nspname = 'drizzle' THEN 0 WHEN n.nspname = 'public' THEN 1 ELSE 2 END
    LIMIT 1
  `;

  const schema = schemaRows[0]?.schema_name ?? "drizzle";
  const qualifiedTable = `"${schema}"."${DRIZZLE_MIGRATIONS_TABLE}"`;

  const countRows = await sql.unsafe<{ count: number }[]>(
    `SELECT count(*)::int AS count FROM ${qualifiedTable}`,
  );

  const count = countRows[0]?.count ?? 0;
  // Fork has 31 migrations (0000-0030)
  return { applied: count >= 31, count };
}

async function main(): Promise<void> {
  const sql = postgres(DATABASE_URL!, { max: 1 });

  try {
    console.log("Checking fork migration state...");
    const { applied, count } = await checkForkMigrationsApplied(sql);

    if (!applied) {
      console.warn(
        `WARNING: Expected at least 31 applied migrations (fork 0000-0030), found ${count}.`,
      );
      console.warn(
        "This script expects a fork-state database. Results may not be meaningful.",
      );
    } else {
      console.log(`Found ${count} applied migrations. Fork state confirmed.`);
    }

    // Read the migration SQL files
    const migrations: Array<{ name: string; sql: string }> = [];
    for (const file of MIGRATION_FILES) {
      const filePath = resolve(MIGRATIONS_DIR, file);
      try {
        const content = readFileSync(filePath, "utf8");
        migrations.push({ name: file, sql: content });
      } catch (err) {
        console.error(`FAIL: Could not read migration file: ${filePath}`);
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    }

    console.log("\nDry-run applying migrations in a rolled-back transaction...\n");

    // Use a SAVEPOINT approach inside a transaction so we can rollback cleanly
    await sql.unsafe("BEGIN");

    try {
      for (const migration of migrations) {
        console.log(`  Applying ${migration.name}...`);
        const statements = splitStatements(migration.sql);

        for (let i = 0; i < statements.length; i++) {
          try {
            await sql.unsafe(statements[i]);
          } catch (err) {
            const message =
              err instanceof Error ? err.message : String(err);
            console.error(`\n  FAIL in ${migration.name}, statement ${i + 1}:`);
            console.error(`  SQL: ${statements[i].slice(0, 200)}...`);
            console.error(`  Error: ${message}`);

            // Check for common conflict types
            if (message.includes("already exists")) {
              console.error(
                "  Conflict type: Duplicate object (table, column, index, or constraint already exists)",
              );
            } else if (message.includes("violates foreign key")) {
              console.error("  Conflict type: Foreign key violation");
            } else if (message.includes("does not exist")) {
              console.error(
                "  Conflict type: Missing dependency (referenced table/column does not exist)",
              );
            }

            console.error("\nFAIL: migration compatibility check failed");
            // Rollback before exiting
            try {
              await sql.unsafe("ROLLBACK");
            } catch {
              // Ignore rollback errors
            }
            await sql.end();
            process.exit(1);
          }
        }

        console.log(`  OK: ${migration.name} applied successfully`);
      }

      // Rollback -- we only check compatibility, not persisting changes
      await sql.unsafe("ROLLBACK");
      console.log("\n  Transaction rolled back (dry-run only).\n");
    } catch (err) {
      try {
        await sql.unsafe("ROLLBACK");
      } catch {
        // Ignore rollback errors
      }
      throw err;
    }

    console.log(
      "PASS: migrations 0031-0032 are compatible with fork-state database",
    );
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
