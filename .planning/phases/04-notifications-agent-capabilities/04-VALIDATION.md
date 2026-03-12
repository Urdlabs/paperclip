---
phase: 04
slug: notifications-agent-capabilities
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 04 — Validation Strategy

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
| TBD | TBD | TBD | NOTF-01 | TBD | TBD | TBD | pending |
| TBD | TBD | TBD | NOTF-02 | TBD | TBD | TBD | pending |
| TBD | TBD | TBD | NOTF-03 | TBD | TBD | TBD | pending |
| TBD | TBD | TBD | AGNT-01 | TBD | TBD | TBD | pending |
| TBD | TBD | TBD | AGNT-02 | TBD | TBD | TBD | pending |
| TBD | TBD | TBD | AGNT-03 | TBD | TBD | TBD | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

*To be determined after plans are created.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Webhook config UI in Company Settings | NOTF-01 | Visual component requires browser | Navigate to Company Settings, add webhook endpoint, select events, test delivery |
| Subtask tree expand/collapse + dependency arrows | AGNT-01 | Visual component requires browser | Create parent issue with subtasks, verify tree view and dependency visualization |
| Skill profile selector in agent settings | AGNT-02 | Visual component requires browser | Open agent settings, select skill profile, verify prompt changes |
| Code review comments posted to GitHub PR | AGNT-03 | Requires GitHub integration + live PR | Create PR, trigger review agent, verify inline comments appear on GitHub |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
