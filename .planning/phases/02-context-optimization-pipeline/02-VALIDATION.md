---
phase: 02
slug: context-optimization-pipeline
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-10
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | server/vitest.config.ts |
| **Quick run command** | `pnpm vitest run --reporter=verbose` |
| **Full suite command** | `pnpm vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run --reporter=verbose`
- **After every plan wave:** Run `pnpm vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | TOPT-01, TOPT-03-05 | unit+integration | `pnpm vitest run server/src/__tests__/context-pipeline.test.ts` | create in task | pending |
| 02-01-02 | 01 | 1 | TOPT-03 | unit | `pnpm vitest run server/src/__tests__/task-type-resolver.test.ts` | create in task | pending |
| 02-01-02 | 01 | 1 | TOPT-01 | unit | `pnpm vitest run server/src/__tests__/context-serializer.test.ts` | create in task | pending |
| 02-01-03 | 01 | 1 | TOPT-04 | unit | `pnpm vitest run server/src/__tests__/deduplicator.test.ts` | create in task | pending |
| 02-01-03 | 01 | 1 | TOPT-05 | unit | `pnpm vitest run server/src/__tests__/prompt-reorderer.test.ts` | create in task | pending |
| 02-02-01 | 02 | 1 | TOPT-02 | unit | `pnpm vitest run server/src/__tests__/budget.test.ts` | create in task | pending |
| 02-02-02 | 02 | 1 | TOPT-02 | unit | `pnpm vitest run server/src/__tests__/claude-usage-streaming.test.ts` | exists (extend) | pending |
| 02-03-01 | 03 | 2 | TOPT-01-05 | integration | `pnpm vitest run --reporter=verbose` (full suite) | existing tests | pending |
| 02-03-02 | 03 | 2 | TOPT-02 | type-check | `npx tsc --noEmit -p ui/tsconfig.json` | N/A (no @testing-library/react) | pending |
| 02-03-03 | 03 | 2 | all | human-verify | Visual inspection of DesignGuide + live run | N/A | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

All test files are created within their respective tasks (TDD approach -- tests written before implementation):

- [ ] `server/src/__tests__/context-pipeline.test.ts` — created in 02-01 Task 1
- [ ] `server/src/__tests__/task-type-resolver.test.ts` — created in 02-01 Task 2
- [ ] `server/src/__tests__/context-serializer.test.ts` — created in 02-01 Task 2
- [ ] `server/src/__tests__/deduplicator.test.ts` — created in 02-01 Task 3
- [ ] `server/src/__tests__/prompt-reorderer.test.ts` — created in 02-01 Task 3
- [ ] `server/src/__tests__/budget.test.ts` — created in 02-02 Task 1
- [ ] `server/src/__tests__/claude-usage-streaming.test.ts` — already exists, extended in 02-02 Task 2

*Existing vitest infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live budget bar in UI | TOPT-02 | Visual component requires browser, no @testing-library/react available | Start run with budget, observe progress bar updates |
| BudgetBar all 5 states | TOPT-02 | Visual rendering | Check DesignGuide page for no-budget, green, yellow, red, full red |
| Cache hit rate on Costs page | TOPT-05 | UI metric display requires browser | Run agent, check Costs page for cache efficiency metric |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or human-verify gate
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covered by TDD task ordering (tests created before implementation)
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
