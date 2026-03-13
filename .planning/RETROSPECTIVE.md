# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Token Optimization & Observability

**Shipped:** 2026-03-12
**Phases:** 4 | **Plans:** 14 | **Commits:** 66

### What Was Built
- Token analytics pipeline with per-run input/output/cached tracking, cost attribution, and live WebSocket counters
- Context optimization pipeline — 4-processor chain (task-type resolver, serializer, deduplicator, prompt reorderer) with three-tier budget enforcement
- Observability UX — nested trace tree view, multi-filter activity feeds with URL persistence, Recharts analytics dashboard with 4 interactive charts
- Outgoing webhooks with Standard Webhooks HMAC-SHA256 signing, per-event subscription, exponential backoff retry
- Task decomposition with subtask DAG dependencies (Kahn's algorithm) and execution wave grouping
- Agent skill profiles (6 predefined) injected into context pipeline as prompt augmentation
- Code review workflow with abstracted ReviewProvider interface and GitHub implementation

### What Worked
- Wave-based parallel plan execution — 14 plans across 4 phases completed in ~75 minutes total
- Research-first approach (observe → optimize → visualize ordering) meant each phase built cleanly on the previous
- Processor-chain pipeline pattern for context optimization — composable, testable, easy to extend
- Standard Webhooks spec choice — well-documented, no design decisions needed for signing
- Reusing existing patterns (e.g., same encryption as github-app.ts for webhook secrets)

### What Was Inefficient
- Compression ratio data plumbing was incomplete on first pass — shared type, SQL aggregation, and UI all needed separate fixes discovered in UAT
- Mock DB in tests only handled 3 select() calls; adding a 4th query broke tests in a non-obvious way
- Phase 4 had 5 plans (largest phase) — could have been split into two phases for cleaner execution

### Patterns Established
- ~4 chars/token heuristic for token estimation (simple, fast, sufficient)
- Three-tier budget hierarchy (run → agent → company) with 90% wind-down threshold
- Severity derivation from action strings via ILIKE pattern matching (no schema changes)
- URL params with replace mode for filter persistence (no browser history pollution)
- Lazy imports to break circular dependencies (code review → github-app)
- Parent status derived on-the-fly from subtask states (always fresh)

### Key Lessons
1. End-to-end data plumbing (type → backend → API → UI) should be verified as a single unit, not per-layer — the compression ratio gap was caught in UAT, not earlier
2. Test mocks that count sequential calls are fragile — adding a new query breaks the mock chain silently
3. Automated UAT (build + test + code verification via agents) is far more efficient than manual checkpoint testing for this type of work

### Cost Observations
- Sessions: 1 milestone planning + 4 phase discussions + 4 phase plans + 4 phase executions + 1 UAT + 1 completion
- Notable: Parallel plan execution within phases kept wall-clock time low despite 14 total plans

---

## Milestone: v1.1 — Upstream Sync & Continuous Integration

**Shipped:** 2026-03-13
**Phases:** 4 | **Plans:** 10 | **Commits:** 40

### What Was Built
- Upstream merge — 226 commits merged via conflict map playbook with pre-merge rollback safety, migration renumbering, and all 16 conflicts resolved
- Post-merge verification — 613 tests (202 new), zero TypeScript errors, Docker healthy, 68 integration tests across 8 v1.0 feature areas
- Automated sync workflow — GitHub Action with weekly cron, upstream detection, git rerere seeding, area-grouped PR/issue creation, lockfile regeneration
- Sync health visibility — shields.io endpoint badge in README, sync-status.json updated per run

### What Worked
- Conflict map as merge playbook — documenting per-file resolution strategies before the merge made the actual merge a mechanical exercise
- Pre-merge rollback safety (git tag + backup branch) — never needed but eliminated merge anxiety
- Canary tests from Phase 5 caught potential regressions during Phase 6 merge automatically
- git rerere seeding from the merge commit — trains future syncs to auto-resolve known conflict patterns
- Gap closure cycle (verify → plan gaps → execute gaps → re-verify) caught SYNC-03 effort estimation requirement cleanly

### What Was Inefficient
- PREP-01..04 checkboxes in REQUIREMENTS.md went stale (marked Pending despite Phase 5 passing verification) — discovered during milestone audit
- Phase 7 Plan 3 needed 3 auto-fixes during Docker build (Gemini adapter, locale, orphan migrations) — these should have been caught in earlier phases
- classify_area() and classify_effort() are duplicated across GitHub Actions steps because GHA doesn't support shared functions between steps — minor tech debt

### Patterns Established
- Conflict map before merge — analyze conflicts, categorize by area, document resolution strategy per file
- Migration renumbering — renumber upstream migrations to avoid collision with fork (0031+ for upstream)
- Rerere seeding from merge commits — replay the merge to train rerere, then use in future syncs
- Area-grouped changelogs — classify files by area (DB, Server, UI, Packages, CLI, Infrastructure) for PR/issue readability
- shields.io endpoint badges — JSON file in repo updated by workflow, read by shields.io for dynamic badges

### Key Lessons
1. Merge preparation phases pay off enormously — the actual merge (Phase 6) took 16 minutes because all conflicts were pre-analyzed
2. Canary/smoke tests created before a risky operation (merge) provide automatic safety nets during and after
3. Gap closure cycles (verify → plan → execute → re-verify) are essential — SYNC-03 effort estimation was explicitly deferred in context but required by the roadmap, caught by verification

### Cost Observations
- Sessions: 1 milestone planning + 4 phase discussions + 4 phase plans + 4 phase executions + 1 audit + 1 completion
- Notable: The merge itself (Phase 6, 1 plan) accounted for most file changes (+21,768 lines) but only 16 minutes of execution — preparation was the investment, merge was mechanical

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Commits | Phases | Key Change |
|-----------|---------|--------|------------|
| v1.0 | 66 | 4 | Established GSD workflow: discuss → plan → execute → verify |
| v1.1 | 40 | 4 | Added merge preparation + gap closure cycles |

### Cumulative Quality

| Milestone | Tests | Files Changed | LOC Added |
|-----------|-------|---------------|-----------|
| v1.0 | 411 | 139 | +24,135 |
| v1.1 | 613 | 326 | +29,570 |

### Top Lessons (Verified Across Milestones)

1. Research-first phase ordering prevents rework — each phase naturally builds on prior instrumentation
2. Automated UAT catches integration gaps that per-plan testing misses
3. Preparation phases pay off exponentially — conflict mapping (v1.1) and research (v1.0) both made execution mechanical
4. Gap closure cycles are essential — requirements drift between context decisions and roadmap gets caught by verification
