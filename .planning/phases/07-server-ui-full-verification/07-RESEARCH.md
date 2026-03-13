# Phase 7: Server, UI & Full Verification - Research

**Researched:** 2026-03-13
**Domain:** Post-merge verification, test fixing, Docker validation, integration testing
**Confidence:** HIGH

## Summary

Phase 6 already merged all 226 upstream commits into the fork in a single merge commit (8c83b0d). The codebase is in excellent shape: TypeScript compiles with zero errors, pnpm lockfile is clean, and 542 of 545 tests pass. The 3 failing tests are all timeout-related (5000ms default) in git worktree operations that take 2500-3200ms in isolation but exceed 5000ms under concurrent load. The fix is straightforward: increase the timeout for these specific test cases.

Phase 7 adds integration tests for the 8 v1.0 feature areas using the established express + supertest + vi.mock pattern already proven in `v1-api-smoke.test.ts` and `github-routes-company-scoping.test.ts`. Docker verification needs a build + start + health check against the existing Dockerfile which already includes a HEALTHCHECK directive at `/api/health`.

**Primary recommendation:** Fix the 3 timeouts first (Wave 1), then add integration tests for all 8 features (Wave 2), then Docker verification + formal closure (Wave 3).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Fix all 3 failing upstream tests (workspace-runtime.test.ts x 2, worktree.test.ts x 1) -- do not skip or mark as known issues
- Fix regardless of effort -- these tests should work in our environment
- Root cause investigation required (likely environment-specific issues, not merge-caused)
- Full Docker verification: build + start + health check with embedded PostgreSQL mode (PAPERCLIP_EMBEDDED_POSTGRES=true)
- Verify the health endpoint responds after container startup
- Dockerfile was kept-ours during merge (fork superset with Lightpanda, gosu, custom entrypoint)
- Add integration tests for all 8 v1.0 feature areas: token analytics, context optimization, webhooks, traces, activity feeds, task decomposition, skill profiles, code review
- Use API contract tests (supertest-style) consistent with existing smoke test pattern
- Mount routes, mock services, verify request/response contracts for key endpoints
- These are permanent regression tests, not temporary verification
- MERGE-02 through MERGE-05: already satisfied by phase 6 -- reference phase 6's results
- VERIFY-01 through VERIFY-04: verify after code changes (test fixes, new tests)
- Re-run full CI suite (typecheck + tests + build) after all code changes are made

### Claude's Discretion
- Exact test structure and mock patterns for integration tests
- Which endpoints per feature area to test (cover the most critical paths)
- How to fix the 3 upstream test failures (depends on root cause analysis)
- Docker health check timing and retry logic

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MERGE-02 | Server and adapter layers merged with CI verification passing | Already satisfied by phase 6 merge commit 8c83b0d -- verify with typecheck + tests |
| MERGE-03 | UI and infrastructure layers merged with CI verification passing | Already satisfied by phase 6 merge commit -- verify with build |
| MERGE-04 | pnpm lockfile regenerated cleanly after each merge chunk | Already clean -- `pnpm install --lockfile-only` completes in 206ms with no changes |
| MERGE-05 | All 226 upstream commits merged via merge commits (not rebase) | Already satisfied by phase 6 merge commit 8c83b0d |
| VERIFY-01 | Full test suite passes after merge (411+ tests) | Currently 542 pass / 3 fail (timeout) -- fix timeouts to reach 545+. Add integration tests to push higher. |
| VERIFY-02 | TypeScript compilation succeeds with zero errors | Already passing -- `npx tsc --noEmit` produces zero errors |
| VERIFY-03 | Docker build completes successfully | Requires Docker build + start + health check verification |
| VERIFY-04 | All v1.0 features verified working | Add supertest integration tests for all 8 feature areas |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | ^3.0.5 | Test runner | Already configured as monorepo project runner |
| supertest | ^7.0.0 | HTTP route testing | Already in server devDependencies, used by existing smoke tests |
| express | ^5.1.0 | Route mounting in tests | App framework, tests mount routes on express instances |
| vi (from vitest) | ^3.0.5 | Mocking services | `vi.hoisted()` + `vi.mock()` pattern established across 60+ test files |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @paperclipai/shared | workspace:* | Schemas, constants, types | Import validation schemas (createWebhookEndpointSchema, etc.) |
| @paperclipai/db | workspace:* | DB types for mocking | Type-safe mock DB construction |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| supertest | fetch + app.listen() | supertest is already established pattern, no reason to deviate |
| vi.mock | dependency injection | vi.mock is the universal pattern in this codebase |

**No new installations needed.** All dependencies are already present.

## Architecture Patterns

### Existing Test File Structure
```
server/src/__tests__/
  v1-api-smoke.test.ts           # Pattern reference: multi-route supertest
  github-routes-company-scoping.test.ts  # Pattern reference: single-route deep testing
  activity-routes.test.ts        # Pattern reference: service mocking with identifier resolution
  cost-token-analytics.test.ts   # Pattern reference: DB-level service testing
  webhook-dispatcher.test.ts     # Pattern reference: pure function testing
  code-review.test.ts            # Pattern reference: type + function testing
  dependency-graph.test.ts       # Pattern reference: algorithm testing
  skill-profile-resolver.test.ts # Pattern reference: pipeline processor testing
  context-pipeline.test.ts       # Pattern reference: pipeline integration testing
```

### Pattern 1: Supertest Route Testing (PRIMARY for new integration tests)
**What:** Mount route on express app, inject mock actor middleware, test HTTP contracts
**When to use:** Testing that routes are registered, accept correct input, return correct shapes
**Example:**
```typescript
// Source: server/src/__tests__/v1-api-smoke.test.ts
const mockService = vi.hoisted(() => ({
  list: vi.fn().mockResolvedValue([]),
  getById: vi.fn(),
  create: vi.fn(),
}));

vi.mock("../services/xyz.js", () => ({
  xyzService: () => mockService,
}));

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "board",
      userId: "user-1",
      companyIds: ["company-1"],
      source: "session",
      isInstanceAdmin: true,
    };
    next();
  });
  app.use("/api", xyzRoutes({} as any));
  app.use(errorHandler);
  return app;
}
```

### Pattern 2: Service-Level Testing (for services without route exposure)
**What:** Test service functions directly with mock DB
**When to use:** Token estimation, context optimization, dependency graph
**Example:**
```typescript
// Source: server/src/__tests__/cost-token-analytics.test.ts
const db = createMockDb({ /* mock data */ });
const service = costService(db);
const result = await service.summary("c1");
expect(result).toHaveProperty("totalTokens");
```

### Anti-Patterns to Avoid
- **Real DB in unit tests:** All route/service tests in this codebase mock the DB layer. Never spin up a real DB for these tests.
- **Testing implementation details:** Test HTTP contracts (status codes, response shapes), not internal function calls.
- **Overloaded test files:** Keep each feature area in its own test file for clear traceability.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP testing | Custom fetch wrappers | supertest | Already established, handles server lifecycle |
| Mock services | Manual stub objects | vi.hoisted() + vi.mock() | Ensures hoisting and consistent mock lifecycle |
| Actor injection | Custom auth middleware | Inline middleware in createApp() | Simple, matches existing pattern exactly |
| Docker health check | Custom retry logic | `curl --retry` or shell loop | Dockerfile already has HEALTHCHECK built in |

**Key insight:** Every pattern needed for phase 7 already exists in the codebase. The task is replication, not invention.

## Common Pitfalls

### Pitfall 1: Test Timeout Under Concurrent Load
**What goes wrong:** Tests that take 2500-3200ms in isolation exceed the 5000ms default timeout when the full suite runs concurrently.
**Why it happens:** Git worktree operations (init, commit, worktree add, provisioning) are I/O-heavy and slow under concurrent test load.
**How to avoid:** Add explicit timeout to the `it()` call: `it("test name", async () => { ... }, 15_000)`. The worktree:make test already uses `20_000` as a precedent (line 404 of worktree.test.ts).
**Warning signs:** Tests pass in isolation (`vitest run path/to/test.ts`) but fail in full suite.

### Pitfall 2: Mock Service Shape Mismatch
**What goes wrong:** Mock service missing a method that the route handler calls, causing runtime TypeError.
**Why it happens:** Routes call methods on the service factory return value. If the mock is incomplete, it blows up.
**How to avoid:** Check the actual route file to see which service methods are called. Only mock the methods actually invoked by the tested routes.
**Warning signs:** "TypeError: mockService.xyz is not a function" in test output.

### Pitfall 3: Activity Log Mock Missing
**What goes wrong:** Many routes call `logActivity()` after the main operation. If not mocked, the test fails with an import error.
**Why it happens:** Routes import from "../services/activity-log.js" or "../services/index.js".
**How to avoid:** Always include `vi.mock("../services/activity-log.js", () => ({ logActivity: vi.fn() }))` when testing routes that log activity.
**Warning signs:** Unhandled rejection in activity log call.

### Pitfall 4: Docker Build Context
**What goes wrong:** Docker build fails because files expected by COPY are missing or paths changed.
**Why it happens:** Dockerfile COPY expects specific package.json locations. If upstream added packages, the deps stage may miss them.
**How to avoid:** Verify the Dockerfile deps stage includes all packages in pnpm-workspace.yaml. Current Dockerfile already includes gemini-local adapter.
**Warning signs:** `pnpm install --frozen-lockfile` failing in Docker deps stage.

### Pitfall 5: Express 5 Error Handling
**What goes wrong:** Async route handlers that throw don't return error responses.
**Why it happens:** Express 5 handles async errors natively, but only if errorHandler middleware is mounted.
**How to avoid:** Always add `app.use(errorHandler)` after route mounting in test apps.
**Warning signs:** Test hangs instead of getting expected error response.

## Code Examples

### Fix Timeout: workspace-runtime.test.ts
```typescript
// Add timeout as third argument to it()
// Two tests need this fix:
it("creates and reuses a git worktree for an issue-scoped branch", async () => {
  // ... existing test body unchanged ...
}, 15_000);

it("runs a configured provision command inside the derived worktree", async () => {
  // ... existing test body unchanged ...
}, 15_000);
```

### Fix Timeout: worktree.test.ts
```typescript
// One test needs this fix:
it("copies shared git hooks into a linked worktree git dir", () => {
  // ... existing test body unchanged ...
}, 15_000);
```

### Integration Test: Token Analytics (costs routes)
```typescript
// New file: server/src/__tests__/v1-token-analytics-integration.test.ts
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/index.js";
import { costRoutes } from "../routes/costs.js";

const mockCostService = vi.hoisted(() => ({
  createEvent: vi.fn(),
  summary: vi.fn().mockResolvedValue({
    totalCostCents: 500,
    budgetMonthlyCents: 10000,
    totalTokens: 5000,
    cacheHitRate: 40.0,
    avgTokensPerRun: 500,
    avgCompressionRatio: 0.45,
  }),
  byAgent: vi.fn().mockResolvedValue([]),
  timeSeries: vi.fn().mockResolvedValue([]),
  contextComposition: vi.fn().mockResolvedValue({}),
  byProject: vi.fn().mockResolvedValue([]),
}));

const mockCompanyService = vi.hoisted(() => ({
  update: vi.fn(),
}));

const mockAgentService = vi.hoisted(() => ({
  getById: vi.fn(),
  update: vi.fn(),
}));

vi.mock("../services/index.js", () => ({
  costService: () => mockCostService,
  companyService: () => mockCompanyService,
  agentService: () => mockAgentService,
  logActivity: vi.fn(),
}));

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "board",
      userId: "user-1",
      companyIds: ["company-1"],
      source: "session",
      isInstanceAdmin: true,
    };
    next();
  });
  app.use("/api", costRoutes({} as any));
  app.use(errorHandler);
  return app;
}

describe("Token Analytics API contracts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET /costs/summary returns token analytics fields", async () => {
    const res = await request(createApp())
      .get("/api/companies/company-1/costs/summary");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("totalTokens");
    expect(res.body).toHaveProperty("cacheHitRate");
    expect(res.body).toHaveProperty("avgTokensPerRun");
    expect(res.body).toHaveProperty("avgCompressionRatio");
  });
});
```

### Docker Health Check Script
```bash
#!/bin/bash
# Build and verify Docker container
docker build -t paperclip:verify .
CONTAINER_ID=$(docker run -d \
  -e PAPERCLIP_EMBEDDED_POSTGRES=true \
  -p 3100:3100 \
  paperclip:verify)

# Wait for health check (Dockerfile has 10s start-period, 30s interval)
for i in $(seq 1 12); do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER_ID" 2>/dev/null)
  if [ "$STATUS" = "healthy" ]; then
    echo "Container healthy"
    break
  fi
  sleep 5
done

# Verify health endpoint
curl -sf http://localhost:3100/api/health | grep -q '"status":"ok"'
docker stop "$CONTAINER_ID"
docker rm "$CONTAINER_ID"
```

## 8 V1.0 Feature Areas -- Route/Test Mapping

| Feature Area | Route File | Key Endpoints | Existing Tests | New Integration Test |
|---|---|---|---|---|
| 1. Token Analytics | `routes/costs.ts` | GET /costs/summary, GET /costs/by-agent, GET /costs/time-series, GET /costs/context-composition, GET /costs/by-project | cost-token-analytics.test.ts (service-level) | Route-level contract test |
| 2. Context Optimization | `context-pipeline/` | N/A (internal pipeline) | context-pipeline.test.ts, context-serializer.test.ts, prompt-reorderer.test.ts, model-context-limits.test.ts | Service-level integration: pipeline produces expected output shape |
| 3. Webhooks | `routes/webhooks.ts` | GET /webhooks, POST /webhooks | v1-api-smoke.test.ts (list only) | Full CRUD contract test |
| 4. Traces | `routes/activity.ts` | GET /activity, GET /issues/:id/activity, GET /issues/:id/runs, GET /heartbeat-runs/:runId/issues | activity-routes.test.ts (runs only) | Full trace endpoint contract tests |
| 5. Activity Feeds | `routes/activity.ts` | GET /companies/:id/activity, POST /companies/:id/activity | activity-routes.test.ts (partial) | List + create contract tests |
| 6. Task Decomposition | `routes/issues.ts` (dependency endpoints) | POST /issues/:id/dependencies | dependency-graph.test.ts (algorithm) | Route-level dependency CRUD test |
| 7. Skill Profiles | `routes/skill-profiles.ts` | GET /skill-profiles, POST /skill-profiles, GET /skill-profiles/:id | v1-api-smoke.test.ts (list only) | Full CRUD contract test |
| 8. Code Review | `services/code-review.ts` | N/A (service-level, calls GitHub API) | code-review.test.ts | Service contract test: parsePrUrl + buildReviewPayload already tested; add codeReviewService mock test |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Skip timeout tests | Increase per-test timeout | Already done for worktree:make (20s) | Fix 3 failures without skipping |
| Manual feature verification | Automated supertest contracts | Phase 7 (now) | Permanent regression protection |

**Current codebase state (verified 2026-03-13):**
- TypeScript: zero errors across all packages
- Lockfile: clean (`pnpm install --lockfile-only` 206ms, no changes)
- Tests: 542 pass, 3 fail (all timeout), 1 skipped
- Build: Not verified in this research session (requires full `pnpm -r build`)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.0.5 (workspace mode) |
| Config file | `vitest.config.ts` (root, delegates to package configs) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `pnpm typecheck && npx vitest run && pnpm build` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MERGE-02 | Server + adapters compile and pass tests | typecheck + unit | `pnpm typecheck && npx vitest run` | Existing (542 tests) |
| MERGE-03 | UI compiles and renders | build | `pnpm --filter @paperclipai/ui build` | Existing (37 UI tests) |
| MERGE-04 | Clean lockfile + build | lockfile + build | `pnpm install --lockfile-only && pnpm build` | Manual verification |
| MERGE-05 | 226 commits merged | git verification | `git log --oneline 8c83b0d -1` | Already done in phase 6 |
| VERIFY-01 | Full test suite passes (411+ tests) | unit + integration | `npx vitest run` | Needs 3 timeout fixes |
| VERIFY-02 | TypeScript zero errors | typecheck | `pnpm typecheck` | Already passing |
| VERIFY-03 | Docker build completes, container starts | Docker build + health | Docker build + curl health check | Wave 0: needs script |
| VERIFY-04 | 8 v1.0 features verified | integration | `npx vitest run server/src/__tests__/v1-*.test.ts` | Wave 0: needs 8 test files |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `pnpm typecheck && npx vitest run && pnpm build`
- **Phase gate:** Full suite green + Docker healthy before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `server/src/__tests__/v1-integration-token-analytics.test.ts` -- covers VERIFY-04 (token analytics)
- [ ] `server/src/__tests__/v1-integration-context-optimization.test.ts` -- covers VERIFY-04 (context optimization)
- [ ] `server/src/__tests__/v1-integration-webhooks.test.ts` -- covers VERIFY-04 (webhooks)
- [ ] `server/src/__tests__/v1-integration-traces.test.ts` -- covers VERIFY-04 (traces)
- [ ] `server/src/__tests__/v1-integration-activity-feeds.test.ts` -- covers VERIFY-04 (activity feeds)
- [ ] `server/src/__tests__/v1-integration-task-decomposition.test.ts` -- covers VERIFY-04 (task decomposition)
- [ ] `server/src/__tests__/v1-integration-skill-profiles.test.ts` -- covers VERIFY-04 (skill profiles)
- [ ] `server/src/__tests__/v1-integration-code-review.test.ts` -- covers VERIFY-04 (code review)
- [ ] Timeout fix for workspace-runtime.test.ts (2 tests) -- covers VERIFY-01
- [ ] Timeout fix for worktree.test.ts (1 test) -- covers VERIFY-01

## Open Questions

1. **Docker build time**
   - What we know: Dockerfile installs claude-code, codex, opencode-ai, agent-browser, lightpanda, gh CLI globally. This is likely a multi-minute build.
   - What's unclear: Whether the build will succeed with current lockfile state and all the global npm installs.
   - Recommendation: Run `docker build` early in the phase to surface issues. If build takes too long, consider caching layers.

2. **Embedded PostgreSQL in Docker**
   - What we know: PAPERCLIP_EMBEDDED_POSTGRES=true is documented as environment variable. The entrypoint.sh drops to paperclip user via gosu.
   - What's unclear: Whether embedded-postgres npm package works correctly inside the container without additional system dependencies.
   - Recommendation: Test this empirically. The container may need additional packages for embedded postgres to function.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: All test files, route files, service files, Dockerfile, vitest configs
- Test suite execution: `npx vitest run --reporter=verbose` (542 pass, 3 fail, all timeout)
- Isolated test runs: Both failing test files pass in isolation (2500-3200ms per test)
- TypeScript check: `npx tsc --noEmit` zero errors
- Lockfile check: `pnpm install --lockfile-only` clean in 206ms

### Secondary (MEDIUM confidence)
- Docker HEALTHCHECK configuration in Dockerfile (verified in file, not tested at runtime)

### Tertiary (LOW confidence)
- Embedded PostgreSQL behavior inside Docker container (not tested, based on env var documentation)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all tools already in use, verified in package.json and existing tests
- Architecture: HIGH -- patterns directly observed in 60+ existing test files
- Pitfalls: HIGH -- timeout root cause verified by running tests both in isolation and full suite
- Docker: MEDIUM -- Dockerfile verified, runtime behavior not tested

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (stable codebase, no external dependencies changing)
