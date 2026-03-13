# Phase 8: Continuous Sync Automation - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

GitHub Action that detects new upstream commits on a weekly schedule (and manual dispatch), auto-creates a sync PR when the merge is clean or a conflict-report issue when conflicts exist, and maintains a sync health badge in the README. Includes lockfile auto-regeneration and rerere seeding from phase 6 resolutions.

</domain>

<decisions>
## Implementation Decisions

### Sync Trigger & Schedule
- Weekly cron schedule (Monday morning) + workflow_dispatch for on-demand sync
- Track upstream/master branch (hardcoded, not configurable)
- Skip silently when no new upstream commits exist (exit early, no artifacts)

### PR Content & Conflict Reporting
- Clean merge → auto-create a PR with the merge commit ready for review
- Conflicts → create a GitHub issue listing conflicting files grouped by area (server, UI, packages, infra)
- No effort estimation in conflict reports — just list the files
- PR body contains upstream changelog grouped by area (server, UI, packages, infra, CLI) using file path analysis

### Lockfile & Rerere Automation
- Delete pnpm-lock.yaml + run `pnpm install` to regenerate (same as phase 6 approach)
- Seed git rerere with the 16 conflict resolutions from phase 6's merge commit
- Enable rerere auto-resolve in the sync workflow — recognized conflicts get resolved and staged automatically

### Sync Health Badge
- Shows both commits-behind count AND last sync date
- Generated via shields.io dynamic badge pointing to a JSON file in the repo (e.g., `.github/sync-status.json`)
- Workflow updates the JSON on each run, shields.io reads it dynamically
- Badge placed in top badges row of README alongside license, stars, discord badges

### Claude's Discretion
- Exact cron expression timing (which hour Monday morning)
- How to extract area grouping from commit file paths
- rerere seeding technique (replay merge or extract from existing commit)
- JSON schema for sync-status.json
- Workflow YAML structure and job organization

</decisions>

<specifics>
## Specific Ideas

- The `upstream` remote is already configured at `git@github.com:paperclipai/paperclip.git`
- 5 existing workflows in `.github/workflows/` (e2e, pr-policy, pr-verify, refresh-lockfile, release) — follow their patterns
- Phase 6 merged all 226 commits in commit `8c83b0d` with 16 conflict resolutions — source for rerere seeding
- CONFLICT-MAP.md has the area grouping logic (DB migrations, server, UI, shared packages, infrastructure) that can inform changelog grouping

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.github/workflows/refresh-lockfile.yml`: Existing lockfile regeneration workflow — pattern for pnpm install in CI
- `.github/workflows/pr-verify.yml`: PR verification workflow — pattern for CI checks on sync PRs
- `.planning/CONFLICT-MAP.md`: Area grouping reference (DB, server, UI, shared, infra) for changelog and conflict categorization

### Established Patterns
- GitHub Actions with pnpm setup (likely uses pnpm/action-setup)
- Workflow dispatch for manual triggering (pattern in existing workflows)
- Git remote `upstream` already configured for fetch

### Integration Points
- README.md badges row: 3 existing badges (license, stars, discord) — new badge goes alongside
- `.github/sync-status.json`: New file for shields.io dynamic badge data
- `.github/workflows/upstream-sync.yml`: New workflow file

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-continuous-sync-automation*
*Context gathered: 2026-03-13*
