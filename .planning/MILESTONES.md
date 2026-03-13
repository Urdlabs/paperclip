# Milestones

## v1.1 Upstream Sync & Continuous Integration (Shipped: 2026-03-13)

**Phases:** 4 | **Plans:** 10 | **Commits:** 40 | **Files:** 326 changed (+29,570 / -4,732 lines)
**Timeline:** 2 days (2026-03-12 → 2026-03-13)
**Requirements:** 19/19 complete | **Tests:** 613 passing (up from 411)

**Key accomplishments:**
1. Upstream merge — 226 upstream commits safely merged into fork via conflict map playbook, with pre-merge rollback tag, Drizzle migration renumbering (0031-0032), and all 16 conflicts resolved in a single merge commit
2. Post-merge verification — 613 tests passing (202 new), zero TypeScript errors across 13 packages, Docker build healthy with auto-fixes for Gemini adapter, locale, and orphan migrations
3. Feature integration tests — 68 new tests across 8 v1.0 feature areas (token analytics, context optimization, webhooks, traces, activity feeds, task decomposition, skill profiles, code review) confirming no regressions
4. Automated sync workflow — GitHub Action with weekly cron + manual dispatch, upstream detection with early exit, git rerere seeding from Phase 6 merge commit, area-grouped changelog in sync PRs, conflict-report issues with effort estimation
5. Lockfile automation — sync workflow regenerates pnpm-lock.yaml atomically, pr-policy exempts sync branch from lockfile block
6. Sync health visibility — shields.io endpoint badge in README showing commits-behind count and last sync date, linking to workflow runs page

**Archives:** [v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) | [v1.1-REQUIREMENTS.md](milestones/v1.1-REQUIREMENTS.md)

---

## v1.0 Token Optimization & Observability (Shipped: 2026-03-12)

**Phases:** 4 | **Plans:** 14 | **Commits:** 66 | **Files:** 139 changed (+24,135 lines)
**Timeline:** 3 days (2026-03-10 → 2026-03-12)
**Requirements:** 18/18 complete | **UAT:** 20/20 pass | **Tests:** 411 passing

**Key accomplishments:**
1. Token analytics pipeline — per-run input/output/cached token tracking with cost attribution, live WebSocket counters during active runs, and context utilization visualization
2. Context optimization pipeline — 4-processor chain (task-type resolver, serializer, deduplicator, prompt reorderer) reducing formatting waste, with three-tier token budget enforcement and 90% wind-down warning
3. Observability UX — nested trace tree view for run execution, multi-filter activity feeds with URL persistence, and Recharts-powered analytics dashboard with 4 interactive charts
4. Outgoing webhooks — Standard Webhooks HMAC-SHA256 signing, per-event subscription, exponential backoff retry queue, auto-disable after 5 consecutive failures
5. Task decomposition — subtask parent-child relationships with DAG dependency graph (Kahn's algorithm), execution wave grouping for parallel processing
6. Agent skill profiles — 6 predefined profiles (Refactor, Test Writer, Reviewer, Debugger, Architect, Documentation Writer) injected into context pipeline as prompt augmentation
7. Code review workflow — abstracted ReviewProvider interface with GitHub implementation, incremental re-review support, inline comments + summary

**Archives:** [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) | [v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md)

---
