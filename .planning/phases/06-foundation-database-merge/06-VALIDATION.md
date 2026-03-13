---
phase: 06
slug: foundation-database-merge
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-12
---

# Phase 06 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | vitest.workspace.ts |
| **Quick run command** | `pnpm test:run` |
| **Full suite command** | `pnpm test:run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test:run`
- **After every plan wave:** Run `pnpm test:run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | MERGE-01 | integration | `pnpm -r typecheck && pnpm test:run` | ✅ | ⬜ pending |
| 06-01-02 | 01 | 1 | MERGE-01 | integration | `pnpm test:run -- --grep "v1.0 fork"` | ✅ | ⬜ pending |
| 06-01-03 | 01 | 1 | MERGE-01 | integration | `pnpm test:run` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements:
- 455 tests already in place (including 32 canary export tests + 4 API smoke tests from phase 5)
- Migration snapshot chain verification scripts exist
- TypeScript compilation checks via pnpm workspace typecheck
- No new test infrastructure needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Migration compat against real DB | MERGE-01 | Requires PostgreSQL connection | `DATABASE_URL=... npx tsx scripts/check-migration-compat.ts` |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-03-12
