# Phase 5: Merge Preparation - Research

**Researched:** 2026-03-12
**Domain:** Git merge conflict analysis, Drizzle ORM migration management, fork feature inventory
**Confidence:** HIGH

## Summary

Phase 5 prepares the fork for a safe, reversible upstream merge without performing any actual merge. The work is purely analytical and preparatory: mapping all 16 conflicting files with resolution strategies, resolving the Drizzle migration numbering collision (both sides used 0026-0027), creating a rollback safety net via git tags/branches, and documenting every v1.0-specific code path with canary tests.

A dry-run merge (`git merge --no-commit --no-ff upstream/master`) confirms exactly 16 conflicting files spanning DB migrations (3), server (4), UI (5), shared packages (1), infrastructure (2), and lockfile (1). The hardest conflicts are `server/src/index.ts` (973 lines on fork vs 693 on upstream, both export `startServer()` but with heavily divergent bodies) and `server/src/services/heartbeat.ts` (2892 lines on fork vs 2550 on upstream, both heavily modified). The migration collision is clean: fork's 0026-0030 and upstream's 0026-0027 create entirely different tables with no schema overlap, making renumbering straightforward.

**Primary recommendation:** Execute all four deliverables as documentation artifacts and scripts -- no code changes to the running application. The conflict map, migration renumbering, rollback tags, and feature manifest are preparation work that de-risks phases 6-7.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Renumber upstream's migrations (0026-0027) to 0031-0032, keeping fork's deployed migrations (0026-0030) untouched
- Auto-regenerate Drizzle journal and snapshot files, then verify with `drizzle-kit generate` producing no diff
- Generate a migration compatibility check script that verifies upstream's new tables/columns don't conflict with fork's existing schema on deployed databases
- Deployed production/staging databases exist with fork migrations already applied -- no destructive changes to migration numbering on fork side
- Create both a git tag (`pre-upstream-sync`) AND a branch (`pre-upstream-sync-backup`) before any merge work
- Tag each merge chunk for granular rollback (e.g., `post-chunk-1-db`, `post-chunk-2-server`)
- Use merge commits throughout so both per-chunk revert (`git revert -m 1`) and full reset to tag are available
- Recovery decision (revert chunk vs. start over) made at the time based on severity
- Markdown checklist of all v1.0-specific routes, services, DB exports, and UI components grouped by feature area
- Canary tests covering both import/export verification (all v1.0 modules export expected symbols) AND API endpoint smoke tests (hit each v1.0 endpoint, verify 200 + correct response shape)
- Canary tests integrated into existing test suite as permanent regression tests (not a separate file)
- Per-file strategy notes for all 16 conflicting files: area category, what fork changed, what upstream changed, resolution strategy (keep ours/theirs/manual merge)
- Deep-dive line-by-line analysis for the 2-3 hardest conflicts: `server/src/index.ts` and `server/src/services/heartbeat.ts`
- Conflict map stored at `.planning/CONFLICT-MAP.md` for easy access during merge phases 6-7

### Claude's Discretion
- Exact format and grouping of the conflict map document
- Which v1.0 API endpoints are most critical for canary smoke tests
- Level of detail in per-file strategy notes for non-critical conflicts

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PREP-01 | All upstream conflicts are mapped and categorized by area (DB, server, UI, infra) before merge begins | Dry-run merge identified all 16 conflicts; full categorization and resolution strategies documented below |
| PREP-02 | Fork state is tagged as rollback point before any merge work | Git tag and branch strategy researched; existing tags inventory shows `v1.0` exists as precedent |
| PREP-03 | Drizzle migration collision is resolved -- fork migrations renumbered to avoid overlap with upstream 0026-0027 | NOTE: REQUIREMENTS.md says "fork migrations renumbered" but CONTEXT.md locks the decision as "renumber UPSTREAM's migrations to 0031-0032, keeping fork's deployed migrations untouched." CONTEXT.md overrides. Full journal/snapshot chain analyzed. |
| PREP-04 | Fork feature manifest documents all v1.0-specific code paths for post-merge verification | Fork-only files, exports, routes, services, and schema tables fully inventoried below |
</phase_requirements>

## Standard Stack

This phase produces documentation and scripts, not application code. The tools used are git, Drizzle Kit, and the existing Vitest test suite.

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| git | system | Conflict detection, tagging, branching | Already configured with `upstream` remote pointing to `paperclipai/paperclip` |
| drizzle-kit | workspace | Migration generation and verification | Project uses `pnpm --filter @paperclipai/db generate` which runs `tsc && drizzle-kit generate` |
| vitest | workspace | Canary test runner | 411 existing tests, root `pnpm test:run` runs full suite |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| `pnpm --filter @paperclipai/db typecheck` | Verify schema compiles after migration changes | After renumbering upstream migrations |
| `git merge --no-commit --no-ff upstream/master` | Dry-run conflict detection | Already executed -- 16 conflicts confirmed |
| `git diff --stat master upstream/master` | Quantify divergence | 459 files changed, 22636 insertions, 52852 deletions |

## Architecture Patterns

### Conflict Map Structure (Recommended)

Group the 16 conflicting files by area for the `.planning/CONFLICT-MAP.md`:

```
## DB Migrations (3 files)
  packages/db/src/migrations/meta/_journal.json
  packages/db/src/migrations/meta/0026_snapshot.json
  packages/db/src/migrations/meta/0027_snapshot.json

## Server (4 files)
  server/src/app.ts
  server/src/index.ts
  server/src/services/heartbeat.ts
  server/src/services/issues.ts

## UI (5 files)
  ui/src/App.tsx
  ui/src/components/agent-config-primitives.tsx
  ui/src/lib/queryKeys.ts
  ui/src/pages/AgentDetail.tsx
  ui/src/pages/Costs.tsx

## Shared Packages (1 file)
  packages/adapter-utils/src/index.ts

## Infrastructure (2 files)
  Dockerfile
  ui/package.json

## Lockfile (1 file)
  pnpm-lock.yaml
```

### Migration Renumbering Pattern

The Drizzle migration system has three coupled artifacts per migration:
1. **SQL file**: `NNNN_name.sql` -- the actual DDL
2. **Snapshot file**: `meta/NNNN_snapshot.json` -- full schema state at that point, with `id` and `prevId` forming a linked chain
3. **Journal entry**: `meta/_journal.json` -- array of `{idx, tag, when}` objects mapping indices to SQL file names (without `.sql` extension)

The snapshot chain for the collision zone:

```
0025_nasty_salo (id: bd8d9b8d) -- LAST COMMON ANCESTOR
  |
  +-- Fork 0026_rainy_blade (id: a9f2e716, prevId: bd8d9b8d)
  |     +-- Fork 0027_simple_toxin (id: 78c74e4d, prevId: a9f2e716)
  |     +-- Fork 0028_swift_wonder_man
  |     +-- Fork 0029_common_sheva_callister
  |     +-- Fork 0030_sharp_korath (id: 98d8d3db)
  |
  +-- Upstream 0026_lying_pete_wisdom (id: 5f8dd541, prevId: bd8d9b8d)
        +-- Upstream 0027_tranquil_tenebrous (id: 8186209d, prevId: 5f8dd541)
```

**Renumbering plan** (upstream's 2 migrations become 0031-0032):

| Original | Renamed | SQL Content |
|----------|---------|-------------|
| `0026_lying_pete_wisdom.sql` | `0031_lying_pete_wisdom.sql` | CREATE TABLE workspace_runtime_services (new table, no conflict with fork) |
| `0027_tranquil_tenebrous.sql` | `0032_tranquil_tenebrous.sql` | ALTER issues ADD execution_workspace_settings; ALTER projects ADD execution_workspace_policy (new columns on existing tables, no conflict) |

Files to create/modify during renumbering:
1. Copy upstream's `0026_lying_pete_wisdom.sql` to `0031_lying_pete_wisdom.sql`
2. Copy upstream's `0027_tranquil_tenebrous.sql` to `0032_tranquil_tenebrous.sql`
3. Copy upstream's `0026_snapshot.json` to `0031_snapshot.json`, update `id` field (keep content, just rename)
4. Copy upstream's `0027_snapshot.json` to `0032_snapshot.json`, update `prevId` to match new 0031's id
5. Update `_journal.json`: keep fork entries idx 0-30 unchanged, add upstream entries as idx 31 (`tag: "0031_lying_pete_wisdom"`) and idx 32 (`tag: "0032_tranquil_tenebrous"`)
6. Update the `prevId` of `0031_snapshot.json` to point to fork's `0030_sharp_korath` snapshot id (`98d8d3db-3326-44d2-ad42-7359ac325102`)

**Critical detail**: The snapshot `prevId` chain MUST be continuous. After renumbering: 0030 (fork) -> 0031 (upstream, renumbered) -> 0032 (upstream, renumbered). The upstream 0031's `prevId` must be set to fork 0030's `id`.

### Feature Manifest Pattern

The manifest should inventory fork-only additions by category. Based on research, here are the fork-only artifacts:

**Fork-only DB schema files** (6):
- `github_app_installations.ts` / `github_apps.ts` -- GitHub App integration
- `issue_dependencies.ts` -- task dependency graph
- `webhook_endpoints.ts` / `webhook_deliveries.ts` -- outgoing webhooks
- `skill_profiles.ts` -- agent skill profiles

**Fork-only DB exports** (in schema/index.ts, not in upstream):
- `githubApps`, `githubAppInstallations`
- `issueDependencies`
- `webhookEndpoints`, `webhookDeliveries`
- `skillProfiles`

**Fork-only server routes** (in routes/index.ts, not in upstream):
- `githubRoutes`, `githubWebhookRoute` (from `./github.js`)
- `webhookRoutes` (from `./webhooks.js`)
- `skillProfileRoutes` (from `./skill-profiles.js`)

**Fork-only server services** (in services/index.ts, not in upstream):
- `githubAppService` -- GitHub App lifecycle
- `createUsageTracker` -- Claude usage streaming
- `resolveBudget`, `isBudgetExceeded`, `isWindDownThreshold` -- budget management
- `webhookService` -- webhook CRUD
- `startWebhookDispatcher`, `mapLiveEventToWebhookEvent` -- webhook dispatch
- `codeReviewService` -- code review orchestration
- `topologicalSort`, `validateNoCycle`, `getExecutionWaves` -- dependency graph
- `skillProfileService` -- skill profile CRUD
- `estimateTokens`, `estimatePromptBreakdown`, `computeContextUtilization` -- token estimation

**Fork-only server service files** (not in upstream):
- `budget.ts`, `claude-usage-streaming.ts`, `code-review.ts`
- `dependency-graph.ts`, `github-app.ts`
- `review-providers/` (directory), `skill-profiles.ts`
- `token-estimation.ts`, `webhook-dispatcher.ts`, `webhooks.ts`

**Fork-only shared package exports** (in shared/src/index.ts):
- `MODEL_CONTEXT_LIMITS`, `DEFAULT_CONTEXT_LIMIT`, `getContextWindowSize` (from `model-context-limits.js`)
- `TokenBreakdown`, `UsageJsonExtended`, `BudgetInfo` types (from `types/usage.js`)
- `GitHubAppConfig`, `GitHubAppInstallation`, `GitHubAppStatus` types (from `types/github.js`)
- `TaskType`, `TaskTypeTemplateConfig`, `LabelMapping`, `TASK_TYPES` (from `types/task-types.js`)
- `WebhookEndpoint`, `WebhookDelivery`, `WebhookPayload` types (from `types/webhooks.js`)
- `SkillProfile`, `SkillProfileSummary` types (from `types/skill-profiles.js`)

**Fork-only UI components**:
- `ActivityFilterBar.tsx` -- activity feed filtering
- `AnalyticsCharts.tsx` -- token analytics charts
- `BudgetBar.tsx` -- budget visualization
- `ContextUtilizationBar.tsx` -- context window visualization
- `SkillProfileSelector.tsx` -- skill profile picker
- `SubtaskTree.tsx` -- task decomposition tree
- `TokenBreakdown.tsx` -- token usage breakdown
- `TraceNode.tsx` / `TraceView.tsx` -- trace visualization
- `WebhookDeliveryLog.tsx` / `WebhookEndpointList.tsx` -- webhook management

**Fork-only UI pages**:
- `GitHubSetupComplete.tsx` -- GitHub App setup callback

**Upstream-only additions (will arrive with merge)**:
- UI pages: `InstanceSettings.tsx`, `NotFound.tsx`, `RunTranscriptUxLab.tsx`
- UI components: `InstanceSidebar.tsx`, `IssueRow.tsx`, `ScrollToBottom.tsx`, `transcript/` directory
- Server services: `execution-workspace-policy.ts`, `heartbeat-run-summary.ts`, `issue-goal-fallback.ts`, `workspace-runtime.ts`

### Canary Test Pattern

Canary tests should be added to the existing test suite structure. The project uses:
- Server tests: `server/src/__tests__/*.test.ts` (374 tests, Vitest, node environment)
- UI tests: `ui/src/lib/*.test.ts` (37 tests, Vitest, jsdom environment)
- Run command: `pnpm test:run` (runs `vitest run` at root, discovers all workspace test files)

Recommended canary test files:
1. `server/src/__tests__/v1-feature-exports.test.ts` -- import verification for all fork-only modules
2. `server/src/__tests__/v1-api-smoke.test.ts` -- endpoint smoke tests (may need mock setup)

The import/export canary tests are most valuable because they catch silent module loss. They should verify:
- All fork-only schema tables are exported from `@paperclipai/db`
- All fork-only services are exported from `server/src/services/index.ts`
- All fork-only routes are exported from `server/src/routes/index.ts`
- All fork-only shared types are exported from `@paperclipai/shared`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Conflict detection | Manual file-by-file comparison | `git merge --no-commit --no-ff upstream/master` then `git diff --name-only --diff-filter=U` | Git's merge machinery is authoritative; manual comparison would miss auto-resolved conflicts |
| Migration snapshot chain | Manual JSON editing of snapshot prevId chain | Script that reads existing snapshots and programmatically updates ids | Snapshot files are 6000+ lines of JSON; hand-editing is error-prone |
| Migration verification | Visual inspection of journal consistency | `pnpm --filter @paperclipai/db generate` -- should produce no new migration files if schema matches | Drizzle Kit itself is the authority on whether migrations match the schema |
| Schema compatibility check | Manually comparing SQL CREATE statements | Script that runs upstream migrations against a test database with fork migrations already applied | Only a real database can verify FK constraints, column types, and index compatibility |

## Common Pitfalls

### Pitfall 1: Snapshot prevId Chain Breakage
**What goes wrong:** After renumbering upstream migrations from 0026-0027 to 0031-0032, the snapshot `prevId` chain is broken. Upstream's 0031 still points to upstream's 0025 as its predecessor, but it should now follow fork's 0030.
**Why it happens:** Drizzle snapshots form a linked list via `id`/`prevId` fields. Renaming files alone doesn't update the chain.
**How to avoid:** After copying snapshot files, update `0031_snapshot.json`'s `prevId` to fork `0030_snapshot.json`'s `id` (`98d8d3db-3326-44d2-ad42-7359ac325102`). Then update `0032_snapshot.json`'s `prevId` to 0031's `id`.
**Warning signs:** `drizzle-kit generate` produces unexpected migration files or errors about inconsistent history.

### Pitfall 2: Journal idx Mismatch
**What goes wrong:** Journal entries have an `idx` field that must match the migration's position in the array AND the file's numeric prefix.
**Why it happens:** When inserting upstream migrations at idx 31-32, the idx values must be 31 and 32, and the tags must match the renamed files (`0031_lying_pete_wisdom`, `0032_tranquil_tenebrous`).
**How to avoid:** Script the journal update rather than hand-editing. Validate that every entry's `idx` matches its array position.
**Warning signs:** Drizzle migration runner skips migrations or tries to apply them out of order.

### Pitfall 3: Forgetting the __drizzle_migrations Table
**What goes wrong:** The database's `__drizzle_migrations` table tracks which migrations have been applied. After renumbering, the applied migration names in the database won't match the new file names.
**Why it happens:** The fork's deployed databases have `__drizzle_migrations` rows referencing `0026_rainy_blade.sql` through `0030_sharp_korath.sql`. These stay correct. But upstream's migrations (now 0031-0032) are new and will be applied by Drizzle's `migrate()` function after the merge.
**How to avoid:** The fork's existing applied migrations are unaffected (they keep their original names). Only upstream's new migrations get renumbered, and they haven't been applied yet on any fork database. This is the entire reason for renumbering upstream (not fork) -- deployed databases are untouched.
**Warning signs:** Migration state shows "needsMigrations" with unexpected pending files.

### Pitfall 4: Incomplete Feature Manifest Causes Silent Regression
**What goes wrong:** A v1.0 feature is silently dropped during merge because it wasn't listed in the manifest.
**Why it happens:** Fork-only exports, route registrations, or service bindings are removed during conflict resolution without anyone noticing.
**How to avoid:** The canary tests verify every fork-only export exists. If a merge accidentally removes an export, the test fails immediately.
**Warning signs:** Tests pass but a feature is inaccessible at runtime because its route was never registered.

### Pitfall 5: Merge Commits vs Squash Confusion
**What goes wrong:** Using `git merge --squash` instead of regular merge commits eliminates the ability to `git revert -m 1` individual chunks.
**Why it happens:** Squash merges create a single commit without merge parents, so `git revert -m 1` (which requires a merge commit) fails.
**How to avoid:** Always use `git merge --no-ff` (not `--squash`) for each chunk merge. This creates proper merge commits that support both `git revert -m 1` for per-chunk rollback and `git reset --hard pre-upstream-sync` for full rollback.
**Warning signs:** `git log --merges` shows no merge commits after a chunk.

## Code Examples

### Example 1: Dry-Run Merge to Detect Conflicts

```bash
# This was already executed during research -- results confirmed 16 conflicts
git merge --no-commit --no-ff upstream/master
git diff --name-only --diff-filter=U  # Lists only unmerged (conflicting) files
git merge --abort  # Clean up without committing
```

Output (confirmed):
```
Dockerfile
packages/adapter-utils/src/index.ts
packages/db/src/migrations/meta/_journal.json
packages/db/src/migrations/meta/0026_snapshot.json
packages/db/src/migrations/meta/0027_snapshot.json
pnpm-lock.yaml
server/src/app.ts
server/src/index.ts
server/src/services/heartbeat.ts
server/src/services/issues.ts
ui/package.json
ui/src/App.tsx
ui/src/components/agent-config-primitives.tsx
ui/src/lib/queryKeys.ts
ui/src/pages/AgentDetail.tsx
ui/src/pages/Costs.tsx
```

### Example 2: Rollback Safety Net

```bash
# Create tag and backup branch before any merge work
git tag pre-upstream-sync
git branch pre-upstream-sync-backup

# After each merge chunk:
git tag post-chunk-1-db    # After DB layer merge
git tag post-chunk-2-server  # After server layer merge
git tag post-chunk-3-ui      # After UI layer merge

# Rollback options:
# Option A: Revert a single chunk (preserves later work)
git revert -m 1 <merge-commit-hash>

# Option B: Full reset to pre-merge state
git reset --hard pre-upstream-sync
```

### Example 3: Migration Journal Entry Format

```json
{
  "idx": 31,
  "version": "7",
  "when": 1772929157738,
  "tag": "0031_lying_pete_wisdom",
  "breakpoints": true
}
```

The `when` timestamp should be preserved from the original upstream entry. The `tag` must match the renamed file (without `.sql` extension). The `idx` must match the array position.

### Example 4: Canary Export Test Pattern

```typescript
// server/src/__tests__/v1-feature-exports.test.ts
import { describe, it, expect } from "vitest";

describe("v1.0 fork feature exports", () => {
  it("DB schema exports all fork-only tables", async () => {
    const db = await import("@paperclipai/db");
    expect(db.githubApps).toBeDefined();
    expect(db.githubAppInstallations).toBeDefined();
    expect(db.issueDependencies).toBeDefined();
    expect(db.webhookEndpoints).toBeDefined();
    expect(db.webhookDeliveries).toBeDefined();
    expect(db.skillProfiles).toBeDefined();
  });

  it("server services export all fork-only services", async () => {
    const services = await import("../services/index.js");
    expect(services.githubAppService).toBeDefined();
    expect(services.webhookService).toBeDefined();
    expect(services.skillProfileService).toBeDefined();
    expect(services.codeReviewService).toBeDefined();
    expect(services.topologicalSort).toBeDefined();
    expect(services.estimateTokens).toBeDefined();
    expect(services.createUsageTracker).toBeDefined();
    expect(services.startWebhookDispatcher).toBeDefined();
    expect(services.resolveBudget).toBeDefined();
  });

  it("server routes export all fork-only routes", async () => {
    const routes = await import("../routes/index.js");
    expect(routes.githubRoutes).toBeDefined();
    expect(routes.githubWebhookRoute).toBeDefined();
    expect(routes.webhookRoutes).toBeDefined();
    expect(routes.skillProfileRoutes).toBeDefined();
  });
});
```

## State of the Art

| Aspect | Current State | Impact |
|--------|---------------|--------|
| Fork divergence | 125 commits ahead, 228 behind upstream | 16 file conflicts, mostly auto-resolvable |
| Migration collision | Fork 0026-0030 vs Upstream 0026-0027 | Both branch from 0025; no schema overlap in SQL content |
| Upstream migration content | 0026: new `workspace_runtime_services` table; 0027: 2 new columns on existing tables | No conflict with fork's GitHub App, webhook, skill profile, or dependency tables |
| Fork's custom migration runner | Robust `inspectMigrations`/`reconcilePendingMigrationHistory` in `client.ts` | Handles hash-based and name-based migration tracking; renumbered files will be picked up correctly |
| Test baseline | 411 tests (374 server, 37 UI), all passing | Canary tests add to this baseline |

## Conflict Analysis (Deep Dive)

### server/src/index.ts (HARD -- manual merge required)

**Fork state:** 973 lines. Exports `startServer()` with inline server setup including all fork route registrations (github, webhooks, skill-profiles), webhook dispatcher startup, and token analytics middleware.

**Upstream state:** 693 lines. Also exports `startServer()` but restructured with new features: workspace runtime service reconciliation on startup, `reconcilePersistedRuntimeServicesOnStartup` import, onboarding wizard support, and instance settings routes.

**Key difference:** Both versions share the same general structure (imports -> config -> startServer function -> server setup -> listen), but the function body has diverged significantly. Fork added ~280 lines of route registrations, service bindings, and middleware.

**Resolution strategy:** Manual merge -- keep all fork additions (route registrations, webhook dispatcher, analytics middleware) while accepting upstream's new imports and startup code. The function body needs line-by-line reconciliation.

### server/src/services/heartbeat.ts (HARD -- manual merge required)

**Fork state:** 2892 lines. Added token usage tracking, budget enforcement, skill profile integration, context optimization pipeline, and webhook event dispatch into heartbeat execution loop.

**Upstream state:** 2550 lines. Added workspace runtime service management, execution workspace policy, heartbeat run summary generation, and issue goal fallback logic.

**Key difference:** Both sides modified the core heartbeat execution loop with different features. Fork injects token tracking/budget/skills before/during/after agent execution. Upstream injects workspace management and run summary logic.

**Resolution strategy:** Manual merge -- both sets of modifications target different concerns and should coexist. Identify exact insertion points for each side's additions within the heartbeat loop.

### server/src/app.ts (EASY -- small diff)

**Diff size:** 10 insertions, 11 deletions.
**Resolution strategy:** Accept both changes -- likely import additions and middleware registration from both sides.

### server/src/services/issues.ts (MEDIUM)

**Resolution strategy:** Accept both -- fork added webhook dispatching on issue events, upstream added workspace-related issue fields.

### DB Migration Files (3 conflicts -- resolved by renumbering)

The `_journal.json`, `0026_snapshot.json`, and `0027_snapshot.json` conflicts are entirely resolved by the migration renumbering strategy. After renumbering, fork keeps its 0026-0030 files untouched and upstream's files become 0031-0032.

### UI Conflicts (5 files -- mostly MEDIUM)

- **ui/src/App.tsx:** Fork has `GitHubSetupComplete` route, upstream adds `InstanceSettings`, `NotFound`, `RunTranscriptUxLab` routes. Manual merge to keep both.
- **ui/src/pages/AgentDetail.tsx:** Fork added analytics tabs (token breakdown, trace view, context utilization), upstream heavily restructured agent detail layout. Needs careful manual merge.
- **ui/src/pages/Costs.tsx:** Fork added AnalyticsCharts component, upstream modified cost display. Medium difficulty.
- **ui/src/components/agent-config-primitives.tsx:** Both sides modified agent config form fields. Medium difficulty.
- **ui/src/lib/queryKeys.ts:** Both sides added new query keys for their respective features. Easy -- combine both.

### Infrastructure Conflicts

- **Dockerfile:** Both sides modified Docker build. Compare specific changes.
- **ui/package.json:** Both sides added dependencies. Combine and let lockfile regenerate.
- **pnpm-lock.yaml:** Always regenerate from scratch after resolving package.json conflicts.

### Shared Package Conflict

- **packages/adapter-utils/src/index.ts:** Both sides added exports. Easy -- combine both.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (workspace-level, latest) |
| Config file | `server/vitest.config.ts` (node env), `ui/vitest.config.ts` (jsdom env) |
| Quick run command | `pnpm test:run` |
| Full suite command | `pnpm test:run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PREP-01 | Conflict map covers all 16 files with area categorization | manual-only | Visual inspection of `.planning/CONFLICT-MAP.md` | N/A (doc artifact) |
| PREP-02 | Pre-merge git tag exists as rollback point | smoke | `git tag -l pre-upstream-sync && git branch -l pre-upstream-sync-backup` | N/A (git state) |
| PREP-03 | Migration renumbering produces no diff from drizzle-kit generate | integration | `pnpm --filter @paperclipai/db generate` (expect no new files) | N/A (verification command) |
| PREP-04 | Feature manifest with canary tests | unit | `pnpm test:run -- --grep "v1.0 fork feature"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm test:run`
- **Per wave merge:** `pnpm test:run`
- **Phase gate:** Full suite green + `drizzle-kit generate` produces no diff + all 16 conflicts documented

### Wave 0 Gaps
- [ ] `server/src/__tests__/v1-feature-exports.test.ts` -- covers PREP-04 (export verification)
- [ ] Migration renumbering script or manual steps documented -- covers PREP-03

## Open Questions

1. **Snapshot ID generation after renumbering**
   - What we know: Snapshots use UUIDs as `id` fields. When renumbering from 0026 to 0031, the id can stay the same (it's just a unique identifier). Only `prevId` needs updating to maintain the chain.
   - What's unclear: Whether drizzle-kit generate expects the id to follow any pattern (it appears random/UUID).
   - Recommendation: Keep the upstream snapshot ids as-is, only update the `prevId` of 0031 to point to fork's 0030. Verify with `drizzle-kit generate` producing no diff.

2. **Migration compatibility with deployed databases**
   - What we know: Fork databases have applied 0026-0030 (fork). Upstream's 0026-0027 create non-overlapping tables/columns. Renumbered 0031-0032 will be "new pending" migrations.
   - What's unclear: Whether the custom `reconcilePendingMigrationHistory` function handles the gap gracefully when applied migrations jump from 0030 to 0031 (no gap, sequential, should be fine).
   - Recommendation: The migration compatibility check script should run upstream's SQL against a database with fork migrations applied to verify no FK or naming conflicts.

## Sources

### Primary (HIGH confidence)
- Direct git operations on the repository (`git merge --no-commit`, `git diff`, `git ls-tree`) -- authoritative conflict detection
- File system inspection of `packages/db/src/migrations/` -- exact migration state
- Source code reading of `packages/db/src/client.ts` -- migration runner behavior

### Secondary (MEDIUM confidence)
- [Drizzle ORM migration merge conflict discussion](https://github.com/drizzle-team/drizzle-orm/discussions/1104) -- community patterns for handling migration conflicts
- [Drizzle Kit generate documentation](https://orm.drizzle.team/docs/drizzle-kit-generate) -- migration prefix options and verification
- [Drizzle Kit migrate documentation](https://orm.drizzle.team/docs/drizzle-kit-migrate) -- runtime migration behavior

### Tertiary (LOW confidence)
- None -- all findings verified against actual codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no external libraries needed; all tools already in use
- Architecture: HIGH -- conflict list from actual `git merge` dry-run; migration structure from file inspection
- Pitfalls: HIGH -- based on actual snapshot chain analysis and understanding of Drizzle internals from source code
- Feature manifest: HIGH -- based on systematic diff of fork vs upstream file listings

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable -- fork state is frozen until merge begins)
