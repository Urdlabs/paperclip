---
phase: 5
slug: merge-preparation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (workspace-level) |
| **Config file** | `server/vitest.config.ts`, `ui/vitest.config.ts` |
| **Quick run command** | `pnpm test:run` |
| **Full suite command** | `pnpm test:run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test:run`
- **After every plan wave:** Run `pnpm test:run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | PREP-01 | manual-only | Visual inspection of `.planning/CONFLICT-MAP.md` | N/A (doc) | ⬜ pending |
| 05-01-02 | 01 | 1 | PREP-02 | smoke | `git tag -l pre-upstream-sync && git branch -l pre-upstream-sync-backup` | N/A (git) | ⬜ pending |
| 05-02-01 | 02 | 1 | PREP-03 | integration | `pnpm --filter @paperclipai/db generate` (expect no new files) | N/A (verify cmd) | ⬜ pending |
| 05-02-02 | 02 | 1 | PREP-04 | unit | `pnpm test:run -- --grep "v1.0 fork feature"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/src/__tests__/v1-feature-exports.test.ts` — stubs for PREP-04 (v1.0 export verification)
- [ ] Migration renumbering verification script — covers PREP-03

*Existing infrastructure covers PREP-01 (doc artifact) and PREP-02 (git commands).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Conflict map completeness | PREP-01 | Document artifact — correctness requires human review of git diff context | Verify all 16 conflicting files listed with area, fork changes, upstream changes, and resolution strategy |
| Deep-dive accuracy for hard conflicts | PREP-01 | Line-by-line analysis of index.ts and heartbeat.ts requires domain knowledge | Review merge playbook against actual git diff output for completeness |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
