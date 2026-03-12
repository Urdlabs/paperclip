# Pitfalls Research

**Domain:** Upstream fork sync and continuous integration for a large diverged TypeScript monorepo
**Researched:** 2026-03-12
**Confidence:** HIGH (verified against actual codebase state, Drizzle ORM issue tracker, GitHub Actions documentation, pnpm documentation)

## Critical Pitfalls

### Pitfall 1: Drizzle Migration Index Collision (0026+)

**What goes wrong:**
Fork and upstream share migrations 0000-0025 but diverge at index 0026. The fork has 5 migrations (0026_rainy_blade through 0030_sharp_korath) adding GitHub Apps, webhooks, token tracking, skill profiles, and code review tables. Upstream has 2 migrations (0026_lying_pete_wisdom, 0027_tranquil_tenebrous) adding workspace_runtime_services and project-first execution policies. Both sides wrote to the same `_journal.json` with different entries at the same indices. A naive git merge creates a corrupted journal where Drizzle cannot determine the correct migration order, and a database that has already run the fork's 0026 will skip upstream's 0026 entirely (different filename = "not pending" if the fork's 0026 is already recorded in `__drizzle_migrations`).

**Why it happens:**
Drizzle ORM uses sequential integer-prefixed filenames (0000, 0001, ...) with random comic book character names. When two branches independently generate migrations from the same starting point, they produce files with the same index numbers but different names and different SQL. The `_journal.json` is a single JSON array with positional indexing -- it is not mergeable. This is a [known unsolved problem in Drizzle](https://github.com/drizzle-team/drizzle-orm/issues/2488) with no built-in tooling for resolution.

**How to avoid:**
1. Do NOT attempt to merge the migration directories with git merge. Instead, use the following manual resolution strategy:
   - Keep ALL fork migrations (0026-0030) as-is -- these have already been applied to existing fork databases.
   - Renumber upstream's migrations to come AFTER the fork's: 0026_lying_pete_wisdom becomes 0031_lying_pete_wisdom, 0027_tranquil_tenebrous becomes 0032_tranquil_tenebrous.
   - Regenerate the `_journal.json` to contain all 33 entries in the correct order (fork 0-30, then upstream as 31-32).
   - Regenerate snapshot files (`meta/0031_snapshot.json`, `meta/0032_snapshot.json`) from the upstream snapshots with corrected indices.
   - Verify the final schema matches: run `drizzle-kit generate` against the merged schema files and confirm no diff from the combined migration set.
2. Test migration on a fresh database (no existing data) AND on a database that already has fork migrations applied. Both must succeed.
3. For future upstream syncs, always renumber incoming upstream migrations to follow the fork's latest index.

**Warning signs:**
- `drizzle-kit migrate` fails with "migration already applied" or "journal corrupted" errors.
- Tables from upstream migrations are missing after merge (the migration was silently skipped).
- `_journal.json` has duplicate `idx` values or non-sequential entries.

**Phase to address:**
Phase 1 (initial upstream merge). This is the single hardest technical problem in the entire milestone. Must be solved before any other merge work proceeds, because every subsequent sync inherits the migration numbering strategy established here.

---

### Pitfall 2: Silent Semantic Conflicts That Compile But Break Behavior

**What goes wrong:**
With 283 files modified by both fork and upstream, many merge conflicts will be textual (git detects them). The dangerous ones are semantic: both sides modify the same module's behavior without touching the same lines. Examples specific to this codebase:
- **Upstream adds `workspaceRuntimeServices` export to `packages/db/src/schema/index.ts`** while fork added `skillProfiles`, `tokenUsage`, `webhookEndpoints`, etc. to the same barrel export file. Git resolves this cleanly (different lines), but if upstream's new schema references a table our fork modified (like `projects` or `issues`), the foreign key relationships may be subtly wrong.
- **Upstream changes `server/src/services/heartbeat.ts`** to add workspace runtime lifecycle management. Fork added token tracking, budget enforcement, and context optimization to the same service. Both changes compile, but the execution flow has new code paths that assume different state shapes.
- **Upstream bumps server version to 0.3.0** and adds gemini-local adapter to dependencies. Fork has its own version tracking and added different dependencies. The merged `package.json` looks valid but `pnpm install` resolves to a broken dependency graph.

**Why it happens:**
Git merge works at the text level. It cannot detect when Branch A adds a function that calls `getProject()` expecting field X, while Branch B changed `getProject()` to return a different shape. TypeScript compilation catches type-level conflicts but not runtime behavior changes (e.g., a function that now returns `null` where it previously returned `undefined`, or an enum that gained new values neither branch handles).

**How to avoid:**
1. After each merge chunk, run the FULL verification pipeline: `pnpm -r typecheck && pnpm test:run && pnpm build`. Do not batch merge chunks without verification between them.
2. For high-risk files (heartbeat.ts, schema/index.ts, app.ts, routes/*), do a manual semantic review even when git reports no conflicts. Read the upstream diff and the fork diff side by side.
3. Write "canary tests" before merging: tests that exercise fork-specific features (token tracking, webhooks, skill profiles, code review) so that upstream changes that break fork behavior are caught by the test suite.
4. Pay special attention to barrel export files (`index.ts`), service registration files (`services/index.ts`, `adapters/registry.ts`), and route registration files (`app.ts`) -- these are coordination points where both sides add code that appears non-conflicting but creates runtime issues.

**Warning signs:**
- Tests pass but fork-specific UI pages show blank data or 500 errors.
- TypeScript compiles but runtime errors appear: "Cannot read property X of undefined".
- API endpoints return partial data (missing fields added by the fork).

**Phase to address:**
Every merge phase. This is an ongoing risk throughout the entire sync process. The canary test suite should be written in the preparation phase before any merge begins.

---

### Pitfall 3: Lockfile Merge Destroys Docker Build Cache

**What goes wrong:**
The fork's `pnpm-lock.yaml` and upstream's `pnpm-lock.yaml` have diverged across 3+ upstream lockfile refreshes. The lockfile is 50k+ lines of dependency resolution data that is effectively unmergeable by hand. The correct strategy is to regenerate it (`pnpm install --lockfile-only`), but ANY change to `pnpm-lock.yaml` invalidates the Docker `deps` stage layer cache. The current Dockerfile copies `pnpm-lock.yaml` early in the build:

```dockerfile
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
```

Every upstream sync that touches any `package.json` (and upstream changed ALL 14 of them just for version bumps) forces a full `pnpm install --frozen-lockfile` in Docker. On CI, this adds 2-5 minutes per build. Worse: if the lockfile regeneration resolves dependencies differently than expected, Docker builds fail with "frozen lockfile" errors that are opaque to diagnose.

**Why it happens:**
pnpm lockfiles in monorepos are notoriously conflict-prone. The fork's existing `refresh-lockfile.yml` workflow regenerates on push to master, and upstream has a different workflow (`refresh-lockfile-pr.yml`) that refreshes on PR events. These two lockfile management strategies will collide. The fork's workflow commits directly to master; upstream's workflow commits to PR branches. A sync PR from upstream will have a stale lockfile that the fork's PR-policy workflow rejects ("Do not commit pnpm-lock.yaml in pull requests").

**How to avoid:**
1. **Never merge upstream's `pnpm-lock.yaml`**. Always regenerate: accept ours for lockfile during merge, then run `pnpm install --lockfile-only --ignore-scripts --no-frozen-lockfile` to produce a fresh lockfile from the merged `package.json` files.
2. Reconcile the lockfile management workflows BEFORE creating sync PRs. Decide: does the fork keep its push-to-master strategy, adopt upstream's PR-based strategy, or use a hybrid? The sync workflow must not create a lockfile commit that triggers the refresh-lockfile workflow that creates another commit.
3. For Docker cache efficiency, consider using `pnpm fetch` (which only needs the lockfile) as the caching layer, and accept that sync merges will bust the cache once per sync.
4. Pin pnpm version consistently between fork and upstream (both currently use 9.15.4, but verify this does not drift).

**Warning signs:**
- Docker builds failing with "ERR_PNPM_FROZEN_LOCKFILE_WITH_OUTDATED_LOCKFILE".
- `refresh-lockfile.yml` running immediately after a sync merge, producing a second commit on master.
- PR checks failing with "Do not commit pnpm-lock.yaml in pull requests" on sync PRs that legitimately need lockfile updates.

**Phase to address:**
Phase 1 (preparation). The lockfile strategy and workflow reconciliation must be settled before the first sync merge lands on master.

---

### Pitfall 4: Losing Fork Features During Conflict Resolution

**What goes wrong:**
When resolving merge conflicts across 283 overlapping files, the natural bias is toward "accept upstream" -- upstream is the source of truth, and their code is presumably well-tested. But for this fork, "accept upstream" silently drops fork-specific features. Concrete examples:
- **`server/src/app.ts`**: Fork added routes for `/api/token-analytics`, `/api/webhooks`, `/api/skill-profiles`, `/api/code-reviews`. Upstream restructured the route registration. Accepting upstream's version drops all fork routes.
- **`server/src/services/index.ts`**: Fork added service registrations for `tokenAnalyticsService`, `webhookService`, `skillProfileService`, `codeReviewService`. Upstream added `workspaceRuntimeService`. Accepting either side loses the other's services.
- **`packages/db/src/schema/index.ts`**: Fork added 8+ schema exports (token_usage, webhook_endpoints, skill_profiles, etc.). Upstream added workspace_runtime_services. Accepting upstream loses all fork schema exports.
- **`ui/src/pages/*.tsx`**: Fork added token analytics dashboard, webhook management, skill profile editor. Upstream refactored page layouts and navigation. A careless merge loses fork pages or breaks their integration with the new layout.

**Why it happens:**
Conflict resolution fatigue. After resolving 50+ conflicts, the resolver starts taking shortcuts. "Accept theirs" is faster than carefully weaving both changes together. Barrel files (index.ts, app.ts) are especially dangerous because they are long lists where additions on both sides create conflicts across the entire file, and the "correct" resolution requires manually combining both lists -- tedious and error-prone.

**How to avoid:**
1. Create a **fork feature manifest** before starting: a checklist of every fork-specific feature with its key files, routes, services, and schema tables. After the merge, verify each item on the checklist still works.
2. For barrel/registration files, always resolve conflicts by including BOTH sides' additions. Never "accept theirs" on these files.
3. Do the merge in chunks by package/directory (db first, then server, then ui), not as a single big merge. This makes it possible to test each area independently.
4. Use `git diff HEAD~1 -- server/src/app.ts` after each merge commit to verify that fork-specific routes are still registered.
5. The existing 411 tests (374 server, 37 UI) serve as a partial safety net, but only if they cover fork features. Tests for upstream-only features will pass even if fork features are broken.

**Warning signs:**
- Fork-specific API endpoints returning 404 after merge.
- UI navigation missing pages (token analytics, webhooks, etc.).
- Database queries failing on missing tables (schema exports dropped).
- Test count dropping after merge (fork tests were accidentally deleted).

**Phase to address:**
Every merge phase, but especially the preparation phase when the fork feature manifest is created. The verification phase after merge must systematically check every fork feature.

---

### Pitfall 5: Sync Workflow Creates Infinite Trigger Loop

**What goes wrong:**
A GitHub Actions workflow that syncs upstream changes will either: (a) create a merge commit and push to a branch, or (b) open a PR. If the workflow uses a Personal Access Token (PAT) instead of `GITHUB_TOKEN`, the push/PR triggers OTHER workflows (pr-verify, pr-policy, refresh-lockfile). If those workflows also push commits (as refresh-lockfile does), they trigger the sync workflow again. The loop: sync pushes commit -> lockfile-bot pushes lockfile refresh -> sync detects new commit -> sync pushes again.

Even without a PAT, the interaction between the sync workflow and the existing `refresh-lockfile.yml` (which triggers on push to master and can push commits) creates a potential chain: sync merge lands on master -> refresh-lockfile.yml fires -> refresh-lockfile commits pnpm-lock.yaml to master -> refresh-lockfile.yml fires AGAIN (push to master). The existing workflow avoids self-triggering because it uses `GITHUB_TOKEN` (which does not trigger workflows), but adding a sync workflow that uses a PAT breaks this assumption.

**Why it happens:**
GitHub Actions has a specific design choice: events triggered by `GITHUB_TOKEN` do NOT create new workflow runs (to prevent loops). But events triggered by PATs DO create new workflow runs. The sync workflow typically needs a PAT to push to the fork (the `GITHUB_TOKEN` scoped to the fork repo cannot push to itself on `push` events without `contents: write`). If the PAT is used carelessly, every commit from the sync bot triggers every `on: push` workflow.

**How to avoid:**
1. **Use `GITHUB_TOKEN` for the sync workflow**, not a PAT. Grant `contents: write` permission. Commits made with `GITHUB_TOKEN` will NOT trigger other workflows, breaking the loop.
2. If a PAT is required (e.g., for cross-repo operations), add explicit skip conditions to ALL workflows:
   ```yaml
   if: github.actor != 'github-actions[bot]' && !contains(github.event.head_commit.message, '[skip ci]')
   ```
3. The sync workflow should open a PR (not push directly to master), so that the merge goes through the normal PR verification pipeline. This also avoids triggering `on: push` workflows until the PR is explicitly merged by a human.
4. Add `[skip ci]` to any automated commits (lockfile refreshes, sync merges) as a secondary safety net.
5. Use `concurrency` groups with `cancel-in-progress: true` on all workflows to prevent pile-ups.

**Warning signs:**
- GitHub Actions usage spiking (hundreds of workflow runs in minutes).
- Multiple "chore(lockfile): refresh pnpm-lock.yaml" commits appearing in rapid succession.
- Sync PRs being created, auto-merged, triggering new sync PRs.
- GitHub rate-limiting the repository.

**Phase to address:**
Phase 2 (continuous sync automation setup). Must be designed correctly from the start -- a loop in production burns Actions minutes rapidly and can lock out the repository.

---

### Pitfall 6: Upstream Force-Push Breaks Sync Workflow Assumptions

**What goes wrong:**
The sync workflow maintains a reference to the last synced upstream commit (either in a file, a git tag, or a branch pointer). If upstream does a force-push (rebases master, squashes commits, or rewrites history), the fork's reference points to a commit that no longer exists in upstream's history. The sync workflow attempts `git merge upstream/master` and either fails (if the merge base is gone) or creates a massive spurious diff (if git finds a distant common ancestor).

**Why it happens:**
The upstream repository (paperclipai/paperclip) is a relatively young project (started recently). Young projects are more likely to force-push to clean up history. The upstream already has squash-merge patterns visible in the commit log. If the upstream maintainers decide to squash their master branch or do a history rewrite, every fork's sync mechanism breaks.

**How to avoid:**
1. Before each sync, verify the merge base still exists: `git merge-base --is-ancestor <last-synced-commit> upstream/master`. If this fails, the sync workflow should STOP and alert, not proceed with a broken merge.
2. Store the last synced upstream commit SHA in a tracking file (`.planning/upstream-sync-state.json` or similar) and update it after each successful sync. This provides an audit trail and recovery point.
3. If a force-push is detected, the recovery strategy is: identify the new equivalent commit in upstream's rewritten history (by commit message or tree comparison), update the tracking reference, and proceed with the delta from the new reference.
4. Configure the sync workflow to `git fetch --force upstream master` (note: `--force` is necessary to update local refs when upstream force-pushes). Without `--force`, the local `upstream/master` ref becomes stale and all future syncs silently do nothing.
5. Consider using `git merge --no-ff upstream/master` (no fast-forward) to always create a merge commit, making it easy to revert a bad sync.

**Warning signs:**
- Sync workflow succeeds but produces a diff with thousands of unexpected file changes.
- `git log upstream/master` shows a different history than expected (commits you've already synced reappearing with different SHAs).
- `git merge-base master upstream/master` returns a very old commit (pre-fork divergence point).

**Phase to address:**
Phase 2 (continuous sync automation). The sync workflow must include force-push detection from day one.

---

### Pitfall 7: Dockerfile Merge Creates Broken Container

**What goes wrong:**
The fork's Dockerfile has significant customizations over upstream:
- **Lightpanda browser binary** installation (upstream has none)
- **gosu + gh CLI** installation for privilege management (upstream uses simple `USER node`)
- **Custom entrypoint.sh** (upstream uses direct `CMD`)
- **Non-root paperclip user** with gosu privilege drop (upstream uses the built-in `node` user)

Upstream's Dockerfile changes add the gemini-local adapter `package.json` COPY and switch to `--chown=node:node` with `USER node`. A naive merge produces a Dockerfile that either: (a) has the Lightpanda/gosu layers but also the `USER node` directive (breaking the gosu privilege drop), or (b) drops the fork's customizations entirely.

The Dockerfile is a linear execution script where order matters -- you cannot safely combine two divergent Dockerfiles by taking "both changes." Each layer depends on the state from previous layers.

**Why it happens:**
Dockerfiles are not modular. Unlike source code where you can merge independent functions, Dockerfile instructions are sequential and stateful. The fork and upstream have fundamentally different security models (gosu-based privilege drop vs. simple USER directive), and these are not compositionally mergeable.

**How to avoid:**
1. Treat the Dockerfile as a **fork-owned file** that is manually updated when upstream changes are relevant. Do not auto-merge it.
2. When upstream adds a new `COPY packages/adapters/X/package.json` line, add it to the fork's Dockerfile manually -- this is a one-line change.
3. Maintain a diff document (`.planning/dockerfile-upstream-delta.md`) that tracks which upstream Dockerfile changes have been incorporated and which are intentionally divergent.
4. After any merge that touches the Dockerfile, build the image locally and verify: (a) the container starts, (b) the entrypoint runs correctly, (c) the health check passes, (d) Lightpanda binary exists, (e) gosu works.
5. Add a CI step that builds the Docker image on sync PRs (not just on master push).

**Warning signs:**
- Docker build failing with permission errors.
- Container starting as root (gosu not working).
- Container starting but agents cannot use Lightpanda (binary missing).
- Health check failing (server not starting due to permission issues on /paperclip volume).

**Phase to address:**
Every merge phase that touches Docker-related files. The Dockerfile should be on a "manual merge only" list.

## Technical Debt Patterns

Shortcuts that seem reasonable during sync but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `git merge -X theirs upstream/master` (accept all upstream) | Fast merge, no manual conflict resolution | Silently drops ALL fork features in conflicting files | Never for this project |
| Skipping lockfile regeneration (accept ours) | Avoids lockfile resolution complexity | Dependency versions drift, builds may fail on CI but not locally | Never -- always regenerate |
| Disabling fork tests that fail after merge | Unblocks the merge | Fork features are broken and nobody notices until a user reports it | Only if the test is genuinely obsolete (upstream removed the feature the test covers) |
| Squashing the sync merge into one commit | Clean git history | Cannot `git bisect` to find which upstream change broke something | Only for very small syncs (< 5 upstream commits) |
| Hardcoding `[skip ci]` in sync commit messages | Prevents workflow loops | Sync merges skip verification, broken code lands on master | Only for lockfile-only commits, never for code changes |
| Using a separate "sync" branch that is periodically merged to master | Isolates sync risk from master | Sync branch diverges from master, creating a second merge problem | Acceptable as a staging strategy IF the sync branch is short-lived (merged within 24 hours) |

## Integration Gotchas

Common mistakes when connecting sync automation to existing CI infrastructure.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Sync workflow + refresh-lockfile | Sync PR contains lockfile changes, `pr-policy.yml` rejects it | Sync workflow must NOT include `pnpm-lock.yaml`. Let `refresh-lockfile-pr.yml` (if adopted from upstream) or manual regeneration handle it. |
| Sync workflow + pr-verify | Sync PR fails typecheck because merged schema types are inconsistent | Sync PRs must pass `pnpm -r typecheck && pnpm test:run && pnpm build` before merge. If they fail, the merge needs manual intervention. |
| Upstream schedule trigger + GitHub API rate limits | Sync workflow polls upstream every 5 minutes, hits rate limits | Use `on: schedule` with a 6-12 hour interval. Use conditional `git rev-parse upstream/master` to skip if no new commits. |
| Drizzle migration + Docker embedded postgres | Merged migrations reference columns that do not exist in the embedded postgres schema | Always test migration on a fresh database AND on an existing fork database. Docker quickstart must work from scratch. |
| GitHub Actions permissions + fork push | Sync workflow cannot push to fork because `GITHUB_TOKEN` lacks `contents: write` | Explicitly set `permissions: contents: write` in the workflow job. Verify the repository settings allow Actions to create and approve PRs. |
| PR auto-merge + branch protection | Sync PR auto-merges without review, bypassing branch protection rules | Sync PRs should require at least a passing CI check. Human review is recommended for the first several syncs until confidence is established. |

## Performance Traps

Patterns that work for occasional syncs but fail as sync frequency increases.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full `pnpm install` on every sync PR | CI takes 5+ minutes per sync check | Use `pnpm install --frozen-lockfile` with cached store. Only regenerate lockfile when `package.json` files change. | When syncing more than once per day |
| Docker image rebuild on every sync | Deployment takes 10+ minutes after each sync | Use multi-stage builds with proper layer caching. Only rebuild when Dockerfile or lockfile changes. | When syncing more than once per week |
| Running all 411 tests on every sync check | CI takes 15+ minutes per sync PR | Prioritize: typecheck (fast) -> unit tests (medium) -> build (slow). Consider test impact analysis to run only affected tests. | When test suite grows beyond 500 tests |
| Fetching full upstream history on each sync | `git fetch upstream` transfers entire history | Use `git fetch upstream master --depth=1` for comparison, full fetch only when merge is needed. | When upstream has 1000+ commits |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing PAT in workflow file instead of repository secret | Token exposed in commit history | Use `${{ secrets.SYNC_PAT }}` and rotate the token periodically |
| Sync workflow has `contents: write` + `pull-requests: write` on a PAT | Compromised PAT can push arbitrary code | Use fine-grained PAT with minimum required permissions. Prefer `GITHUB_TOKEN` where possible. |
| Auto-merging sync PRs without CI verification | Upstream could introduce malicious code (supply chain risk) | Always require CI checks to pass. For high-security environments, require human review. |
| Upstream adds new dependencies that have known vulnerabilities | Vulnerability introduced silently through sync | Add `pnpm audit` step to sync PR verification. Review new dependencies added by upstream. |

## "Looks Done But Isn't" Checklist

Things that appear complete after a sync merge but have hidden breakage.

- [ ] **Migration ordering:** Migrations compile and `drizzle-kit migrate` succeeds on fresh DB -- but verify it also works on an existing fork DB with data. The `__drizzle_migrations` table records applied migrations by name, not by index.
- [ ] **Schema barrel exports:** `packages/db/src/schema/index.ts` has all fork exports AND upstream exports -- verify by checking the re-exported types in `packages/shared/src/types.ts` still compile.
- [ ] **Service registrations:** `server/src/services/index.ts` has all fork services registered -- a missing registration means the service exists but is never instantiated, causing silent 500s.
- [ ] **Route registrations:** `server/src/app.ts` has all fork routes mounted -- missing routes return 404 but the server starts fine, appearing "healthy."
- [ ] **UI route definitions:** `ui/src/App.tsx` (or equivalent router) has routes for all fork pages -- missing UI routes show blank pages or redirect to 404, not a crash.
- [ ] **Adapter registry:** `server/src/adapters/registry.ts` includes upstream's new gemini-local adapter AND all fork adapter customizations.
- [ ] **Docker COPY statements:** `Dockerfile` deps stage has COPY lines for ALL packages (including upstream's new gemini-local and any fork-specific packages).
- [ ] **Workflow files:** `.github/workflows/` has fork's workflows intact and upstream's new workflows (e2e.yml, release.yml) are either adopted or intentionally excluded.
- [ ] **Test count:** Run `pnpm test:run` and verify the test count is >= pre-merge count. A drop indicates deleted or broken tests.
- [ ] **pnpm workspace:** `pnpm-workspace.yaml` includes all packages from both fork and upstream.

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Corrupted Drizzle journal | MEDIUM | Regenerate `_journal.json` from the actual SQL files on disk. Each .sql file's index prefix determines its position. Regenerate snapshot files by applying migrations sequentially to a fresh DB and running `drizzle-kit introspect` at each step. |
| Fork feature silently lost | LOW-MEDIUM | `git log --all -p -- path/to/file` to find the last commit that had the feature. Cherry-pick or manually restore. If caught early (before next sync), the fork feature manifest checklist identifies what to restore. |
| Docker build broken | LOW | Build locally to diagnose. Common fix: add missing COPY line for new packages, resolve USER/permission conflicts. Docker builds are deterministic -- if it works locally, it works on CI. |
| Infinite workflow loop | LOW | Cancel all running workflows in GitHub UI. Remove the PAT from the sync workflow, replace with GITHUB_TOKEN. Force-push a commit that fixes the workflow file. Audit Actions usage for billing impact. |
| Lockfile desync | LOW | Delete `pnpm-lock.yaml`, run `pnpm install --lockfile-only`, commit. The refresh-lockfile workflow exists precisely for this case. |
| Upstream force-push breaks sync | MEDIUM | Identify the new upstream HEAD. Run `git merge-base master upstream/master` to find the new common ancestor. If the merge base is reasonable, proceed with merge from there. If not, use `git log --oneline upstream/master` to find the equivalent of the last synced commit and update the tracking reference. |
| Semantic conflict breaks runtime | HIGH | Requires manual debugging. Run the full test suite, then manually test fork features. Use `git bisect` on the merge commits to identify which upstream change introduced the regression. This is why incremental merging (chunked by area) is critical -- it limits the search space for bisection. |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Migration index collision | Phase 1: Preparation (migration strategy) | `drizzle-kit migrate` succeeds on fresh DB and existing fork DB; _journal.json has sequential indices with no gaps |
| Silent semantic conflicts | Phase 1: Preparation (canary tests) + Phase 2-3: Each merge chunk | Full test suite passes; fork feature manifest checklist passes; no 500 errors on fork API endpoints |
| Lockfile/Docker cache invalidation | Phase 1: Preparation (workflow reconciliation) | Docker build succeeds with `--frozen-lockfile`; CI build time < 10 minutes; no spurious lockfile refresh commits |
| Losing fork features | Phase 2-3: Each merge chunk | Fork feature manifest checklist passes; test count >= pre-merge count; all fork UI pages render |
| Sync workflow trigger loop | Phase 4: Continuous sync setup | Sync workflow creates PR without triggering additional workflows; no workflow runs from bot commits |
| Upstream force-push handling | Phase 4: Continuous sync setup | Sync workflow detects force-push and halts with alert; merge-base validation passes before every sync |
| Dockerfile breakage | Phase 2-3: Each merge chunk that touches Docker | Docker image builds; container starts; health check passes; Lightpanda binary exists; gosu works |

## Sources

- [Drizzle ORM: Merge conflicting migrations (issue #2488)](https://github.com/drizzle-team/drizzle-orm/issues/2488) -- confirms no built-in migration conflict resolution
- [Drizzle ORM: Best way to deal with migration merge conflicts (discussion #1104)](https://github.com/drizzle-team/drizzle-orm/discussions/1104) -- community workarounds for parallel migration conflicts
- [Drizzle ORM: Feature request for timestamp-based naming (issue #2588)](https://github.com/drizzle-team/drizzle-orm/issues/2588) -- ongoing discussion about better naming strategies
- [Martin Fowler: Semantic Conflict](https://martinfowler.com/bliki/SemanticConflict.html) -- foundational description of silent merge conflicts
- [GitHub Docs: Syncing a fork](https://docs.github.com/articles/syncing-a-fork) -- official fork sync documentation
- [GitHub Community: Workflow infinite loop (discussion #26970)](https://github.com/orgs/community/discussions/26970) -- GITHUB_TOKEN vs PAT behavior for workflow triggering
- [GitHub Community: Push from Action does not trigger subsequent action (discussion #25702)](https://github.com/orgs/community/discussions/25702) -- confirms GITHUB_TOKEN prevents cascading triggers
- [pnpm: Git Branch Lockfiles](https://pnpm.io/git_branch_lockfiles) -- pnpm's built-in lockfile conflict avoidance
- [pnpm: Lockfile assembly discussion (#4324)](https://github.com/orgs/pnpm/discussions/4324) -- monorepo lockfile conflict patterns
- [pnpm: Working with Docker](https://pnpm.io/docker) -- recommended Docker patterns for pnpm
- [Repair Drizzle Migration Conflict Script (community gist)](https://gist.github.com/gburtini/7e34842c567dd80ee834de74e7b79edd) -- community script for automated migration conflict repair
- Codebase analysis: actual migration files, _journal.json contents, and `git diff` output from this repository (verified 2026-03-12)

---
*Pitfalls research for: upstream fork sync and continuous integration*
*Researched: 2026-03-12*
