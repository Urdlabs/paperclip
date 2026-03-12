---
phase: 03
slug: observability-monitoring-ux
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 03 — Validation Strategy

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

*To be updated after plans are created — task IDs and test files will be filled in by the planner.*

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | MNTR-01 | TBD | TBD | TBD | pending |
| TBD | TBD | TBD | MNTR-02 | TBD | TBD | TBD | pending |
| TBD | TBD | TBD | MNTR-03 | TBD | TBD | TBD | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

*To be determined after plans are created.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Trace tree expand/collapse + syntax highlighting | MNTR-01 | Visual component requires browser | Navigate to run detail, open Trace tab, expand nodes |
| Activity filter bar interaction + URL persistence | MNTR-02 | Browser URL state + filter UX | Apply filters, navigate away, come back, verify URL params restore |
| Recharts interactive charts (hover, tooltips) | MNTR-03 | Chart rendering requires browser | Open Costs Analytics tab, hover charts, test time range selector |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
