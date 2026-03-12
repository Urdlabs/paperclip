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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Commits | Phases | Key Change |
|-----------|---------|--------|------------|
| v1.0 | 66 | 4 | Established GSD workflow: discuss → plan → execute → verify |

### Cumulative Quality

| Milestone | Tests | Files Changed | LOC Added |
|-----------|-------|---------------|-----------|
| v1.0 | 411 | 139 | +24,135 |

### Top Lessons (Verified Across Milestones)

1. Research-first phase ordering prevents rework — each phase naturally builds on prior instrumentation
2. Automated UAT catches integration gaps that per-plan testing misses
