# Roadmap: Paperclip

## Milestones

- **v1.0 Token Optimization & Observability** -- Phases 1-4 (shipped 2026-03-12)
- **v1.1 Upstream Sync & Continuous Integration** -- Phases 5-8 (in progress)

## Phases

<details>
<summary>v1.0 Token Optimization & Observability (Phases 1-4) -- SHIPPED 2026-03-12</summary>

- [x] Phase 1: Token Analytics Foundation (3/3 plans) -- completed 2026-03-10
- [x] Phase 2: Context Optimization Pipeline (3/3 plans) -- completed 2026-03-11
- [x] Phase 3: Observability & Monitoring UX (3/3 plans) -- completed 2026-03-12
- [x] Phase 4: Notifications & Agent Capabilities (5/5 plans) -- completed 2026-03-12

Full details: [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

### v1.1 Upstream Sync & Continuous Integration

- [x] **Phase 5: Merge Preparation** - Map conflicts, establish rollback safety, resolve migration numbering, document fork features
- [x] **Phase 6: Foundation & Database Merge** - Merge shared packages and DB layer as dependency roots
- [x] **Phase 7: Server, UI & Full Verification** - Merge remaining layers, verify all 226 upstream commits integrated, confirm v1.0 features survive (completed 2026-03-13)
- [ ] **Phase 8: Continuous Sync Automation** - GitHub Action for weekly upstream detection, auto-created sync PRs, health badge

## Phase Details

### Phase 5: Merge Preparation
**Goal**: The fork is fully prepared for a safe, reversible upstream merge with all risks mapped and mitigated
**Depends on**: Phase 4 (v1.0 complete)
**Requirements**: PREP-01, PREP-02, PREP-03, PREP-04
**Success Criteria** (what must be TRUE):
  1. Running `git diff --stat` against the conflict map shows every conflicting file is categorized by area (DB, server, UI, infra) with resolution strategy noted
  2. A pre-merge git tag exists that the developer can `git reset --hard` to if the merge goes wrong
  3. Fork migrations 0026-0030 retain their original numbering and upstream migrations are renumbered to 0031+ with a regenerated Drizzle journal -- verified by `drizzle-kit generate` producing no diff
  4. A fork feature manifest exists listing every v1.0-specific code path, route registration, service binding, and DB export so nothing is silently lost during merge
**Plans:** 3 plans

Plans:
- [ ] 05-01-PLAN.md -- Conflict map with per-file resolution strategies + rollback safety net (PREP-01, PREP-02)
- [ ] 05-02-PLAN.md -- Drizzle migration renumbering: upstream 0026-0027 to 0031-0032 (PREP-03)
- [ ] 05-03-PLAN.md -- Fork feature manifest + canary export tests (PREP-04)

### Phase 6: Foundation & Database Merge
**Goal**: Shared packages and database layer are merged with upstream, forming a correct dependency root for all remaining packages
**Depends on**: Phase 5
**Requirements**: MERGE-01
**Success Criteria** (what must be TRUE):
  1. `packages/shared` and `packages/adapter-utils` compile with zero TypeScript errors after incorporating upstream changes
  2. `packages/db` compiles and the combined migration set (fork 0026-0030 + renumbered upstream 0031-0032) applies cleanly on both a fresh database and an existing fork database
  3. The existing CI verification suite (typecheck + tests + build) passes after the foundation merge commit
**Plans:** 1 plan

Plans:
- [ ] 06-01-PLAN.md -- Execute upstream merge, resolve all 16 conflicts, verify full CI suite, commit and tag (MERGE-01)

### Phase 7: Server, UI & Full Verification
**Goal**: All 226 upstream commits are merged into the fork with every v1.0 feature verified working
**Depends on**: Phase 6
**Requirements**: MERGE-02, MERGE-03, MERGE-04, MERGE-05, VERIFY-01, VERIFY-02, VERIFY-03, VERIFY-04
**Success Criteria** (what must be TRUE):
  1. Server and adapter layers compile and pass tests after merge -- including upstream's new gemini-local adapter and fork's token tracking in heartbeat
  2. UI layer compiles and renders after merge -- upstream's onboarding wizard and fork's analytics dashboards both accessible
  3. `pnpm install --lockfile-only` produces a clean lockfile and `pnpm build` succeeds across all packages
  4. Docker build completes and the container starts successfully with both fork and upstream features available
  5. Full test suite passes (411+ tests), TypeScript compiles with zero errors, and all v1.0 features (token analytics, context optimization, webhooks, traces, activity feeds, task decomposition, skill profiles, code review) are verified working
**Plans:** 3/3 plans complete

Plans:
- [x] 07-01-PLAN.md -- Fix 3 timeout test failures + integration tests for features 1-4 (VERIFY-01, VERIFY-04)
- [ ] 07-02-PLAN.md -- Integration tests for features 5-8 (VERIFY-04)
- [ ] 07-03-PLAN.md -- Full CI suite verification + Docker build and health check (MERGE-02..05, VERIFY-01..03)

### Phase 8: Continuous Sync Automation
**Goal**: Upstream changes are automatically detected and surfaced as reviewable PRs so the fork never silently drifts again
**Depends on**: Phase 7
**Requirements**: SYNC-01, SYNC-02, SYNC-03, SYNC-04, SYNC-05, SYNC-06
**Success Criteria** (what must be TRUE):
  1. A GitHub Action runs on a weekly schedule (and manual dispatch) that detects new upstream commits and auto-creates a sync PR or conflict-report issue
  2. Sync PR body contains an upstream changelog grouped by area (server, UI, packages) with conflict categorization and estimated resolution effort
  3. The sync workflow auto-regenerates `pnpm-lock.yaml` so lockfile conflicts never require manual resolution
  4. `git rerere` is enabled in the repo so previously resolved conflict patterns are automatically reapplied in future syncs
  5. README displays a sync health badge showing how many commits the fork is behind upstream
**Plans:** 3 plans

Plans:
- [ ] 08-01-PLAN.md -- Core upstream sync workflow + pr-policy lockfile exemption (SYNC-01, SYNC-02, SYNC-04, SYNC-05)
- [ ] 08-02-PLAN.md -- Sync status badge JSON + README badge (SYNC-06)
- [ ] 08-03-PLAN.md -- Add effort estimation to sync PR and conflict issue bodies (SYNC-03, gap closure)

## Progress

**Execution Order:** Phases 5 -> 6 -> 7 -> 8

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Token Analytics Foundation | v1.0 | 3/3 | Complete | 2026-03-10 |
| 2. Context Optimization Pipeline | v1.0 | 3/3 | Complete | 2026-03-11 |
| 3. Observability & Monitoring UX | v1.0 | 3/3 | Complete | 2026-03-12 |
| 4. Notifications & Agent Capabilities | v1.0 | 5/5 | Complete | 2026-03-12 |
| 5. Merge Preparation | v1.1 | 3/3 | Complete | 2026-03-12 |
| 6. Foundation & Database Merge | v1.1 | 1/1 | Complete | 2026-03-12 |
| 7. Server, UI & Full Verification | 3/3 | Complete   | 2026-03-13 | - |
| 8. Continuous Sync Automation | v1.1 | 2/3 | In progress | - |
