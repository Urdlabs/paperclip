# Phase 7: Server, UI & Full Verification - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Post-merge verification and hardening. Phase 6 already merged all 226 upstream commits and resolved all 16 conflicts. This phase fixes remaining test failures, verifies Docker build + container startup, adds integration tests for all 8 v1.0 feature areas, and formally closes all MERGE and VERIFY requirements.

</domain>

<decisions>
## Implementation Decisions

### Failing Test Strategy
- Fix all 3 failing upstream tests (workspace-runtime.test.ts × 2, worktree.test.ts × 1) — do not skip or mark as known issues
- Fix regardless of effort — these tests should work in our environment
- Root cause investigation required (likely environment-specific issues, not merge-caused)

### Docker Verification
- Full verification: build + start + health check
- Use embedded PostgreSQL mode (PAPERCLIP_EMBEDDED_POSTGRES=true) for self-contained testing
- Verify the health endpoint responds after container startup
- Dockerfile was kept-ours during merge (fork superset with Lightpanda, gosu, custom entrypoint)

### V1.0 Feature Integration Tests
- Add integration tests for all 8 v1.0 feature areas: token analytics, context optimization, webhooks, traces, activity feeds, task decomposition, skill profiles, code review
- Use API contract tests (supertest-style) consistent with existing smoke test pattern
- Mount routes, mock services, verify request/response contracts for key endpoints
- These are permanent regression tests, not temporary verification

### Requirement Closure
- MERGE-02 through MERGE-05: already satisfied by phase 6 — reference phase 6's results
- VERIFY-01 through VERIFY-04: verify after code changes (test fixes, new tests)
- Re-run full CI suite (typecheck + tests + build) after all code changes are made
- Phase 7 verification should confirm 0 test failures (currently 3)

### Claude's Discretion
- Exact test structure and mock patterns for integration tests
- Which endpoints per feature area to test (cover the most critical paths)
- How to fix the 3 upstream test failures (depends on root cause analysis)
- Docker health check timing and retry logic

</decisions>

<specifics>
## Specific Ideas

- The 3 failing tests are from upstream's workspace-runtime and worktree modules — investigate whether they need environment setup we don't have
- Docker build should use the same Dockerfile at repo root — no modifications needed if phase 6 merge was correct
- Integration tests should follow the pattern established in v1-api-smoke.test.ts (express + supertest + vi.mock)
- Phase 6 achieved 542 passing tests — phase 7 target is 545+ (fix 3 failures) plus new integration tests

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/src/__tests__/v1-api-smoke.test.ts`: Pattern for supertest-based API contract tests with service mocking
- `server/src/__tests__/github-routes-company-scoping.test.ts`: Reference for route testing with actor middleware
- `server/src/__tests__/v1-feature-exports.test.ts`: Canary export tests (32 assertions)
- 542 passing tests as post-merge baseline

### Established Patterns
- Route testing: express + supertest + vi.hoisted() + vi.mock() for service factories
- Actor middleware injection: `req.actor = { type: "board", userId, companyIds, isInstanceAdmin }`
- Service factory mocking: `vi.mock("../services/xyz.js", () => ({ xyzService: () => mockXyz }))`

### Integration Points
- Merge commit `8c83b0d`: all 226 upstream commits integrated
- `post-foundation-merge` tag: rollback point for this phase
- Upstream additions now in codebase: onboarding wizard, instance settings, gemini-local adapter, workspace runtime services

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-server-ui-full-verification*
*Context gathered: 2026-03-13*
