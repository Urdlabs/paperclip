# Technology Stack: Upstream Sync & Continuous Integration

**Project:** Paperclip (Urdlabs Fork) - v1.1 Upstream Sync Milestone
**Researched:** 2026-03-12
**Overall Confidence:** HIGH

## Context

Paperclip fork is 226 commits behind upstream/master and 120 ahead. Diverged at commit c674462 (PR #238). A dry-run merge reveals 16 files with actual conflicts out of 285 upstream-changed files. The overlap is manageable: most fork additions (token analytics, observability, webhooks, skill profiles, code review) live in new files that upstream never touched. The conflict hotspots are: Dockerfile, server entry/routing, heartbeat service, DB migration numbering collisions, UI routing/layout, and pnpm-lock.yaml.

Existing CI already has 3 GitHub Actions workflows (pr-policy, pr-verify, refresh-lockfile) using actions/checkout@v4, actions/setup-node@v4 (Node 20), and pnpm/action-setup@v4. The project Dockerfile runs Node 22.

This stack covers ONLY what is needed for the sync milestone. v1.0 stack (Express 5, React 19, Drizzle, etc.) is validated and unchanged.

## Recommended Stack

### GitHub Actions (Workflow Automation)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `actions/checkout` | @v4 | Repository checkout with full history | Keep @v4 for now. Existing workflows use v4, and it works. The v6 release requires Node 24 runtime which GitHub runners support, but upgrading all 3 existing workflows simultaneously with the sync work adds unnecessary risk. Upgrade to v6 in a separate chore PR. | HIGH |
| `actions/setup-node` | @v4 | Node.js environment setup | Same rationale -- keep @v4 for consistency with existing workflows. v6 dropped pnpm caching (now npm-only), so we would need to adjust caching strategy. Not worth it during sync milestone. | HIGH |
| `pnpm/action-setup` | @v4 | pnpm installation | Already at latest major. Works reliably. | HIGH |
| `peter-evans/create-pull-request` | @v7 | Automated PR creation for sync workflow | Creates PRs from workspace changes. Use v7 (not v8) because v8 requires Actions Runner v2.327.1+ for Node 24, and we want broad compatibility with GitHub-hosted runners. v7 is stable and actively maintained. | HIGH |
| `actions/github-script` | @v7 | PR labeling and comment automation | Lightweight inline JavaScript for GitHub API calls (add labels, post conflict summaries as PR comments). Use v7 for Node 20 compatibility with existing runner setup. | HIGH |

**Action version rationale:** All kept at the Node 20 generation (@v4/@v7) for consistency. The Node 24 generation (@v6/@v8) is available but introduces a runtime change across all workflows. Schedule a separate "upgrade CI to Node 24 actions" chore after sync is stable.

### Git Strategy (No Libraries Needed)

| Strategy | Purpose | Why | Confidence |
|----------|---------|-----|------------|
| `git merge` (not rebase) | Integrate upstream commits | With 226 upstream commits and 120 fork commits, rebase would replay our 120 commits one-by-one onto upstream HEAD -- each could conflict individually, and it rewrites all our commit SHAs, breaking any references. Merge creates a single merge commit, conflicts are resolved once, history is preserved on both sides. This is the textbook case for merge over rebase. | HIGH |
| Incremental merge by area | Chunk conflict resolution | Merge upstream in logical batches: (1) non-conflicting files first (fast-forward areas), (2) DB migrations, (3) server core, (4) UI layer. Each batch gets tested before the next. Reduces blast radius of any single conflict resolution error. | HIGH |
| `git merge --no-commit --no-ff` | Dry-run conflict detection | Used in the sync workflow to detect conflicts without committing. If conflicts exist, the workflow creates a PR with the conflict report. If clean, it auto-merges and creates a verification PR. | HIGH |
| `git rerere` (reuse recorded resolution) | Avoid re-resolving same conflicts | Enable `rerere.enabled=true` in the repo. Git records conflict resolutions and auto-applies them if the same conflict appears again (common during iterative sync). Zero-cost insurance. | MEDIUM |

**Do NOT use:**
- `git rebase` -- rewrites 120 fork commits, forces force-push, loses merge context, each of 120 commits could conflict individually
- `git cherry-pick` in batch -- same individual-conflict problem as rebase, plus loses the "merged upstream at commit X" marker
- Third-party merge tools (Mergify, Kodiak) -- overkill for a single-developer fork. Raw git + GitHub Actions is simpler and fully controllable

### Conflict Detection & Resolution

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `git diff --name-only --diff-filter=U` | Built-in | List conflicted files after merge attempt | Standard git. No external tool needed. The sync workflow uses this to generate a conflict report. | HIGH |
| `pnpm install --lockfile-only` | Existing | Regenerate pnpm-lock.yaml after merge | pnpm-lock.yaml will always conflict (it is a generated artifact). The correct resolution is always: accept both package.json changes, then regenerate the lockfile. Never manually merge lockfiles. | HIGH |
| `pnpm drizzle-kit generate` | Existing | Regenerate DB migration metadata after renumbering | Migration 0026/0027 collide between fork and upstream (different tables, same numbers). Resolution: renumber fork migrations to 0028/0029, regenerate `_journal.json` and snapshots. The content (SQL) is fine -- only the ordering metadata conflicts. | HIGH |

### Verification Pipeline (Post-Merge)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `vitest` | ^3.0.5 (existing) | Run full test suite after merge | 411 tests (374 server, 37 UI) validate that fork features survive upstream merge. No new dependency needed. | HIGH |
| `pnpm -r typecheck` | Existing | TypeScript compilation check | Catches type-level incompatibilities introduced by upstream changes (e.g., upstream changed a shared type that our fork also extends). | HIGH |
| `pnpm build` | Existing | Full build verification | Ensures all packages build successfully after merge. Catches import/export issues. | HIGH |
| Custom v1.0 smoke test script | New (bash) | Verify v1.0 features specifically | A focused script that hits key v1.0 endpoints (token analytics, webhook config, skill profiles) to verify they survived the merge. Not a new dependency -- a shell script using curl against the built server. | MEDIUM |

### New Workflow: `upstream-sync.yml`

| Aspect | Decision | Why |
|--------|----------|-----|
| Trigger | `schedule: cron '0 6 * * 1'` + `workflow_dispatch` | Weekly Monday 6 AM UTC check is frequent enough for upstream's pace (~5-10 commits/week). Manual dispatch for on-demand sync. |
| Detection | `git fetch upstream && git rev-list HEAD..upstream/master --count` | If count > 0, upstream has new commits. Simple, reliable, no API calls needed. |
| Clean merge path | Auto-merge + create verification PR | If `git merge --no-commit` succeeds with no conflicts, commit the merge, push to a branch, create PR with "upstream-sync" label for review. PR triggers existing pr-verify workflow (typecheck + test + build). |
| Conflict path | Create conflict-report PR | If merge has conflicts, abort merge, create a PR with a comment listing conflicted files and their categories (server/UI/DB/config). Human resolves manually. |
| Branch naming | `upstream-sync/YYYY-MM-DD` | Date-stamped for clarity. Old branches auto-cleaned after merge. |
| Permissions | `contents: write`, `pull-requests: write` | Minimum required. Uses default `GITHUB_TOKEN` -- no PAT needed since we are not triggering other workflows from the sync PR. |

## What NOT to Add

| Rejected Tool | Why Not |
|---------------|---------|
| Mergify / Kodiak | Auto-merge bots designed for team PRs, not fork sync. Adds external dependency and configuration complexity for a problem solved by 30 lines of shell script. |
| GitHub's built-in "Sync fork" button / API | Only does fast-forward sync. With 120 commits ahead, it cannot sync -- it would require discarding our changes. Useless for diverged forks. |
| `aormsby/Fork-Sync-With-Upstream-action` | Designed for "clean" forks that track upstream without divergence. Does not handle conflict detection or PR creation for diverged forks. Would silently fail or force-push. |
| Separate merge driver for lockfiles | `pnpm install --lockfile-only` already handles this. A custom merge driver adds `.gitattributes` complexity for no gain. |
| git-filter-repo / BFG | History rewriting tools. We want to preserve history, not rewrite it. |
| Dependabot / Renovate for upstream | These track package versions, not upstream repository commits. Wrong tool for the job. |

## Existing Workflow Updates Needed

The 3 existing workflows need minor updates to work smoothly with the sync process:

| Workflow | Change | Why |
|----------|--------|-----|
| `pr-verify.yml` | Add `upstream-sync/**` to branch trigger | Sync PRs need the same typecheck + test + build verification as regular PRs. |
| `pr-policy.yml` | Exempt `upstream-sync/**` branches from lockfile edit block | Sync PRs legitimately regenerate pnpm-lock.yaml. The policy should skip the lockfile check when the PR branch starts with `upstream-sync/`. |
| `refresh-lockfile.yml` | No changes needed | Only triggers on push to master. Sync merges go through PR first. |

## Node Version Note

Current mismatch: Dockerfile uses Node 22, CI uses Node 20. This is not a sync-milestone concern but should be addressed soon. Node 20 LTS reaches EOL April 2026. Recommend upgrading CI to Node 22 in a separate chore after sync is complete.

## Installation

```bash
# No new npm dependencies needed for the sync milestone.
# All tooling is git (built-in) + GitHub Actions (YAML config) + existing pnpm/vitest/tsc.

# The only "installation" is creating new workflow files:
# .github/workflows/upstream-sync.yml  (new)
# .github/workflows/pr-verify.yml      (update branch trigger)
# .github/workflows/pr-policy.yml      (update lockfile exemption)
```

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Merge strategy | `git merge` (single merge commit) | `git rebase` | Rewrites 120 commits, individual conflicts per commit, force-push required |
| Merge approach | Incremental by area | Big-bang single merge | 16 conflicts at once is manageable, but incremental allows testing between chunks |
| Sync automation | Custom workflow (30 lines shell) | `aormsby/Fork-Sync-With-Upstream-action` | Cannot handle diverged forks, no conflict detection |
| PR creation | `peter-evans/create-pull-request@v7` | `gh pr create` in shell | peter-evans handles branch creation, pushing, and PR update in one step; less shell scripting |
| Conflict resolution | Manual (human-in-the-loop) | Auto-resolution with `git merge -X theirs` | Silently drops our changes. Unacceptable for a fork with 120 custom commits. |
| Action versions | Stay at v4/v7 (Node 20 gen) | Upgrade to v6/v8 (Node 24 gen) | Unnecessary risk during sync milestone. Upgrade separately. |

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Git merge strategy | HIGH | Textbook case: large diverged fork, many commits both sides, merge preserves both histories |
| Conflict count (16 files) | HIGH | Verified with actual dry-run `git merge --no-commit` against current upstream/master |
| GitHub Actions versions | HIGH | Verified release pages directly. v4/v7 are current stable for Node 20 runners. |
| peter-evans/create-pull-request | HIGH | Well-maintained (v7.0.11 latest patch), 10K+ stars, standard for automated PRs |
| DB migration resolution | HIGH | Inspected actual conflict: fork 0026/0027 vs upstream 0026/0027 have different table names. Renumbering fork to 0028/0029 is clean. |
| Workflow design | MEDIUM | Standard patterns, but the conflict-detection-then-PR-creation flow needs testing. Edge cases: concurrent sync runs, upstream force-push, empty diff after merge. |

## Sources

- [actions/checkout releases](https://github.com/actions/checkout/releases) -- v6.0.2 latest, v4.3.1 for Node 20
- [actions/setup-node releases](https://github.com/actions/setup-node/releases) -- v6.3.0 latest, v4 for Node 20
- [pnpm/action-setup](https://github.com/pnpm/action-setup) -- v4.3.0 latest
- [peter-evans/create-pull-request releases](https://github.com/peter-evans/create-pull-request/releases) -- v8.1.0 latest (Node 24), v7.0.11 for Node 20
- [actions/github-script](https://github.com/actions/github-script) -- v8 latest (Node 24), v7.1.0 for Node 20
- [Atlassian: Merging vs Rebasing](https://www.atlassian.com/git/tutorials/merging-vs-rebasing) -- Strategy rationale
- [Drizzle ORM migration conflicts discussion](https://github.com/drizzle-team/drizzle-orm/discussions/1104) -- Migration renumbering approach
- [GitHub Docs: Events that trigger workflows](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows) -- schedule/cron syntax
- [GitHub Docs: Sync Forks](https://dev.to/github/sync-forks-to-upstream-using-github-actions-gle) -- Fork sync patterns
- [Node 20 deprecation on GitHub Actions](https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/) -- Node 20 EOL timeline
