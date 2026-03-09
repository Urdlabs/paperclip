# Testing Patterns

**Analysis Date:** 2026-03-08

## Test Framework

**Runner:**
- Vitest 3.x
- Root config: `vitest.config.ts`
- Workspace projects: `packages/db`, `packages/adapters/opencode-local`, `server`, `ui`, `cli`

**Assertion Library:**
- Vitest built-in `expect` (compatible with Jest API)
- No additional assertion libraries

**Run Commands:**
```bash
pnpm test               # Run all tests in watch mode
pnpm test:run           # Run all tests once (CI mode)
vitest run              # Direct vitest invocation
```

## Test File Organization

**Location:**
- Server tests: `server/src/__tests__/*.test.ts` (dedicated `__tests__` directory)
- CLI tests: `cli/src/__tests__/*.test.ts` (dedicated `__tests__` directory)
- Adapter tests: co-located next to source files, e.g., `packages/adapters/opencode-local/src/server/models.test.ts`
- UI tests: **None exist currently** -- `ui/vitest.config.ts` is configured (jsdom environment) but no test files are present
- DB tests: **None exist currently** -- `packages/db/vitest.config.ts` is configured but no test files are present

**Naming:**
- All test files use `*.test.ts` suffix (never `*.spec.ts`)
- Names mirror the module or feature under test: `error-handler.test.ts`, `agent-auth-jwt.test.ts`, `hire-hook.test.ts`

**Structure:**
```
server/src/__tests__/
  adapter-models.test.ts
  adapter-session-codecs.test.ts
  agent-auth-jwt.test.ts
  board-mutation-guard.test.ts
  claude-local-adapter.test.ts
  error-handler.test.ts
  health.test.ts
  hire-hook.test.ts
  invite-expiry.test.ts
  issues-checkout-wakeup.test.ts
  paperclip-env.test.ts
  private-hostname-guard.test.ts
  redaction.test.ts
  storage-local-provider.test.ts
  ... (50+ test files)

cli/src/__tests__/
  agent-jwt-env.test.ts
  allowed-hostname.test.ts
  common.test.ts
  company-delete.test.ts
  context.test.ts
  data-dir.test.ts
  home-paths.test.ts
  http.test.ts

packages/adapters/opencode-local/src/server/
  models.test.ts       # co-located
  parse.test.ts        # co-located

packages/adapters/pi-local/src/server/
  models.test.ts       # co-located
  parse.test.ts        # co-located
```

## Test Structure

**Suite Organization:**
```typescript
// Standard pattern: import from vitest, describe/it/expect
import { describe, expect, it } from "vitest";

describe("featureName", () => {
  it("describes expected behavior", () => {
    // Arrange
    const input = { ... };

    // Act
    const result = functionUnderTest(input);

    // Assert
    expect(result).toBe(expected);
  });
});
```

**Patterns:**
- Always import `describe`, `it`, `expect` (and `vi`, `beforeEach`, `afterEach` when needed) explicitly from `"vitest"`
- Use `describe` blocks to group related tests
- Nested `describe` blocks are rare -- prefer flat structures with descriptive `it` names
- Test names are written as behavior descriptions: `"returns 200 with status ok"`, `"blocks board mutations without trusted origin"`, `"rejects expired tokens"`

## Setup and Teardown

**Environment Variables:**
- Save original env values before tests, restore after:
```typescript
// server/src/__tests__/paperclip-env.test.ts
const ORIGINAL_PAPERCLIP_API_URL = process.env.PAPERCLIP_API_URL;

afterEach(() => {
  if (ORIGINAL_PAPERCLIP_API_URL === undefined) delete process.env.PAPERCLIP_API_URL;
  else process.env.PAPERCLIP_API_URL = ORIGINAL_PAPERCLIP_API_URL;
});
```

- Alternative pattern using object snapshot:
```typescript
// cli/src/__tests__/common.test.ts
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.PAPERCLIP_API_URL;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});
```

**Temp Files:**
- Use `fs.mkdtempSync()` for temporary directories, clean up in `afterEach`:
```typescript
// cli/src/__tests__/common.test.ts
function createTempPath(name: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "paperclip-cli-common-"));
  return path.join(dir, name);
}
```

**Fake Timers:**
```typescript
// server/src/__tests__/agent-auth-jwt.test.ts
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});
```

## Mocking

**Framework:** Vitest built-in `vi` mock utilities

**Module Mocking with vi.mock:**
```typescript
// server/src/__tests__/hire-hook.test.ts
vi.mock("../adapters/registry.js", () => ({
  findServerAdapter: vi.fn(),
}));
vi.mock("../services/activity-log.js", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

// Import after mocking (dynamic import required)
const { findServerAdapter } = await import("../adapters/registry.js");
const { logActivity } = await import("../services/activity-log.js");

// Usage in test
vi.mocked(findServerAdapter).mockReturnValue({
  type: "openclaw_gateway",
  onHireApproved: vi.fn().mockResolvedValue({ ok: true }),
} as any);
```

**Global Stubbing (fetch):**
```typescript
// cli/src/__tests__/http.test.ts
const fetchMock = vi.fn().mockResolvedValue(
  new Response(JSON.stringify({ ok: true }), { status: 200 }),
);
vi.stubGlobal("fetch", fetchMock);

afterEach(() => {
  vi.restoreAllMocks();
});
```

**Spy on globals:**
```typescript
// server/src/__tests__/adapter-models.test.ts
const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
  ok: true,
  json: async () => ({ data: [{ id: "gpt-5-pro" }] }),
} as Response);

expect(fetchSpy).toHaveBeenCalledTimes(1);
```

**Manual Mock Objects (Express):**
```typescript
// server/src/__tests__/error-handler.test.ts
function makeReq(): Request {
  return {
    method: "GET",
    originalUrl: "/api/test",
    body: { a: 1 },
    params: { id: "123" },
    query: { q: "x" },
  } as unknown as Request;
}

function makeRes(): Response {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  } as unknown as Response;
  (res.status as unknown as ReturnType<typeof vi.fn>).mockReturnValue(res);
  return res;
}
```

**Database Mocking:**
```typescript
// server/src/__tests__/hire-hook.test.ts
function mockDbWithAgent(agent: { ... }): Db {
  return {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve([{ ...agent }]),
      }),
    }),
  } as unknown as Db;
}
```

**What to Mock:**
- External API calls (fetch, WebSocket connections)
- Database layer (Db) when testing service/route logic in isolation
- Module-level singletons (adapter registry, activity logger)
- Process environment variables
- File system operations (via temp directories)
- Timers (via `vi.useFakeTimers()`)

**What NOT to Mock:**
- Pure functions under test (validators, parsers, codecs)
- Zod schemas
- Express router setup (use supertest for integration-style testing)

## HTTP Route Testing with Supertest

**Pattern:** Create a mini Express app, mount the route/middleware, test with supertest.

```typescript
// server/src/__tests__/health.test.ts
import express from "express";
import request from "supertest";
import { healthRoutes } from "../routes/health.js";

describe("GET /health", () => {
  const app = express();
  app.use("/health", healthRoutes());

  it("returns 200 with status ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
```

**Middleware Testing Pattern:**
```typescript
// server/src/__tests__/board-mutation-guard.test.ts
function createApp(actorType: "board" | "agent") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.actor = actorType === "board"
      ? { type: "board", userId: "board", source: "session" }
      : { type: "agent", agentId: "agent-1" };
    next();
  });
  app.use(boardMutationGuard());
  app.post("/mutate", (_req, res) => { res.status(204).end(); });
  return app;
}
```

Key: Middleware under test gets a manually-injected `req.actor` via a preceding middleware, then supertest exercises the full middleware chain.

## Adapter Parser Testing

**Pattern:** Feed raw JSONL stdout to parsers and assert structured output.

```typescript
// packages/adapters/opencode-local/src/server/parse.test.ts
describe("parseOpenCodeJsonl", () => {
  it("parses assistant text, usage, cost, and errors", () => {
    const stdout = [
      JSON.stringify({ type: "text", sessionID: "session_123", part: { text: "Hello" } }),
      JSON.stringify({ type: "step_finish", sessionID: "session_123", part: { ... } }),
    ].join("\n");

    const parsed = parseOpenCodeJsonl(stdout);
    expect(parsed.sessionId).toBe("session_123");
    expect(parsed.summary).toBe("Hello");
  });
});
```

## Adapter Model Discovery Testing

**Pattern:** Use `resetXxxModelsCacheForTests()` exposed by adapter modules to clear caching between tests.

```typescript
// server/src/__tests__/adapter-models.test.ts
import { resetCodexModelsCacheForTests } from "../adapters/codex-models.js";

beforeEach(() => {
  delete process.env.OPENAI_API_KEY;
  resetCodexModelsCacheForTests();
  vi.restoreAllMocks();
});
```

## Fixtures and Factories

**Test Data:**
- No shared fixture files or factory library
- Each test file defines its own inline builders/helpers:
```typescript
// server/src/__tests__/heartbeat-workspace-session.test.ts
function buildResolvedWorkspace(overrides: Partial<ResolvedWorkspaceForRun> = {}): ResolvedWorkspaceForRun {
  return {
    cwd: "/tmp/project",
    source: "project_primary",
    projectId: "project-1",
    workspaceId: "workspace-1",
    ...overrides,
  };
}
```

**Location:**
- Inline within test files -- no shared `__fixtures__/` or `__factories__/` directories

## Coverage

**Requirements:** Not enforced -- no coverage thresholds configured in vitest.config.ts

**View Coverage:**
```bash
vitest run --coverage    # Generate coverage report
```

## Test Types

**Unit Tests:**
- The majority of tests are unit tests
- Test pure functions, parsers, validators, codecs, and utility logic
- Examples: `redaction.test.ts`, `invite-expiry.test.ts`, `issues-checkout-wakeup.test.ts`, `parse.test.ts`

**Integration Tests (HTTP):**
- Use supertest + Express to test route handlers and middleware
- Create mini Express apps with the middleware/route under test
- Examples: `health.test.ts`, `board-mutation-guard.test.ts`, `private-hostname-guard.test.ts`

**Integration Tests (Service):**
- Test service functions with mocked DB and mocked adapters
- Examples: `hire-hook.test.ts`, `openclaw-gateway-adapter.test.ts`, `github-app-company-scoping.test.ts`

**Integration Tests (Filesystem):**
- Use temp directories for storage testing
- Examples: `storage-local-provider.test.ts`, `data-dir.test.ts`, `context.test.ts`

**E2E Tests:**
- Smoke tests exist as shell scripts in `scripts/smoke/` but are not part of the vitest suite
- No Playwright or Cypress -- UI has no automated tests

## Vitest Configuration

**Per-Project Configs:**

| Project | Config File | Environment |
|---------|------------|-------------|
| Root | `vitest.config.ts` | workspace orchestrator |
| Server | `server/vitest.config.ts` | `node` |
| CLI | `cli/vitest.config.ts` | `node` |
| UI | `ui/vitest.config.ts` | `jsdom` |
| DB | `packages/db/vitest.config.ts` | `node` |
| Adapters | `packages/adapters/*/vitest.config.ts` | `node` |

All configs are minimal -- just `defineConfig({ test: { environment: "node" } })`.

## Common Patterns

**Async Testing:**
```typescript
// Use async/await with expect
it("round-trips bytes through storage", async () => {
  const stored = await service.putFile({ ... });
  const fetched = await service.getObject("company-1", stored.objectKey);
  expect(fetchedBody.toString("utf8")).toBe("hello image bytes");
});

// Use resolves/rejects matchers
await expect(listOpenCodeModels()).resolves.toEqual([]);
await expect(ensureOpenCodeModelConfiguredAndAvailable({ model: "" }))
  .rejects.toThrow("OpenCode requires `adapterConfig.model`");
```

**Error Testing:**
```typescript
// toThrow with string/regex
expect(() =>
  resolveCommandContext({ ... }, { requireCompany: true }),
).toThrow(/Company ID is required/);

// rejects.toThrow for async
await expect(
  ensureOpenCodeModelConfiguredAndAvailable({ model: "" }),
).rejects.toThrow("OpenCode requires `adapterConfig.model`");

// rejects.toMatchObject for structured errors
await expect(service.getObject("company-b", key))
  .rejects.toMatchObject({ status: 403 });

await expect(client.post("/api/issues/1/checkout", {}))
  .rejects.toMatchObject({
    status: 409,
    message: "Issue checkout conflict",
    details: { issueId: "1" },
  } satisfies Partial<ApiRequestError>);
```

**Matching Patterns:**
```typescript
// toMatchObject for partial matching
expect(claims).toMatchObject({
  sub: "agent-1",
  company_id: "company-1",
  adapter_type: "claude_local",
});

// expect.anything() and expect.objectContaining() for flexible matching
expect(logActivity).toHaveBeenCalledWith(
  expect.anything(),
  expect.objectContaining({
    action: "hire_hook.succeeded",
    entityId: "a1",
    details: expect.objectContaining({ source: "approval" }),
  }),
);
```

## Test Gaps

**No UI Tests:**
- `ui/vitest.config.ts` is configured with jsdom but no test files exist
- All React components, hooks, contexts, and pages are untested

**No DB Package Tests:**
- `packages/db/vitest.config.ts` exists but no test files
- Schema definitions and migration logic have no unit tests

**No End-to-End Tests:**
- No Playwright, Cypress, or similar browser automation
- Smoke tests are shell scripts, not integrated into the test runner

---

*Testing analysis: 2026-03-08*
