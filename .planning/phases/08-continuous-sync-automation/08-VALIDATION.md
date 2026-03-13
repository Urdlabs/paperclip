---
phase: 08
slug: continuous-sync-automation
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-13
---

# Phase 08 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | GitHub Actions (yaml validation + dry-run) |
| **Config file** | `.github/workflows/upstream-sync.yml` |
| **Quick run command** | `yamllint .github/workflows/upstream-sync.yml && act -n` |
| **Full suite command** | `pnpm test:run && gh workflow run upstream-sync.yml` |
| **Estimated runtime** | ~30 seconds (yaml validation), minutes (workflow execution) |

---

## Sampling Rate

- **After every task commit:** Validate YAML syntax + check file exists
- **After every plan wave:** Run `pnpm test:run` to ensure no regressions
- **Before `/gsd:verify-work`:** Full suite green + manual workflow dispatch test
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | SYNC-01, SYNC-04 | structural | `test -f .github/workflows/upstream-sync.yml && head -5 .github/workflows/upstream-sync.yml` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | SYNC-05 | structural | `git config --get rerere.enabled` | ✅ | ⬜ pending |
| 08-01-03 | 01 | 1 | SYNC-02, SYNC-03 | structural | `grep -q "area" .github/workflows/upstream-sync.yml` | ❌ W0 | ⬜ pending |
| 08-01-04 | 01 | 1 | SYNC-06 | structural | `grep -q "shields.io\|sync-status" README.md` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers most needs. New artifacts created during execution:
- `.github/workflows/upstream-sync.yml` — the sync workflow (created by plan tasks)
- `.github/sync-status.json` — badge data file (created by plan tasks)
- No new test framework or dependencies needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Workflow runs on cron schedule | SYNC-01 | Requires GitHub Actions runner | Trigger via `gh workflow run upstream-sync.yml` and verify it completes |
| PR auto-created on clean merge | SYNC-02 | Requires upstream changes to merge | Fork a test scenario or wait for upstream activity |
| Issue created on conflict | SYNC-03 | Requires conflicting upstream changes | Manually test with a conflicting branch |
| Rerere auto-resolves known conflicts | SYNC-05 | Requires known conflict pattern to replay | Verify `.git/rr-cache` is populated after seeding |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-03-13
