---
phase: 1
slug: token-analytics-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.0.5 |
| **Config file** | `vitest.config.ts` (root, with project refs) |
| **Quick run command** | `pnpm vitest run --project server` |
| **Full suite command** | `pnpm test:run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run --project server`
- **After every plan wave:** Run `pnpm test:run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | TOKN-01 | unit | `pnpm vitest run server/src/__tests__/token-estimation.test.ts -x` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | TOKN-01 | unit | `pnpm vitest run server/src/__tests__/token-estimation.test.ts -x` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | TOKN-01 | unit | `pnpm vitest run server/src/__tests__/token-estimation.test.ts -x` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | TOKN-02 | unit | `pnpm vitest run server/src/__tests__/cost-token-analytics.test.ts -x` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | TOKN-02 | unit | `pnpm vitest run server/src/__tests__/cost-token-analytics.test.ts -x` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 1 | TOKN-03 | unit | `pnpm vitest run server/src/__tests__/model-context-limits.test.ts -x` | ❌ W0 | ⬜ pending |
| 01-03-02 | 03 | 1 | TOKN-03 | unit | `pnpm vitest run server/src/__tests__/token-estimation.test.ts -x` | ❌ W0 | ⬜ pending |
| 01-04-01 | 04 | 2 | TOKN-04 | unit | `pnpm vitest run server/src/__tests__/claude-usage-streaming.test.ts -x` | ❌ W0 | ⬜ pending |
| 01-04-02 | 04 | 2 | TOKN-04 | unit | `pnpm vitest run server/src/__tests__/claude-usage-streaming.test.ts -x` | ❌ W0 | ⬜ pending |
| 01-04-03 | 04 | 2 | TOKN-04 | unit | `pnpm vitest run server/src/__tests__/claude-usage-streaming.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/src/__tests__/token-estimation.test.ts` — stubs for TOKN-01, TOKN-03 (estimation logic, breakdown shape, context utilization)
- [ ] `server/src/__tests__/cost-token-analytics.test.ts` — stubs for TOKN-02 (extended cost service queries)
- [ ] `server/src/__tests__/model-context-limits.test.ts` — stubs for TOKN-03 (context window map)
- [ ] `server/src/__tests__/claude-usage-streaming.test.ts` — stubs for TOKN-04 (stream parsing, debounce, event emission)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live token counter updates in UI during active run | TOKN-04 | Requires active WebSocket + running agent | Start agent run, observe token counter on agent card updates in real-time |
| Run detail panel shows token breakdown tab | TOKN-01 | Visual UI verification | Open completed run, verify Token Breakdown tab shows component percentages |
| Costs page shows extended token columns | TOKN-02 | Visual UI verification | Navigate to Costs page, verify cached tokens and efficiency columns appear |
| Context window utilization bar renders correctly | TOKN-03 | Visual UI verification | Open run detail, verify progress bar shows context % with correct model limit |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
