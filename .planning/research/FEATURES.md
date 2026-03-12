# Feature Landscape: Upstream Sync & Continuous Integration

**Domain:** Fork maintenance automation for diverged TypeScript monorepo
**Researched:** 2026-03-12
**Overall confidence:** HIGH

## Table Stakes

Features required for a safe upstream merge and ongoing sync. Missing any of these makes the merge risky or the fork's future maintenance unsustainable.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Conflict detection before merge | 16 files have actual conflicts. Merging blind breaks the build. | Low | `git merge --no-commit --no-ff` in CI detects all conflicts without touching master. Already proven in dry-run. |
| Incremental merge by area | Resolving 16 conflicts simultaneously is error-prone. Batching by layer (DB, server, UI, infra) isolates blast radius. | Medium | Each batch gets tested before the next. Rollback is per-batch, not all-or-nothing. |
| Post-merge CI verification | Even clean text merges can produce semantic conflicts (type errors, broken imports). Must verify. | Low | Existing `pr-verify.yml` already runs typecheck + test + build. Sync PRs trigger it automatically. |
| v1.0 feature survival verification | Fork has 120 custom commits with token analytics, webhooks, skill profiles, code review. These must survive. | Medium | 411 tests cover most features. Add targeted smoke tests for high-value v1.0 endpoints. |
| Rollback capability | If merge breaks production or introduces subtle regressions, must revert cleanly. | Low | Use merge commits so `git revert -m 1 <merge>` works. Tag pre-merge state as safety net. |
| Automated upstream change detection | Fork drifted 226 commits behind because nobody checked. Automated detection prevents this from happening again. | Low | Scheduled `git fetch upstream && git rev-list --count` in GitHub Action. |
| Automated sync PR creation | Detection without action is useless. Auto-create a PR when upstream has new commits. | Low | `peter-evans/create-pull-request@v7` creates PR with upstream commit summary in body. |
| Lockfile regeneration | pnpm-lock.yaml always conflicts between fork and upstream. Resolution is always regeneration, never manual merge. | Low | `pnpm install --lockfile-only` after accepting both sides' package.json changes. |
| DB migration conflict resolution | Fork 0026-0029 and upstream 0026-0027 collide on migration numbers with different table schemas. | Medium | Renumber fork migrations to 0028+, regenerate Drizzle journal/snapshots. One-time manual work. |

## Differentiators

Features that make the sync workflow excellent rather than merely functional. High value for ongoing maintenance.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Upstream changelog in sync PR body | When a sync PR arrives with 30 new commits, the maintainer needs to understand what changed without reading each commit. | Low | Parse `git log --oneline` from upstream, group by path area (server/, ui/, packages/), include in PR body. |
| Conflict area categorization | Beyond "there are conflicts," report which layer each conflict is in (DB, server, UI, infra) and estimated resolution effort. | Low | Map conflicting file paths to categories. Include in PR comment. |
| Sync health badge | At-a-glance indicator of how far behind upstream the fork is. Visible in README. | Low | `git rev-list --count HEAD..upstream/master` run on schedule, update badge via shields.io dynamic endpoint. |
| Automatic lockfile resolution in workflow | Instead of flagging lockfile as a conflict, auto-resolve it by regeneration in the sync workflow. | Low | After merge, `pnpm install --lockfile-only` regenerates. Commit the result. One fewer manual step. |
| git rerere for repeated conflicts | If the same conflict appears in consecutive syncs (likely for files we consistently modify), git auto-applies previous resolutions. | Low | `git config rerere.enabled true`. Zero runtime cost. Records resolutions automatically. |

## Anti-Features

Features to explicitly NOT build. These seem helpful but add complexity without proportional value or actively harm the workflow.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Auto-merge sync PRs without review | 16 files have real conflicts. Auto-merge would silently break the build or lose fork features. | Always require PR review. Auto-create, never auto-merge. |
| Rebase-based sync | Rewrites 120 fork commits, forces force-push, each commit conflicts individually, breaks rollback with `git revert`. | Use merge commits. Single conflict resolution, preserved history, clean rollback. |
| Real-time sync (webhook on every upstream push) | Upstream pushes multiple times per day (lockfile refreshes, merge commits). Creates PR noise and CI churn. | Weekly schedule (Monday 6 AM UTC). Batches upstream changes. Manual dispatch for urgent syncs. |
| AI-powered conflict resolution | Fork conflicts are in critical code (heartbeat service, app entry, DB migrations). Wrong resolution breaks the platform. | Resolve manually. 16 files is manageable. Domain knowledge required. |
| Cherry-pick individual commits | Slower than merge for 226 commits. Loses the "merged upstream at X" marker. Each commit can conflict. | Use merge. Revert specific unwanted commits post-merge if needed. |
| Separate tracking branch mirroring upstream | Adds cognitive overhead. Two sources of truth. Diverges over time. | Sync directly to master via PR. One source of truth. |
| Third-party sync services (Mergify, Kodiak) | External dependency and configuration for a problem solved by 30 lines of shell in GitHub Actions. | Custom workflow. Full control, no external service, no cost. |

## Feature Dependencies

```
Conflict detection --> Incremental merge (detection informs merge order)
Incremental merge --> Post-merge CI verification (each chunk triggers CI)
Post-merge CI verification --> v1.0 feature verification (extends CI with feature checks)
Merge commits --> Rollback capability (merge commits enable git revert -m 1)
Automated change detection --> Automated sync PR creation (detection triggers PR)
Automated sync PR creation --> Upstream changelog in PR body (PR body content)
Automated sync PR creation --> Conflict area categorization (conflict report in PR)
Lockfile regeneration --> Post-merge CI verification (regenerated lockfile must pass CI)
DB migration resolution --> Post-merge CI verification (renumbered migrations must pass tests)
```

## MVP Recommendation

### Phase 1-3: Initial Upstream Merge (one-time, manual)

Prioritize:
1. **Conflict detection** -- map all 16 conflicts, categorize by area
2. **DB migration resolution** -- renumber fork 0026-0029 to 0028-0031, regenerate metadata
3. **Incremental merge** -- non-conflicting files first, then DB, server, UI
4. **Post-merge CI verification** -- existing pr-verify runs after each chunk
5. **v1.0 feature verification** -- full test suite + targeted smoke tests
6. **Rollback capability** -- tag pre-merge state, use merge commits

### Phase 4: Continuous Sync Automation (GitHub Action)

Build after initial merge:
1. **Automated upstream change detection** -- scheduled cron
2. **Automated sync PR creation** -- with upstream changelog and conflict report
3. **Automatic lockfile resolution** -- regenerate in workflow
4. **Sync health badge** -- commits-behind counter

### Defer

- **Selective sync (cherry-pick mode)**: Not needed at current upstream pace
- **AI conflict resolution**: 16 conflicts is manageable manually
- **Real-time sync**: Weekly is sufficient

## Sources

- Direct codebase analysis: `git merge --no-commit --no-ff upstream/master` dry-run
- [GitHub Docs: Syncing a fork](https://docs.github.com/articles/syncing-a-fork)
- [Atlassian: Merging vs. Rebasing](https://www.atlassian.com/git/tutorials/merging-vs-rebasing)
- [peter-evans/create-pull-request](https://github.com/peter-evans/create-pull-request)
