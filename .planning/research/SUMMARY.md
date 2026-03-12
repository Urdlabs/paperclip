# Project Research Summary

**Project:** Paperclip (Urdlabs Fork) -- v1.1 Upstream Sync & Continuous Integration
**Domain:** Fork maintenance automation for diverged TypeScript monorepo
**Researched:** 2026-03-12
**Confidence:** HIGH

## Executive Summary

The Paperclip fork is 226 commits behind upstream and 120 commits ahead, diverged at commit c674462. Despite the large commit differential, a dry-run `git merge --no-commit` reveals a manageable conflict surface: 16 files with actual textual conflicts out of 285 upstream-changed files. The fork's v1.0 features (token analytics, context optimization pipeline, webhooks, skill profiles, code review) overwhelmingly live in new files that upstream never touched, so they survive the merge untouched. The conflict hotspots are concentrated in four zones: server entry/routing (index.ts, app.ts, heartbeat.ts), UI layout/routing (App.tsx, AgentDetail.tsx, AgentConfigForm.tsx), database migration numbering (0026/0027 index collisions with completely different schemas), and infrastructure (Dockerfile, pnpm-lock.yaml).

The recommended approach is a `git merge` (not rebase) executed on an `upstream-sync` branch, resolved in six dependency-ordered chunks (shared packages, then DB, then server, then adapters, then UI, then infrastructure), with the existing 411-test CI suite verifying each chunk. No new npm dependencies are needed. The entire tooling requirement is one new GitHub Actions workflow file (~80 lines of YAML), minor exemption updates to two existing workflows, and standard git commands. After the one-time catch-up merge, a weekly scheduled GitHub Action detects upstream changes and auto-creates either a clean-merge PR or a conflict-report issue. The `peter-evans/create-pull-request@v7` action and `GITHUB_TOKEN` (not a PAT) handle automation without triggering workflow loops.

The single hardest technical problem in this milestone is the Drizzle migration index collision. Fork migrations 0026-0030 and upstream migrations 0026-0027 occupy overlapping numbers with entirely different SQL schemas, and fork migrations are already applied to production databases. The solution is to renumber upstream's two migrations to 0031-0032, regenerate the `_journal.json` and snapshot metadata, and verify against both fresh and existing databases. Every other conflict is a standard text-level merge resolvable with domain knowledge. The second major risk is silent semantic conflicts -- code that merges cleanly but breaks at runtime because both sides modified related behavior without touching the same lines. This is mitigated by chunked merging with full CI verification between chunks and a fork feature manifest checklist.

## Key Findings

### Recommended Stack

No new npm dependencies are needed for this milestone. The existing tooling stack (pnpm, vitest, tsc, Drizzle) plus git and GitHub Actions covers all requirements. Action versions are pinned to the Node 20 generation (@v4/@v7) for consistency with the three existing workflows; upgrading to the Node 24 generation (@v6/@v8) is deferred to a separate chore PR.

**Core technologies:**
- **`git merge` (not rebase)**: Upstream integration -- with 120 fork commits and 226 upstream commits, merge creates a single conflict resolution point per file, preserves both histories, and enables clean rollback via `git revert -m 1`
- **`peter-evans/create-pull-request@v7`**: Automated PR creation for sync workflow -- handles branch creation, push, and PR update in one step; v7 for Node 20 compatibility
- **`actions/github-script@v7`**: PR labeling and conflict report comments -- lightweight inline JS for GitHub API calls
- **`pnpm install --lockfile-only`**: Lockfile regeneration after merge -- lockfiles are never manually merged, always regenerated
- **`drizzle-kit generate`**: Migration metadata regeneration after renumbering -- verifies schema matches combined migration set

**Critical version note:** Dockerfile uses Node 22 but CI uses Node 20. Not a sync concern, but Node 20 LTS reaches EOL April 2026. Schedule a separate CI upgrade after sync.

### Expected Features

**Must have (table stakes):**
- Conflict detection before merge -- `git merge --no-commit --no-ff` in CI to map all 16 conflicts without touching master
- Incremental merge by area -- batch by layer (shared, DB, server, adapters, UI, infra) to isolate blast radius
- Post-merge CI verification -- existing `pr-verify.yml` runs typecheck + tests + build after each chunk
- v1.0 feature survival verification -- 411 tests plus targeted smoke tests for token analytics, webhooks, skill profiles, code review
- Rollback capability -- merge commits enable `git revert -m 1`; pre-merge tag as safety net
- DB migration conflict resolution -- renumber fork migrations, regenerate Drizzle journal and snapshots
- Lockfile regeneration -- always regenerate, never manually merge pnpm-lock.yaml
- Automated upstream change detection -- scheduled `git fetch upstream && git rev-list --count`
- Automated sync PR creation -- with upstream changelog and conflict categorization in PR body

**Should have (differentiators):**
- Upstream changelog in sync PR body -- grouped by area (server, UI, packages) for quick maintainer review
- Conflict area categorization -- map file paths to layers with estimated resolution effort
- Sync health badge -- commits-behind counter in README via shields.io
- Automatic lockfile resolution in workflow -- regenerate instead of flagging as conflict
- `git rerere` enabled -- auto-applies previous conflict resolutions on repeated patterns

**Defer (v2+):**
- Selective cherry-pick sync mode -- not needed at current upstream pace
- AI-powered conflict resolution -- 16 conflicts is manageable manually; domain knowledge required
- Real-time webhook-triggered sync -- weekly schedule is sufficient; real-time creates PR noise

### Architecture Approach

The architecture has two modes sharing the same validation pipeline. The one-time catch-up merge uses an `upstream-sync` branch where all conflicts are resolved in six dependency-ordered chunks, each verified by the CI pipeline before proceeding to the next. The ongoing automated sync is a weekly GitHub Action that fetches upstream, attempts a trial merge, and creates either a clean-merge PR (auto-pushes branch, opens PR for CI + human review) or a conflict-report issue (lists conflicting files by category with resolution instructions). Both modes route through the existing `pr-verify.yml` for validation and require PR review before landing on master.

**Major components:**
1. **`upstream-sync` branch** -- receives upstream merge, workspace for conflict resolution; never merges directly to master
2. **`.github/workflows/upstream-sync.yml`** (NEW) -- scheduled weekly detection + PR/issue creation; uses `GITHUB_TOKEN` to avoid workflow trigger loops
3. **`.github/workflows/pr-verify.yml`** (EXISTING, update trigger) -- validates sync PRs with typecheck + tests + build
4. **`.github/workflows/pr-policy.yml`** (EXISTING, add exemption) -- exempts `upstream-sync/**` branches from lockfile edit block
5. **Pre-merge safety tag** (one-time) -- rollback point if merge goes wrong

**Chunked resolution order (respects monorepo dependency graph):**
1. Foundation: `packages/shared`, `packages/adapter-utils` -- everything depends on these
2. Database: `packages/db` schema + migration renumbering -- server and UI depend on DB types
3. Server core: services, routes, app.ts, index.ts -- depends on shared + DB
4. Adapters: claude-local, codex-local changes + new gemini-local -- depends on adapter-utils
5. UI: components, pages, routing, App.tsx -- depends on shared types
6. Infrastructure: Dockerfile, lockfile, workflow files -- depends on everything above

### Critical Pitfalls

1. **Drizzle migration index collision (0026+)** -- Fork and upstream both created migrations at index 0026 with different schemas. Renumber upstream's 2 migrations to 0031-0032, regenerate `_journal.json` with all 33 entries sequentially, verify on both fresh DB and existing fork DB. This is the single hardest technical problem and must be solved first because every future sync inherits the numbering strategy.

2. **Silent semantic conflicts** -- Code merges cleanly at text level but breaks at runtime. Both sides modified `heartbeat.ts` behavior (upstream: workspace runtime lifecycle; fork: token tracking + budget enforcement) without touching the same lines. Mitigate by running full CI after each merge chunk, writing canary tests for fork features before merging, and doing manual semantic review of high-risk files even when git reports no conflicts.

3. **Losing fork features during conflict resolution** -- Conflict resolution fatigue leads to "accept theirs" shortcuts that silently drop fork routes, services, and schema exports from barrel files. Create a fork feature manifest checklist before merging; always resolve barrel/registration files by including BOTH sides' additions; verify test count does not drop.

4. **Sync workflow trigger loops** -- Using a PAT instead of `GITHUB_TOKEN` causes sync commits to trigger other workflows (pr-verify, refresh-lockfile), which may push commits that re-trigger the sync. Use `GITHUB_TOKEN` exclusively (commits from it do not trigger workflows). Add concurrency groups with `cancel-in-progress: true`.

5. **Dockerfile merge creates broken container** -- Fork has Lightpanda binary, gosu privilege drop, custom entrypoint. Upstream has `USER node`, gemini-local COPY, `--chown=node:node`. These security models are not compositionally mergeable. Treat Dockerfile as a fork-owned file; manually incorporate relevant upstream changes (gemini-local COPY line); always build and verify container after merge.

6. **Lockfile merge destroys Docker build cache** -- Any change to `pnpm-lock.yaml` invalidates the Docker deps stage cache. Always regenerate lockfile (never manually merge). Reconcile fork's `refresh-lockfile.yml` (push-to-master) with upstream's `refresh-lockfile-pr.yml` (PR-based) before creating sync PRs.

7. **Upstream force-push breaks sync assumptions** -- If upstream rewrites history, the fork's merge base becomes invalid. Add `git merge-base --is-ancestor` validation before every sync. Use `git fetch --force upstream master` to handle ref updates. Store last synced SHA in a tracking file for audit and recovery.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Preparation & Safety Net
**Rationale:** Must understand the full conflict landscape and establish rollback points before touching any code. The migration renumbering strategy, lockfile workflow reconciliation, and fork feature manifest all need to be settled first because they constrain every subsequent phase.
**Delivers:** Conflict map, migration renumbering plan, fork feature manifest checklist, pre-merge safety tag, canary tests for fork-specific features, lockfile strategy decision.
**Addresses features:** Conflict detection, rollback capability, v1.0 feature verification (test foundation).
**Avoids pitfalls:** Migration collision (strategy established), losing fork features (manifest created), semantic conflicts (canary tests written).

### Phase 2: Foundation & Database Merge
**Rationale:** `packages/shared` and `packages/db` are the dependency roots of the monorepo. Every other package imports from them. They must be correct before server or UI can compile against the merged codebase.
**Delivers:** Merged shared types/constants/validators, merged DB schema exports, renumbered migrations (fork 0026-0030 kept, upstream renumbered to 0031-0032), regenerated `_journal.json` and snapshots, verified on fresh and existing DB.
**Addresses features:** DB migration conflict resolution, incremental merge (chunks 1-2).
**Avoids pitfalls:** Migration index collision (renumbering executed), schema barrel export loss (both sides' exports kept).

### Phase 3: Server, Adapter & UI Merge
**Rationale:** With foundation and DB in place, the server, adapters, and UI can be merged and compiled. This phase contains the two hardest files (`heartbeat.ts` and `index.ts`) and the UI route restructuring. Doing these together allows a single comprehensive verification pass.
**Delivers:** Merged server core (routes, services, app entry, heartbeat), merged adapters (including new gemini-local), merged UI (routing, pages, components), merged infrastructure (Dockerfile, lockfile, workflow file updates). Full build passing.
**Addresses features:** Incremental merge (chunks 3-6), post-merge CI verification, v1.0 feature survival verification, lockfile regeneration.
**Avoids pitfalls:** Silent semantic conflicts (CI after each sub-chunk), fork feature loss (manifest checklist verified), Dockerfile breakage (container built and tested).

### Phase 4: Continuous Sync Automation
**Rationale:** Only makes sense after the initial 226-commit gap is closed. The sync workflow assumes a close-to-upstream baseline where weekly syncs produce 0-1 conflicting files. Deploying it before the initial merge would just create noise.
**Delivers:** `upstream-sync.yml` workflow (scheduled weekly + manual dispatch), auto-created clean-merge PRs or conflict-report issues, upstream changelog in PR body, conflict area categorization, sync health badge, `git rerere` enabled.
**Addresses features:** Automated upstream change detection, automated sync PR creation, upstream changelog, conflict categorization, sync health badge, automatic lockfile resolution, git rerere.
**Avoids pitfalls:** Workflow trigger loops (GITHUB_TOKEN only, no PAT), upstream force-push handling (merge-base validation + fetch --force).

### Phase Ordering Rationale

- **Phase 1 before Phase 2:** The migration renumbering strategy must be decided before executing it. The canary tests must exist before the merge starts to catch regressions. The fork feature manifest provides the verification checklist used in every subsequent phase.
- **Phase 2 before Phase 3:** Server and UI code imports types from `packages/shared` and `packages/db`. If the foundation is wrong, everything downstream fails to compile, making it impossible to verify the server/UI merge.
- **Phase 3 as a single phase (not split server/UI):** The server and UI have a tight compilation dependency through shared types. Splitting them would require partial verification that cannot cover API contract compatibility. A single phase with sub-chunks (server first, then adapters, then UI) allows incremental verification while delivering a fully integrated result.
- **Phase 4 after Phase 1-3:** Continuous sync on a 226-commit-behind fork produces nothing useful -- it would just report the same massive conflict every week. The initial merge must land first.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** Migration renumbering needs exact step-by-step instructions. The Drizzle journal format and snapshot file naming conventions should be documented precisely. Existing database migration repair strategy (for databases that already ran fork 0026-0030) needs validation.
- **Phase 3 (heartbeat.ts and index.ts):** The two hardest conflicts require line-by-line resolution plans. Both files have interleaved fork and upstream changes to the same logical sections. The heartbeat cost recording reconciliation (fork's `costEvents` vs upstream's `costService`) needs a design decision.

Phases with standard patterns (skip research-phase):
- **Phase 1:** Standard preparation work -- git tagging, test writing, conflict mapping. Well-understood patterns.
- **Phase 4:** Standard GitHub Actions patterns. The workflow YAML is already drafted in ARCHITECTURE.md. No novel technical challenges.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies. All tooling verified against release pages and existing workflow files. Action versions confirmed compatible. |
| Features | HIGH | Feature set is tightly scoped (merge, verify, automate). No ambiguity in requirements. Feature dependencies mapped clearly. |
| Architecture | HIGH | Conflict count and locations verified empirically via `git merge --no-commit` dry-run. Chunked resolution order follows actual monorepo dependency graph. |
| Pitfalls | HIGH | Migration collision inspected at SQL level (different tables, same numbers). Workflow loop mechanics verified against GitHub documentation. All conflicts visible from dry-run. |

**Overall confidence:** HIGH

All four research files are based on direct analysis of the actual codebase (git diffs, migration file contents, workflow YAML, Dockerfile inspection) rather than generic advice. The conflict count (16 files), overlap analysis (39 files modified by both sides), and migration collision specifics (fork 0026-0030 vs upstream 0026-0027) are empirically verified.

### Gaps to Address

- **Semantic conflicts beyond git's detection:** The 16 textual conflicts are known, but there may be runtime incompatibilities where upstream changed an API contract in files we did not modify. TypeScript catches type-level issues but not behavioral changes (e.g., a function returning null vs undefined). Manual review of upstream's changes to shared interfaces is needed during Phase 3.
- **Existing database migration repair:** After renumbering upstream migrations to 0031-0032, any database that already ran the fork's 0026-0030 needs the new upstream migrations applied. But the `__drizzle_migrations` table records applied migrations by filename, not index. Need to verify that Drizzle correctly identifies 0031 and 0032 as "not yet applied" on existing fork databases.
- **Upstream CI workflow adoption:** Upstream added `e2e.yml`, `release.yml`, and `refresh-lockfile-pr.yml`. Need to decide which to adopt, which to ignore, and whether the fork's `refresh-lockfile.yml` conflicts with upstream's PR-based approach.
- **Node version alignment:** Dockerfile uses Node 22, CI uses Node 20. Not blocking for sync, but Node 20 EOL is April 2026. Should be addressed in a follow-up chore.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis: `git merge --no-commit --no-ff upstream/master` dry-run -- conflict count, file list, overlap analysis
- Direct `git diff` of each overlapping file since c674462 -- conflict classification and severity
- Migration journal analysis: `packages/db/src/migrations/meta/_journal.json` on both branches -- index collision verification
- Existing CI workflows: `.github/workflows/pr-verify.yml`, `pr-policy.yml`, `refresh-lockfile.yml` -- current workflow behavior
- [actions/checkout releases](https://github.com/actions/checkout/releases) -- v4.3.1 for Node 20
- [peter-evans/create-pull-request releases](https://github.com/peter-evans/create-pull-request/releases) -- v7.0.11 for Node 20
- [GitHub Docs: Events that trigger workflows](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows) -- schedule/cron, GITHUB_TOKEN behavior
- [Drizzle ORM: Merge conflicting migrations (issue #2488)](https://github.com/drizzle-team/drizzle-orm/issues/2488) -- confirms no built-in resolution
- [Drizzle ORM: Migration conflict discussion (#1104)](https://github.com/drizzle-team/drizzle-orm/discussions/1104) -- community workarounds

### Secondary (MEDIUM confidence)
- [Atlassian: Merging vs Rebasing](https://www.atlassian.com/git/tutorials/merging-vs-rebasing) -- strategy rationale
- [GitHub Blog: Strategies for Friendly Fork Management](https://github.blog/developer-skills/github/friend-zone-strategies-friendly-fork-management/) -- fork sync patterns
- [Git Tricks for Maintaining a Long-Lived Fork](https://die-antwort.eu/techblog/2016-08-git-tricks-for-maintaining-a-long-lived-fork/) -- incremental merge patterns
- [Martin Fowler: Semantic Conflict](https://martinfowler.com/bliki/SemanticConflict.html) -- silent merge conflict theory
- [GitHub Community: Workflow infinite loop (#26970)](https://github.com/orgs/community/discussions/26970) -- GITHUB_TOKEN vs PAT triggering
- [pnpm: Working with Docker](https://pnpm.io/docker) -- lockfile caching patterns

### Tertiary (LOW confidence)
- [Drizzle ORM: Timestamp-based naming (issue #2588)](https://github.com/drizzle-team/drizzle-orm/issues/2588) -- future naming improvements (not actionable now)
- [Repair Drizzle Migration Conflict Script (community gist)](https://gist.github.com/gburtini/7e34842c567dd80ee834de74e7b79edd) -- community script, not verified against our schema

---
*Research completed: 2026-03-12*
*Ready for roadmap: yes*
