---
phase: 02
slug: context-optimization-pipeline
status: draft
nyquist_compliant: false
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
| 02-01-01 | 01 | 1 | TOPT-01 | unit | `pnpm vitest run server/src/__tests__/context-serializer.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | TOPT-04 | unit | `pnpm vitest run server/src/__tests__/context-compaction.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | TOPT-02 | unit | `pnpm vitest run server/src/__tests__/token-budget.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | TOPT-03 | unit | `pnpm vitest run server/src/__tests__/task-type-routing.test.ts` | ❌ W0 | ⬜ pending |
| 02-04-01 | 04 | 2 | TOPT-05 | unit | `pnpm vitest run server/src/__tests__/prompt-cache-optimization.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/src/__tests__/context-serializer.test.ts` — stubs for TOPT-01
- [ ] `server/src/__tests__/context-compaction.test.ts` — stubs for TOPT-04
- [ ] `server/src/__tests__/token-budget.test.ts` — stubs for TOPT-02
- [ ] `server/src/__tests__/task-type-routing.test.ts` — stubs for TOPT-03
- [ ] `server/src/__tests__/prompt-cache-optimization.test.ts` — stubs for TOPT-05

*Existing vitest infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live budget bar in UI | TOPT-02 | Visual component requires browser | Start run with budget, observe progress bar updates |
| Cache hit rate on Costs page | TOPT-05 | UI metric display requires browser | Run agent, check Costs page for cache efficiency metric |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
