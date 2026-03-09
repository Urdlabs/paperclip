# Codebase Concerns

**Analysis Date:** 2026-03-08

## Tech Debt

**Heartbeat service is a monolithic 2457-line file:**
- Issue: `server/src/services/heartbeat.ts` contains run execution, workspace resolution, session management, wakeup queuing, issue execution locking, orphan reaping, timer ticking, and runtime state management all in a single file. This is the core engine of the system and its complexity makes it fragile.
- Files: `server/src/services/heartbeat.ts`
- Impact: Difficult to test in isolation, hard to reason about state transitions, risk of regressions when changing one subsystem (e.g., session codec logic) that accidentally affects another (e.g., issue execution locking).
- Fix approach: Extract sub-concerns into focused modules: workspace resolution (~100 lines), session management (~150 lines), issue execution locking (~300 lines), and wakeup queuing (~400 lines). Keep the `heartbeatService()` factory as the public API but delegate to composed sub-services.

**Access routes file is 2604 lines with mixed concerns:**
- Issue: `server/src/routes/access.ts` handles invites, join requests, board claim, OpenClaw gateway join flows, permission management, member CRUD, and skill markdown serving. Many utility functions (header normalization, token generation, boolean parsing) are defined inline.
- Files: `server/src/routes/access.ts`
- Impact: Onboarding logic changes require navigating a very large file. Inline utility functions are not reusable or testable.
- Fix approach: Split into separate route files (e.g., `routes/invites.ts`, `routes/members.ts`, `routes/join-requests.ts`). Extract utility functions into `server/src/utils/`.

**Direct DB queries in route handlers:**
- Issue: Some route files contain direct database queries mixed with HTTP logic rather than delegating to service layers. `server/src/routes/access.ts` has 25 direct DB operations, `server/src/routes/agents.ts` has 8, and `server/src/routes/issues.ts` has 6.
- Files: `server/src/routes/access.ts`, `server/src/routes/agents.ts`, `server/src/routes/issues.ts`, `server/src/routes/costs.ts`
- Impact: Business logic is split between routes and services, making it harder to enforce authorization consistently and to unit test without HTTP scaffolding.
- Fix approach: Move all DB operations into the corresponding service layer. Routes should only handle HTTP concerns (parsing, validation, response formatting).

**Pervasive `as any` casts:**
- Issue: The `db` instance is passed as `as any` at least 7 times in `server/src/index.ts` when creating the app, setting up WebSockets, and bootstrapping auth. The middleware logger uses `(res as any).__errorContext` and `(req as any).route?.path` patterns.
- Files: `server/src/index.ts` (lines 410, 445, 449, 450, 456, 484, 490), `server/src/middleware/error-handler.ts` (lines 20, 29), `server/src/middleware/logger.ts` (lines 56, 57, 62, 72, 82, 83)
- Impact: Type safety is bypassed. Refactoring the Db type or Express augmentations could introduce runtime errors that TypeScript would not catch.
- Fix approach: Properly type the `db` variable in `index.ts` (likely needs conditional typing for the two initialization branches). Replace `(res as any).__errorContext` with a typed helper using `Symbol` or a WeakMap.

**Duplicated master key loading logic:**
- Issue: The master encryption key loading/generation logic is implemented independently in both the local encrypted secrets provider and the GitHub App service, with slight differences.
- Files: `server/src/secrets/local-encrypted-provider.ts` (lines 14-73), `server/src/services/github-app.ts` (lines 27-83)
- Impact: A security fix in one location (e.g., key validation) might not be applied to the other. The GitHub App service caches the key in a module-level `_masterKey` variable while the secrets provider reloads it on every operation.
- Fix approach: Extract a single `loadMasterKey()` function into a shared utility (e.g., `server/src/secrets/master-key.ts`) and import it from both modules.

**`isLoopbackHost` function duplicated across files:**
- Issue: The `isLoopbackHost()` function is independently defined in `server/src/index.ts`, `server/src/routes/access.ts`, and `server/src/middleware/private-hostname-guard.ts` with slight naming variations.
- Files: `server/src/index.ts` (line 156), `server/src/routes/access.ts` (line 134), `server/src/middleware/private-hostname-guard.ts` (line 3)
- Impact: Behavioral inconsistencies across loopback checks; maintenance burden.
- Fix approach: Extract to a shared utility in `server/src/utils/network.ts`.

**Service factory functions instantiated per-request in routes:**
- Issue: Route factory functions like `agentRoutes(db)` create service instances (e.g., `heartbeatService(db)`, `agentService(db)`, `accessService(db)`, `issueApprovalService(db)`) in the closure scope. Multiple route files create their own instances of the same services, leading to duplicated service objects.
- Files: `server/src/routes/agents.ts` (lines 52-58), `server/src/routes/issues.ts` (lines 41-47)
- Impact: Each route file holds its own service reference. If services had internal caching or state, they would not be shared. Currently services are stateless wrappers over `db`, so the runtime impact is minimal, but it creates maintainability issues when you need to change service initialization.
- Fix approach: Create a single service registry or dependency injection container initialized once in `createApp()` and passed to route factories.

## Known Bugs

No explicit TODO/FIXME/HACK comments or known bug markers were found in the codebase.

## Security Considerations

**No rate limiting on API endpoints:**
- Risk: Brute-force attacks against invite tokens, API keys, or authentication endpoints are not throttled. The invite token space is small (8 alphanumeric characters = ~2.8 trillion combinations, but tokens are hashed and checked via DB lookup).
- Files: `server/src/app.ts`, `server/src/middleware/auth.ts`, `server/src/routes/access.ts`
- Current mitigation: Invite tokens have a 10-minute TTL (`COMPANY_INVITE_TTL_MS`). API keys use SHA-256 hashing with timing-safe comparison.
- Recommendations: Add rate limiting middleware (e.g., `express-rate-limit`) globally and with stricter limits on auth-sensitive endpoints (`/api/auth/*`, invite acceptance, join requests).

**No CORS headers configured:**
- Risk: In authenticated mode with public exposure, cross-origin requests are not explicitly controlled by the server. The `boardMutationGuard` checks `Origin`/`Referer` for mutation requests, but this is not a substitute for proper CORS configuration.
- Files: `server/src/app.ts`, `server/src/middleware/board-mutation-guard.ts`
- Current mitigation: `boardMutationGuard` blocks board mutations without a trusted origin/referer. Agents authenticate via Bearer tokens.
- Recommendations: Add explicit CORS middleware with a configurable allow-list derived from `config.allowedHostnames` and `config.authPublicBaseUrl`.

**No CSP or security headers (Helmet):**
- Risk: The Express app does not set Content-Security-Policy, X-Frame-Options, Strict-Transport-Security, or other security headers. When serving the UI via `express.static()`, this leaves the frontend vulnerable to XSS and clickjacking.
- Files: `server/src/app.ts` (lines 134-149)
- Current mitigation: None detected.
- Recommendations: Add `helmet` middleware with sensible defaults. Configure CSP to restrict script sources to `'self'`.

**Embedded PostgreSQL uses hardcoded credentials:**
- Risk: The embedded PostgreSQL instance uses `user: "paperclip"`, `password: "paperclip"` which are hardcoded in `server/src/index.ts`. If the embedded Postgres port is accidentally exposed, the credentials are trivially guessable.
- Files: `server/src/index.ts` (lines 320-328, 354, 360)
- Current mitigation: Embedded Postgres only binds to `127.0.0.1`. The server enforces loopback binding in `local_trusted` mode.
- Recommendations: Generate a random password for embedded Postgres on first initialization and store it alongside the data directory.

**Validate middleware does not catch Zod errors in same middleware chain:**
- Risk: `server/src/middleware/validate.ts` calls `schema.parse(req.body)` synchronously but does not wrap it in try/catch. If Zod throws, the error propagates to the Express error handler. This works correctly because the error handler catches `ZodError`, but the validate middleware itself does not return a clean 400.
- Files: `server/src/middleware/validate.ts`, `server/src/middleware/error-handler.ts`
- Current mitigation: The global error handler catches `ZodError` and returns 400. This works, but it means the error handler must always be mounted after validation routes.
- Recommendations: Wrap `schema.parse()` in try/catch within the validate middleware itself for defense in depth.

**GitHub installation tokens injected into environment contain raw secrets:**
- Risk: When GitHub App tokens are injected into agent environments via `GIT_CONFIG_KEY_*` / `GIT_CONFIG_VALUE_*`, the raw token appears in the environment variable name itself (`url.https://x-access-token:{TOKEN}@github.com/...`). If the adapter logs environment variables, the token could be exposed.
- Files: `server/src/services/heartbeat.ts` (lines 1272-1307)
- Current mitigation: The `onAdapterMeta` callback redacts known secret keys from logged env vars. The redaction uses the `secretKeys` set from the secrets service, which may not include the dynamically generated `GIT_CONFIG_KEY_*` variables.
- Recommendations: Ensure the git credential injection env var keys (`GIT_CONFIG_KEY_*`, `GIT_CONFIG_VALUE_*`) are always redacted in adapter meta logs.

## Performance Bottlenecks

**In-memory event emitter for live events has no backpressure:**
- Problem: `server/src/services/live-events.ts` uses a Node.js `EventEmitter` with `setMaxListeners(0)` to broadcast events to all WebSocket clients. Every event is sent to every subscriber on the same company ID.
- Files: `server/src/services/live-events.ts`, `server/src/realtime/live-events-ws.ts`
- Cause: Single-process pub/sub with no message queuing, deduplication, or backpressure. High-frequency events (e.g., `heartbeat.run.log` with streaming stdout chunks) generate heavy broadcast load.
- Improvement path: Add event buffering/batching in the WebSocket layer. For multi-process deployments, replace the in-memory emitter with Redis pub/sub or similar.

**Orphan reaper scans all running runs every heartbeat interval:**
- Problem: `reapOrphanedRuns()` loads all rows with `status = 'running'` from `heartbeatRuns` and checks each against in-memory `runningProcesses` and `activeRunExecutions` sets.
- Files: `server/src/services/heartbeat.ts` (lines 901-952)
- Cause: Full table scan of running runs every 30 seconds (default `heartbeatSchedulerIntervalMs`).
- Improvement path: Add an index on `(status, updatedAt)` and filter in SQL: only select runs where `updatedAt < NOW() - staleThreshold`. This avoids loading runs that are obviously still active.

**Large UI page components:**
- Problem: Several page components exceed 900 lines: `AgentDetail.tsx` (2593), `AgentConfigForm.tsx` (1489), `DesignGuide.tsx` (1330), `OnboardingWizard.tsx` (1225), `IssueDetail.tsx` (931), `Inbox.tsx` (948).
- Files: `ui/src/pages/AgentDetail.tsx`, `ui/src/components/AgentConfigForm.tsx`, `ui/src/pages/DesignGuide.tsx`, `ui/src/components/OnboardingWizard.tsx`
- Cause: UI components have grown organically without decomposition. These are not code-split and contain inline sub-components.
- Improvement path: Extract sub-sections into dedicated components (e.g., `AgentDetailConfig.tsx`, `AgentDetailRuns.tsx`, `AgentDetailKeys.tsx`). Lazy-load tab content.

## Fragile Areas

**Issue execution locking in heartbeat wakeup:**
- Files: `server/src/services/heartbeat.ts` (lines 1802-2000+)
- Why fragile: The `enqueueWakeup()` function contains a ~200-line database transaction that manages issue execution locks, deferred wakeups, coalesced wakeups, legacy run detection, and comment-triggered follow-up queuing. The logic has multiple branches based on `isSameExecutionAgent`, `shouldQueueFollowupForCommentWake`, and `bypassIssueExecutionLock` flags.
- Safe modification: Any changes to wakeup/execution lock behavior must be tested with concurrent wakeups for the same issue from different agents and same-name agents. Use the existing `server/src/__tests__/issues-checkout-wakeup.test.ts` as a starting point.
- Test coverage: Partial. `issues-checkout-wakeup.test.ts` exists but the core `enqueueWakeup()` transaction is not directly unit tested -- it requires a running database.

**Nested try/catch in executeRun:**
- Files: `server/src/services/heartbeat.ts` (lines 1057-1591)
- Why fragile: `executeRun()` has a double-nested try/catch structure (inner try for adapter execution, outer try for setup failures at line 1572). The outer catch at line 1572 uses `.catch(() => {})` to swallow errors during cleanup. The nesting makes control flow hard to follow and errors in setup code may be silently swallowed.
- Safe modification: When modifying run execution flow, trace all code paths to ensure a run never stays in "running" status forever. The outer catch exists specifically to prevent this.
- Test coverage: No direct test for `executeRun()` internals; tested indirectly through integration tests.

**eslint-disable-line comments in React hooks:**
- Files: `ui/src/pages/IssueDetail.tsx` (lines 487, 496), `ui/src/components/AgentConfigForm.tsx` (lines 204, 265), `ui/src/pages/GoalDetail.tsx` (line 111), `ui/src/pages/NewAgent.tsx` (line 105), `ui/src/pages/AgentDetail.tsx` (line 418), `ui/src/pages/ProjectDetail.tsx` (line 283), `ui/src/components/IssuesList.tsx` (line 277)
- Why fragile: Nine `eslint-disable-line react-hooks/exhaustive-deps` suppressions indicate `useEffect` hooks with intentionally missing dependencies. These can cause stale closures, missed re-renders, or infinite loops if the suppressed dependencies change shape.
- Safe modification: Before modifying state in these components, verify that the suppressed deps are truly stable. If the suppressed dep is a function, wrap it in `useCallback`; if it is a derived value, use `useMemo`.
- Test coverage: No UI tests exist (0 test files in `ui/src/`).

**Config loading with extensive env var fallback chains:**
- Files: `server/src/config.ts`
- Why fragile: `loadConfig()` resolves each setting from up to 4 sources: environment variable -> config file -> computed default -> hardcoded fallback. Some settings like `authPublicBaseUrl` check 5 different env vars (`PAPERCLIP_AUTH_PUBLIC_BASE_URL`, `BETTER_AUTH_URL`, `BETTER_AUTH_BASE_URL`, `PAPERCLIP_PUBLIC_URL`, config file). An unexpected env var set in CI or Docker could silently override intended behavior.
- Safe modification: Add a debug/info log that prints the resolved config source for each setting at startup.
- Test coverage: No direct tests for `loadConfig()`.

## Scaling Limits

**Single-process architecture:**
- Current capacity: One Node.js process handles all HTTP requests, WebSocket connections, heartbeat scheduling, and child process execution for agents. The in-memory `runningProcesses` map, `activeRunExecutions` set, and `startLocksByAgent` map are process-local.
- Limit: Cannot horizontally scale. Running multiple server instances would cause orphan reaping races, duplicate heartbeat timer ticks, and split WebSocket pub/sub.
- Scaling path: Extract the heartbeat scheduler into a separate worker process. Replace the in-memory EventEmitter (`live-events.ts`) with Redis pub/sub. Use database-level advisory locks for heartbeat timer ticks.

**In-memory live event bus:**
- Current capacity: All live events are broadcast through a Node.js `EventEmitter` with `setMaxListeners(0)`.
- Limit: Memory grows with the number of connected WebSocket clients. No event persistence; reconnecting clients miss events that occurred during disconnect.
- Scaling path: Add a short event buffer per company (last N events) for reconnection catch-up. For multi-instance, move to Redis Streams or similar.

## Dependencies at Risk

**`embedded-postgres` is a beta package:**
- Risk: Version `^18.1.0-beta.16` is used for the embedded PostgreSQL mode. Beta versions may have breaking changes or stability issues.
- Impact: The embedded Postgres mode is the default for local development and single-user deployments. A broken update could prevent server startup.
- Migration plan: Pin to a specific version rather than `^` range. Monitor for stable releases. The external PostgreSQL path (`DATABASE_URL`) is the production-recommended approach.

**Express v5 is relatively new:**
- Risk: `express@^5.1.0` is used. Express 5 was recently released after a long beta period and may have ecosystem compatibility issues with middleware.
- Impact: Some middleware packages may not yet fully support Express 5 types or behavior (e.g., async error handling changes).
- Migration plan: Monitor Express 5 issue tracker. The codebase already uses Express 5's async-aware error handling patterns correctly.

## Missing Critical Features

**No UI test coverage:**
- Problem: The `ui/` workspace has 0 test files across ~31,000 lines of TypeScript/TSX code and ~40+ components.
- Blocks: Cannot verify UI behavior changes, refactors to large components, or adapter rendering logic without manual testing.

**No integration/E2E test suite:**
- Problem: All 49 test files are unit tests. There are no integration tests that verify the full request lifecycle (HTTP request -> route -> service -> DB -> response), and no E2E tests for the UI.
- Blocks: Service layer changes, migration scripts, and cross-cutting concerns (auth, authorization) cannot be verified automatically.

## Test Coverage Gaps

**Heartbeat service execution path:**
- What's not tested: The core `executeRun()` function (lines 1057-1591) and `enqueueWakeup()` function (lines 1745-2000+) are not directly unit-tested. These contain the most critical business logic in the system.
- Files: `server/src/services/heartbeat.ts`
- Risk: Regressions in run execution, session management, or issue locking would not be caught by automated tests.
- Priority: High

**Route-level authorization:**
- What's not tested: Most routes have authorization logic (`assertCompanyAccess`, `assertBoard`, permission checks) that is only partially covered. Only a few edge cases have dedicated tests (e.g., `companies-route-path-guard.test.ts`, `github-routes-company-scoping.test.ts`).
- Files: `server/src/routes/agents.ts`, `server/src/routes/issues.ts`, `server/src/routes/access.ts`
- Risk: Authorization bypass in new or modified endpoints.
- Priority: High

**Config loading:**
- What's not tested: `server/src/config.ts` has no test file. The complex env var fallback chains and config file merging logic are untested.
- Files: `server/src/config.ts`, `server/src/config-file.ts`
- Risk: Unexpected config resolution in deployment environments.
- Priority: Medium

**All UI components:**
- What's not tested: The entire React frontend (pages, components, hooks, context providers) has zero test coverage.
- Files: `ui/src/pages/*.tsx`, `ui/src/components/*.tsx`, `ui/src/context/*.tsx`, `ui/src/hooks/*.ts`
- Risk: Any UI change or refactor could introduce visual or behavioral regressions unnoticed.
- Priority: Medium

**WebSocket live events:**
- What's not tested: `server/src/realtime/live-events-ws.ts` has no tests. The upgrade authorization, ping/pong lifecycle, and subscription management are untested.
- Files: `server/src/realtime/live-events-ws.ts`, `server/src/services/live-events.ts`
- Risk: WebSocket auth bypass or connection leak bugs.
- Priority: Medium

---

*Concerns audit: 2026-03-08*
