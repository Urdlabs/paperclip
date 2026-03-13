---
phase: 07
slug: server-ui-full-verification
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-13
---

# Phase 07 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x (workspace mode) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `pnpm test:run` |
| **Full suite command** | `pnpm typecheck && pnpm test:run && pnpm -r build` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test:run`
- **After every plan wave:** Run `pnpm typecheck && pnpm test:run && pnpm -r build`
- **Before `/gsd:verify-work`:** Full suite must be green + Docker healthy
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | VERIFY-01 | unit | `pnpm test:run` | ✅ | ⬜ pending |
| 07-02-01 | 02 | 2 | VERIFY-04 | integration | `pnpm test:run -- server/src/__tests__/v1-integration-*.test.ts` | ❌ W0 | ⬜ pending |
| 07-03-01 | 03 | 3 | VERIFY-03 | integration | `docker build -t paperclip:verify . && docker run -d -e PAPERCLIP_EMBEDDED_POSTGRES=true -p 3100:3100 paperclip:verify` | ❌ W0 | ⬜ pending |
| 07-03-02 | 03 | 3 | MERGE-02..05 | integration | `pnpm typecheck && pnpm test:run && pnpm -r build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Timeout fix for `workspace-runtime.test.ts` (2 tests) — covers VERIFY-01
- [ ] Timeout fix for `worktree.test.ts` (1 test) — covers VERIFY-01
- [ ] `server/src/__tests__/v1-integration-token-analytics.test.ts` — covers VERIFY-04
- [ ] `server/src/__tests__/v1-integration-context-optimization.test.ts` — covers VERIFY-04
- [ ] `server/src/__tests__/v1-integration-webhooks.test.ts` — covers VERIFY-04
- [ ] `server/src/__tests__/v1-integration-traces.test.ts` — covers VERIFY-04
- [ ] `server/src/__tests__/v1-integration-activity-feeds.test.ts` — covers VERIFY-04
- [ ] `server/src/__tests__/v1-integration-task-decomposition.test.ts` — covers VERIFY-04
- [ ] `server/src/__tests__/v1-integration-skill-profiles.test.ts` — covers VERIFY-04
- [ ] `server/src/__tests__/v1-integration-code-review.test.ts` — covers VERIFY-04

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Docker container starts and responds to health check | VERIFY-03 | Requires Docker daemon | `docker build -t paperclip:verify . && docker run -d -e PAPERCLIP_EMBEDDED_POSTGRES=true -p 3100:3100 paperclip:verify && curl http://localhost:3100/api/health` |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-03-13
