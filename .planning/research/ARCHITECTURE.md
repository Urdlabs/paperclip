# Architecture Patterns: Upstream Sync & Continuous Integration

**Domain:** Fork management, upstream merge automation, CI/CD
**Researched:** 2026-03-12
**Confidence:** HIGH (based on direct git diff analysis of both branches since c674462)

## Current Architecture Snapshot

```
paperclip/
  .github/workflows/       # 3 existing: pr-verify, pr-policy, refresh-lockfile
  cli/                     # Commander CLI tool
  packages/
    db/                    # Drizzle ORM + PostgreSQL 17 (migrations 0000-0030 on fork)
    shared/                # Types, constants, validators (consumed by every package)
    adapter-utils/         # Adapter shared utilities
    adapters/              # 6 adapters: claude-local, codex-local, cursor-local,
                           #   openclaw-gateway, opencode-local, pi-local
  server/                  # Express 5 (routes, services, context-pipeline, adapters)
  ui/                      # React 19 + TanStack Query SPA
  docker/                  # Docker support files
  Dockerfile               # Multi-stage production build
  pnpm-workspace.yaml      # pnpm workspace config
```

**Git topology:** Fork diverged at commit `c674462` (upstream PR #238). Upstream is 226 commits ahead (47 merge + 179 feature/fix). Fork is 120 commits ahead (v1.0 features). There are **39 files modified by BOTH sides** -- these are the conflict hotspots.

## Recommended Architecture

The sync architecture has two modes: a one-time catch-up merge (manual, human-driven) and ongoing automated sync (GitHub Actions). Both share the same validation pipeline and branch strategy.

### Strategy: `upstream-sync` Branch + PR to `master`

Never merge upstream directly into `master`. Instead:

1. An `upstream-sync` branch receives the upstream merge
2. Conflicts are resolved on that branch
3. A PR from `upstream-sync` -> `master` goes through existing CI (pr-verify, pr-policy)
4. After CI passes and human review, merge the PR

**Why not direct-to-master:** 39 overlapping files with heavy structural changes mean automatic merge will fail. Manual conflict resolution on a branch preserves `master` stability.

**Why not rebase:** With 120 fork commits replayed onto 226 upstream commits, each conflict resurfaces at every fork commit that touched the file. Merge produces a single conflict resolution point per file.

```
                    ONE-TIME INITIAL MERGE
                    ======================

  Fork (master)                          Upstream (upstream/master)
  120 commits ahead                      226 commits ahead
       |                                        |
       +-------- merge base: c674462 ----------+
       |                                        |
       v                                        v
  [Tag: pre-upstream-sync]               [git fetch upstream]
       |                                        |
       +--- checkout -b upstream-sync ----------+
       |                                        |
       +--- git merge upstream/master ----------+
       |                                        |
       v                                        v
  ~39 file conflicts                    Auto-merged files
       |
       v
  Resolve by chunk (see Build Order below)
       |
       v
  pnpm install --lockfile-only
       |
       v
  pnpm -r typecheck && pnpm test:run && pnpm build
       |
       v
  PR to master (reviewed, CI-gated)
       |
       v
  master (merge commit, both histories preserved)


                    ONGOING AUTOMATED SYNC
                    ======================

  Schedule: cron '0 6 * * 1' (Monday 6 AM UTC) + workflow_dispatch
       |
       v
  git fetch upstream; count new commits
       |
       +-- 0 new --> exit
       |
       +-- N new --> checkout -b upstream-sync/YYYY-MM-DD from master
                |
                v
          git merge upstream/master --no-edit
                |
                +-- clean --> push, create PR "chore: sync upstream (N commits)"
                |             label: upstream-sync, auto-merge-candidate
                |             CI runs automatically via pr-verify.yml
                |
                +-- conflicts --> abort merge, create PR with conflict report
                                  label: upstream-sync, needs-manual-resolution
```

### Component Boundaries

| Component | Responsibility | New/Modified | Communicates With |
|-----------|---------------|-------------|-------------------|
| `upstream-sync` branch | Receives upstream merge, workspace for conflict resolution | NEW branch | `master` via PR |
| `.github/workflows/upstream-sync.yml` | Scheduled detection of upstream changes, creates PR | NEW workflow | GitHub API, upstream remote |
| `.github/workflows/pr-verify.yml` | Validates sync PRs: typecheck + tests + build | EXISTING (no change needed) | pnpm, vitest, tsc |
| `.github/workflows/pr-policy.yml` | Blocks manual lockfile edits | EXISTING (MODIFY: exempt sync branch) | git diff |
| `.github/workflows/refresh-lockfile.yml` | Regenerates lockfile after merge to master | EXISTING (no change needed) | pnpm |
| Pre-merge safety tag | Rollback point if merge goes wrong | NEW (one-time) | git tag |

## Conflict Hotspot Analysis

Direct `git diff` analysis of every file modified by both sides since `c674462`. Classified by merge difficulty.

### CRITICAL Conflicts (Structural Refactoring -- Require Careful Manual Resolution)

**1. `server/src/index.ts`** (578 upstream insertions, 516 deletions vs. 81 fork insertions, 38 deletions)

Upstream wrapped the entire file in an exported `startServer()` function, extracted type definitions, moved config loading inside the function scope, and added workspace-runtime imports. Fork made three targeted additions: `autoBootstrapCeoInvite` import+call, `bootstrapInvite` variable, and async heartbeat recovery pattern (`reapOrphanedRuns` then `resumeQueuedRuns`).

**Resolution:** Accept upstream's `startServer()` restructuring as the base. Re-apply fork's 3 additions inside the new function body. Fork's changes are localized enough to transplant.

**2. `server/src/services/heartbeat.ts`** (272+/52- upstream vs. 335+/12- fork)

Upstream: removed `costEvents` import, added workspace-runtime/execution-workspace-policy/log-redaction/heartbeat-run-summary imports, added `heartbeatRunListColumns` constant for slimmer run list queries, refactored cost recording.

Fork: added github-app/claude-usage-streaming/token-estimation/context-pipeline/budget/skill-profiles imports, added `activeRunExecutions` Set, changed `reapOrphanedRuns` to only scan `"running"` (not `"queued"`), added `resumeQueuedRuns` method.

**Resolution:** Imports can be merged mechanically (keep both sets). For `reapOrphanedRuns`, both sides changed the query filter -- fork's approach (only scan `"running"`) is correct because queued runs have not started executing. Keep fork's filter change AND upstream's `heartbeatRunListColumns` optimization. Keep fork's `activeRunExecutions` and `resumeQueuedRuns`.

**3. `packages/db/src/migrations/meta/_journal.json`** and **migration 0026-0027 files**

Both branches created migrations starting at index 26. Upstream: `0026_lying_pete_wisdom`, `0027_tranquil_tenebrous`. Fork: `0026_rainy_blade` through `0030_sharp_korath`.

**Resolution:** Fork migrations 0026-0030 are already deployed to production databases and MUST retain their current numbers. Renumber upstream's 2 migrations to follow fork's highest:
- `0026_lying_pete_wisdom.sql` -> `0031_lying_pete_wisdom.sql`
- `0027_tranquil_tenebrous.sql` -> `0032_tranquil_tenebrous.sql`
- Rename snapshot JSONs correspondingly
- Rebuild `_journal.json` with all 33 entries (0000-0032) sequentially
- Verify: `pnpm db:generate` produces no new migration (schema matches code)

### HIGH Conflicts (Both Sides Add to Same File, Different Regions)

| File | Upstream | Fork | Resolution |
|------|----------|------|------------|
| `server/src/app.ts` | Added `applyUiBranding`, `serverPort` param, HMR port config | Added `githubWebhookRoute` (before json parser), `githubRoutes`/`webhookRoutes`/`skillProfileRoutes` (in API chain) | Non-overlapping regions. Accept both. |
| `server/src/services/index.ts` | Added 1 export: `reconcilePersistedRuntimeServicesOnStartup` | Added 9 exports: token-estimation, github-app, budget, webhooks, etc. | Both append to barrel. Keep all. |
| `packages/shared/src/types/index.ts` | Added workspace-runtime types mid-file, `InstanceSchedulerHeartbeatAgent` | Added subtask/usage/github/webhook/skill-profile types at end | Different insertion points. Keep both. |
| `packages/shared/src/constants.ts` | Added `gemini_local` to adapter types | Added `heartbeat.run.usage`, `WEBHOOK_EVENT_TYPES`, `BUILTIN_SKILL_PROFILE_SLUGS` | Different sections. Keep both. |
| `ui/src/App.tsx` | Major route restructuring: added InstanceSettings, RunTranscriptUxLab, NotFoundPage, OnboardingRoutePage, InboxRootRedirect, LegacySettingsRedirect, health polling | Added `GitHubSetupComplete` route, `company/settings` redirect | Accept upstream's restructuring. Re-add fork's 2 routes into new structure. |
| `packages/db/src/schema/index.ts` | Added `workspaceRuntimeServices` after `projectWorkspaces` | Added 6 exports at end of file | Non-overlapping positions. Keep both. |

### MODERATE Conflicts (Both Modified, Limited Overlap)

| File | Nature | Resolution |
|------|--------|------------|
| `server/src/routes/issues.ts` | Upstream: `parentId` filter. Fork: dependency/subtask endpoints. | Non-overlapping additions. Keep both. |
| `server/src/routes/activity.ts` | Upstream: pagination. Fork: filter parameters. | Minor overlap in signatures. Merge parameters. |
| `server/src/services/issues.ts` | Upstream: goal fallback, run lookup. Fork: dependency + subtask methods. | Upstream modifies existing; fork adds new. Keep both. |
| `ui/src/components/AgentConfigForm.tsx` | Upstream: config tab refactor. Fork: budget + skill profile controls. | Accept upstream's layout refactor. Re-add fork's controls. |
| `ui/src/pages/AgentDetail.tsx` | Upstream: runs tab, slimmed page. Fork: token analytics sections. | Accept upstream's tab structure. Add fork's analytics as a tab. |
| `ui/src/pages/Costs.tsx` | Upstream: minor tweaks. Fork: major analytics rewrite. | Keep fork's version. Apply upstream fixes if applicable. |
| `Dockerfile` | Upstream: gemini-local, non-root user. Fork: `node:22-slim`, comments. | Merge: fork's base image + upstream's security + gemini adapter. |

### LOW Conflicts (Additive, Usually Auto-Resolvable)

`ui/src/lib/queryKeys.ts`, `ui/src/components/agent-config-defaults.ts`, `ui/src/components/agent-config-primitives.tsx`, `ui/src/context/LiveUpdatesProvider.tsx`, `packages/db/src/schema/issues.ts`, `ui/package.json`, `pnpm-lock.yaml` (always regenerate), `cli/src/commands/configure.ts`, `cli/src/commands/onboard.ts`, `cli/src/prompts/server.ts`

## Chunked Resolution Build Order

The merge is a single `git merge upstream/master` that produces all conflicts at once. Resolution is performed in chunks that respect the monorepo dependency graph: resolve foundational packages first so downstream packages can compile and be tested incrementally.

### Chunk 1: Foundation Layer (`packages/shared`, `packages/adapter-utils`)

**Files:** `packages/shared/src/constants.ts`, `packages/shared/src/types/index.ts`, `packages/shared/src/validators/index.ts`, `packages/shared/src/validators/issue.ts`, `packages/adapter-utils/src/index.ts`, `packages/adapter-utils/src/types.ts`

**Why first:** Every other package depends on `@paperclipai/shared`. Getting types right enables all downstream compilation.

**Approach:** All changes are additive (new exports, types, constants). Accept both upstream and fork additions. No semantic conflicts.

**Validation:** `pnpm --filter @paperclipai/shared typecheck && pnpm --filter @paperclipai/adapter-utils typecheck`

### Chunk 2: Database Layer (`packages/db`)

**Files:** `packages/db/src/schema/index.ts`, `packages/db/src/schema/issues.ts`, all migration files and journal

**Why second:** Server and UI depend on DB schema types. Migration ordering must be correct before any runtime testing.

**Approach:**
1. Schema: accept both additions (non-overlapping exports and columns)
2. Migrations: renumber upstream 0026-0027 to 0031-0032. Rebuild journal. Regenerate snapshots.
3. New upstream files (schema/workspace_runtime_services.ts, migration-runtime.ts, runtime-config.ts, backup-lib changes): accept entirely.

**Validation:** `pnpm --filter @paperclipai/db typecheck`, verify `pnpm db:generate` produces no new migration

### Chunk 3: Server Core (`server/`)

**Files (in resolution order):**
1. `server/src/services/index.ts` -- easy barrel merge
2. `server/src/routes/issues.ts`, `activity.ts` -- additive changes
3. `server/src/services/issues.ts` -- upstream modifies existing + fork adds new
4. `server/src/app.ts` -- both add to different regions
5. `server/src/services/heartbeat.ts` -- HARD: interleave both feature sets
6. `server/src/index.ts` -- HARD: accept upstream restructuring, reapply fork additions

**Why third:** Depends on shared types and DB schema.

**Approach for hard files:**

`heartbeat.ts`: Merge imports from both sides. Keep upstream's `heartbeatRunListColumns` constant. Keep fork's `activeRunExecutions` Set and `resumeQueuedRuns`. For `reapOrphanedRuns`, use fork's "only running" filter with upstream's column optimization. Verify cost recording: upstream routes through `costService`; fork uses `costEvents` directly -- reconcile to use `costService` (upstream's approach is cleaner).

`index.ts`: Accept upstream's `startServer()` wrapper as base. Insert fork's `autoBootstrapCeoInvite` in the auth setup section. Insert fork's `bootstrapInvite` variable. Replace the heartbeat startup section with fork's async recovery pattern (reap -> resume -> start timer).

Accept all new upstream files (workspace-runtime.ts, execution-workspace-policy.ts, log-redaction.ts, heartbeat-run-summary.ts, ui-branding.ts, attachment-types.ts, and their tests) as-is.

**Validation:** `pnpm --filter @paperclipai/server typecheck && cd server && pnpm vitest run` (374 tests)

### Chunk 4: Adapter Layer (`packages/adapters/`)

**Files:** Changes to claude-local, codex-local execute/build-config. New upstream `gemini-local` adapter.

**Why fourth:** Depends on adapter-utils and shared (resolved in chunk 1).

**Approach:** Accept upstream adapter improvements. New gemini-local adapter is entirely new -- accept as-is. Verify fork's usage-tracking hooks in claude-local `execute.ts` still function with upstream's changes.

**Validation:** `pnpm -r --filter "./packages/adapters/*" typecheck`

### Chunk 5: UI Layer (`ui/`)

**Files (in resolution order):**
1. `ui/package.json` -- merge dependency lists
2. `ui/src/lib/queryKeys.ts` -- both add keys
3. `ui/src/context/LiveUpdatesProvider.tsx` -- both add event handlers
4. `ui/src/components/agent-config-defaults.ts`, `agent-config-primitives.tsx` -- additive
5. `ui/src/components/AgentConfigForm.tsx` -- upstream refactored layout, reapply fork controls
6. `ui/src/pages/Costs.tsx` -- keep fork's version
7. `ui/src/pages/AgentDetail.tsx` -- accept upstream runs tab, add fork analytics tab
8. `ui/src/App.tsx` -- accept upstream route restructuring, add fork routes

Accept all new upstream components/pages/libs (OnboardingWizard improvements, RunTranscriptView, IssueRow, ScrollToBottom, NotFoundPage, InstanceSettings, Inbox improvements, etc.) as-is.

**Validation:** `pnpm --filter @paperclipai/ui typecheck && cd ui && pnpm vitest run` (37 tests)

### Chunk 6: Infrastructure (root config, Docker, workflows)

**Files:** `Dockerfile`, `pnpm-lock.yaml`, root `tsconfig.json`, `.github/workflows/`

**Approach:**
- `Dockerfile`: merge fork's `node:22-slim` + comments with upstream's gemini-local COPY + `USER node` + `/paperclip` ownership
- `pnpm-lock.yaml`: `git checkout --ours pnpm-lock.yaml && pnpm install --lockfile-only`
- Accept upstream's new workflows: `e2e.yml`, `release.yml`, `refresh-lockfile-pr.yml`
- Add new `upstream-sync.yml` (see below)
- Update `pr-policy.yml` to exempt sync branches from lockfile block

**Validation:** Full pipeline: `pnpm install && pnpm -r typecheck && pnpm test:run && pnpm build && docker build .`

## New Component: `.github/workflows/upstream-sync.yml`

```yaml
name: Upstream Sync

on:
  schedule:
    - cron: '0 6 * * 1'   # Weekly Monday 06:00 UTC
  workflow_dispatch:

permissions:
  contents: write
  pull-requests: write

jobs:
  sync:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Configure git
        run: |
          git config user.name "upstream-sync-bot"
          git config user.email "upstream-sync-bot@users.noreply.github.com"

      - name: Fetch upstream
        run: |
          git remote add upstream https://github.com/paperclipai/paperclip.git 2>/dev/null || true
          git fetch upstream master

      - name: Check for new upstream commits
        id: check
        run: |
          MERGE_BASE=$(git merge-base HEAD upstream/master)
          UPSTREAM_HEAD=$(git rev-parse upstream/master)
          if [ "$MERGE_BASE" = "$UPSTREAM_HEAD" ]; then
            echo "up_to_date=true" >> "$GITHUB_OUTPUT"
          else
            COUNT=$(git rev-list --count "$MERGE_BASE..upstream/master")
            echo "up_to_date=false" >> "$GITHUB_OUTPUT"
            echo "commit_count=$COUNT" >> "$GITHUB_OUTPUT"
          fi

      - name: Create sync branch and attempt merge
        if: steps.check.outputs.up_to_date == 'false'
        id: merge
        run: |
          BRANCH="upstream-sync/$(date +%Y-%m-%d)"
          echo "branch=$BRANCH" >> "$GITHUB_OUTPUT"
          git checkout -b "$BRANCH"
          if git merge upstream/master --no-edit; then
            echo "clean=true" >> "$GITHUB_OUTPUT"
          else
            echo "clean=false" >> "$GITHUB_OUTPUT"
            git diff --name-only --diff-filter=U > /tmp/conflicts.txt
            git merge --abort
          fi

      - name: Push sync branch
        if: steps.check.outputs.up_to_date == 'false' && steps.merge.outputs.clean == 'true'
        run: git push -u origin "${{ steps.merge.outputs.branch }}"

      - name: Create PR (clean merge)
        if: steps.check.outputs.up_to_date == 'false' && steps.merge.outputs.clean == 'true'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          gh pr create \
            --title "chore: sync upstream (${{ steps.check.outputs.commit_count }} commits)" \
            --body "$(cat <<'PREOF'
          ## Upstream Sync

          Merges ${{ steps.check.outputs.commit_count }} new upstream commits.

          ### Verification Checklist
          - [ ] CI passes (typecheck + tests + build)
          - [ ] v1.0 fork features still work
          - [ ] No unexpected migration changes
          PREOF
          )" \
            --base master \
            --head "${{ steps.merge.outputs.branch }}" \
            --label upstream-sync

      - name: Create issue (conflicts detected)
        if: steps.check.outputs.up_to_date == 'false' && steps.merge.outputs.clean == 'false'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          CONFLICTS=$(cat /tmp/conflicts.txt)
          gh issue create \
            --title "Upstream sync: ${{ steps.check.outputs.commit_count }} commits, conflicts detected" \
            --body "$(cat <<ISSEOF
          Upstream has ${{ steps.check.outputs.commit_count }} new commits but merge produces conflicts.

          **Conflicting files:**
          \`\`\`
          $CONFLICTS
          \`\`\`

          **Resolution steps:**
          1. \`git fetch upstream\`
          2. \`git checkout -b upstream-sync/manual\`
          3. \`git merge upstream/master\`
          4. Resolve conflicts
          5. \`pnpm install --lockfile-only\`
          6. Run validation: \`pnpm -r typecheck && pnpm test:run && pnpm build\`
          7. Push and create PR
          ISSEOF
          )" \
            --label upstream-sync,needs-manual-resolution
```

**Key design decisions:**
- **Weekly (not daily):** Upstream averages ~10 commits/week. Daily creates noise. Weekly keeps divergence small.
- **`workflow_dispatch`:** Manual trigger for when upstream releases something notable.
- **Creates issue for conflicts (not PR):** A PR with merge conflict markers cannot be reviewed or built. An issue with the conflict report is more actionable.
- **Dated branch names:** `upstream-sync/2026-03-17` prevents collisions if multiple syncs happen.

### Modified: `.github/workflows/pr-policy.yml`

Add exemption for sync branches from the lockfile block:

```yaml
- name: Block manual lockfile edits
  run: |
    # Exempt upstream sync PRs (lockfile changes are expected)
    HEAD_REF="${{ github.head_ref }}"
    if [[ "$HEAD_REF" == upstream-sync/* ]]; then
      echo "Upstream sync PR -- lockfile changes expected"
      exit 0
    fi
    # ... existing lockfile check logic unchanged
```

## Patterns to Follow

### Pattern 1: Merge Commit (Not Rebase)

**What:** Always `git merge` for upstream integration.
**When:** Every sync.
**Why:** Single conflict resolution per file. Both histories preserved. Clean rollback via `git revert -m 1 <merge-sha>`. No force-push. No orphaned branches.

### Pattern 2: Fork Additions Stay in New Files

**What:** Fork features live in new files. Only "registration" touches shared files (barrel exports, route mounting, App.tsx routes).
**Assessment:** Fork already does this well. Context-pipeline is `server/src/context-pipeline/`, GitHub app is `server/src/services/github-app.ts`, webhooks are `server/src/routes/webhooks.ts`. Future features should follow this pattern.
**Why:** New files never conflict with upstream. Registration points are append-only and easy to re-apply.

### Pattern 3: Migration Numbering Discipline

**What:** After merge, fork migrations always use numbers higher than both upstream's and fork's current max.
**Going forward:** After renumbering to 0032, fork's next migration is 0033+. Sync workflow should flag when upstream adds new migration files.
**Detection:** `git diff --name-only upstream/master...HEAD -- 'packages/db/src/migrations/*.sql'`

### Pattern 4: Generated File Strategy

**What:** For `pnpm-lock.yaml` and Drizzle snapshot JSONs, accept "ours" then regenerate.
**Why:** These are generated artifacts. Text-merging them produces garbage.
```bash
git checkout --ours pnpm-lock.yaml
pnpm install --lockfile-only
git add pnpm-lock.yaml
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Rebase for Fork Sync

120 fork commits replayed onto 226 upstream commits. Same conflict in `heartbeat.ts` resurfaces at every fork commit that touched it. All SHAs rewritten. Requires force-push. Open branches orphaned. No merge commit for clean revert.

### Anti-Pattern 2: Auto-Merge to Master

Even "clean" git merges can have semantic conflicts -- code compiles but behavior changes. The `pr-verify.yml` CI catches compilation failures; human review catches behavioral regressions.

### Anti-Pattern 3: Conflicting Migration Numbers

Leaving both upstream's and fork's `0026` migrations causes Drizzle runtime errors. The journal uses sequential idx values; duplicates are undefined behavior.

### Anti-Pattern 4: Cherry-Picking Upstream Commits

With 226 commits and 47 merge commits, dependencies between commits are opaque. Git loses merge tracking, so future syncs cannot determine what was incorporated.

### Anti-Pattern 5: Delaying the Initial Merge

Divergence grows with every commit. Current 39 conflicting files become 60+ in another month. The `server/src/index.ts` structural refactoring is already the hardest conflict; further upstream changes to `startServer()` would compound it.

## Post-Merge v1.0 Feature Verification

After the merge, explicitly verify every fork-specific feature:

| Feature | How to Verify |
|---------|---------------|
| Token usage tracking | Run agent, confirm `cost_events` has input/output/cached breakdown |
| Token analytics dashboard | Load `/costs`, verify charts render with data |
| Context pipeline | Check server logs for processor output during run |
| Budget enforcement | Set budget on agent, verify wind-down behavior |
| Webhook notifications | Configure endpoint, trigger event, check delivery log |
| Task decomposition | Create issue with subtasks, verify dependency ordering |
| Skill profiles | Assign profile to agent, verify prompt shaping |
| Code review workflow | Trigger review, verify PR diff analysis |
| GitHub App integration | Verify installation lists repos, webhooks deliver |
| Activity filtering | Load `/activity`, verify filters by agent/project/severity |

## Scalability

| Timeframe | Divergence | Conflicts | Human Effort | Automation Value |
|-----------|-----------|-----------|--------------|------------------|
| Now (before sync) | 226 commits | 39 files | 4-8 hours | N/A |
| After initial sync | 0 | 0 | 0 | N/A |
| 1 week (with automation) | ~10 commits | 0-1 files | 0 (usually clean merge) | HIGH |
| 1 month (with automation) | ~40 commits | 1-3 files | 0-30 min | HIGH |
| 3 months (without automation) | ~120 commits | 15-25 files | 2-4 hours | Scenario being prevented |

Once the initial 226-commit gap is closed, weekly automation keeps divergence under ~10 commits. Most weekly syncs will be clean merges requiring zero human effort.

## Sources

- Direct git analysis: `git diff --name-only c674462..upstream/master` vs `c674462..master` -- identified all 39 overlapping files (HIGH confidence)
- Direct `git diff` of each overlapping file to classify conflict type and severity (HIGH confidence)
- Existing CI workflows: `.github/workflows/pr-verify.yml`, `pr-policy.yml`, `refresh-lockfile.yml` (HIGH confidence)
- Migration journal analysis: `packages/db/src/migrations/meta/_journal.json` on both branches (HIGH confidence)
- [GitHub Blog: Strategies for Friendly Fork Management](https://github.blog/developer-skills/github/friend-zone-strategies-friendly-fork-management/)
- [Git Tricks for Maintaining a Long-Lived Fork](https://die-antwort.eu/techblog/2016-08-git-tricks-for-maintaining-a-long-lived-fork/)
- [Drizzle ORM Migration Conflict Discussion #1104](https://github.com/drizzle-team/drizzle-orm/discussions/1104)
- [Drizzle ORM Commutative Migrations Discussion #5005](https://github.com/drizzle-team/drizzle-orm/discussions/5005)
- [Atlassian: Git Merge Strategy Options](https://www.atlassian.com/git/tutorials/using-branches/merge-strategy)
- [GitHub Marketplace: Upstream to PR Action](https://github.com/marketplace/actions/upstream-to-pr)
- [GitHub Marketplace: Fork Sync With Upstream](https://github.com/aormsby/Fork-Sync-With-Upstream-action)
