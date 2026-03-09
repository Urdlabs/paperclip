# Architecture

**Analysis Date:** 2026-03-08

## Pattern Overview

**Overall:** Monorepo with layered monolith server (Express), React SPA client, CLI tool, and a plugin-style adapter system for AI agent backends.

**Key Characteristics:**
- pnpm workspace monorepo with 6 workspace groups: `server`, `ui`, `cli`, `packages/*`, `packages/adapters/*`
- Server is an Express 5 monolith that embeds the UI (static or Vite dev middleware) and exposes a REST API + WebSocket realtime layer
- Adapter pattern decouples agent execution backends (Claude, Codex, Cursor, OpenCode, Pi, OpenClaw) from the core orchestration logic
- Shared package (`@paperclipai/shared`) provides types, constants, and Zod validators consumed by all workspace packages
- Database package (`@paperclipai/db`) owns schema, migrations, and the Drizzle ORM client
- Two deployment modes: `local_trusted` (single-user, no auth) and `authenticated` (multi-user with BetterAuth)

## Layers

**Database Layer (`packages/db`):**
- Purpose: Schema definition, migrations, and database client creation
- Location: `packages/db/src/`
- Contains: Drizzle ORM schema files (`packages/db/src/schema/`), migration SQL (`packages/db/src/migrations/`), client factory (`packages/db/src/client.ts`), backup utilities (`packages/db/src/backup-lib.ts`)
- Depends on: `@paperclipai/shared` (for enum types), `drizzle-orm`, `postgres` (driver)
- Used by: `server`, `cli`

**Shared Types & Validation Layer (`packages/shared`):**
- Purpose: Single source of truth for domain types, constants, and Zod schemas
- Location: `packages/shared/src/`
- Contains: Domain constants (`packages/shared/src/constants.ts`), type definitions (`packages/shared/src/types/`), Zod validators (`packages/shared/src/validators/`), config schema (`packages/shared/src/config-schema.ts`)
- Depends on: Nothing (leaf package)
- Used by: Every other package in the monorepo

**Adapter Utils Layer (`packages/adapter-utils`):**
- Purpose: Shared adapter interfaces and process-spawning utilities
- Location: `packages/adapter-utils/src/`
- Contains: `ServerAdapterModule` interface, `AdapterExecutionContext`, `AdapterExecutionResult`, process spawn helpers (`packages/adapter-utils/src/server-utils.ts`), UI transcript types, CLI adapter types
- Depends on: Nothing
- Used by: All adapter packages, server, UI, CLI

**Adapter Packages (`packages/adapters/*`):**
- Purpose: Each adapter implements a specific AI agent backend (Claude Code, Codex, Cursor, OpenCode, Pi, OpenClaw Gateway)
- Location: `packages/adapters/{name}/src/`
- Contains: Three sub-modules per adapter with conditional exports:
  - `./server` (`src/server/`) -- `execute()`, `testEnvironment()`, `sessionCodec`
  - `./ui` (`src/ui/`) -- stdout line parser for live transcript rendering
  - `./cli` (`src/cli/`) -- CLI log formatting
  - `.` (`src/index.ts`) -- shared metadata (models, agentConfigurationDoc)
- Depends on: `@paperclipai/adapter-utils`
- Used by: Server adapter registry, UI adapter registry, CLI adapter registry

**Server Layer:**
- Purpose: REST API, WebSocket realtime, heartbeat scheduler, auth, storage, secrets management
- Location: `server/src/`
- Contains: Express app (`server/src/app.ts`), entrypoint/bootstrap (`server/src/index.ts`), routes (`server/src/routes/`), services (`server/src/services/`), middleware (`server/src/middleware/`), adapter registry (`server/src/adapters/`), realtime (`server/src/realtime/`), storage providers (`server/src/storage/`), secrets providers (`server/src/secrets/`)
- Depends on: `@paperclipai/db`, `@paperclipai/shared`, `@paperclipai/adapter-utils`, all adapter packages
- Used by: `cli` (imports server for `run` command)

**UI Layer:**
- Purpose: React SPA dashboard for managing companies, agents, issues, projects, approvals, costs
- Location: `ui/src/`
- Contains: Pages (`ui/src/pages/`), components (`ui/src/components/`), API client (`ui/src/api/`), context providers (`ui/src/context/`), hooks (`ui/src/hooks/`), adapter UI modules (`ui/src/adapters/`)
- Depends on: `@paperclipai/shared`, `@paperclipai/adapter-utils`, adapter packages (UI exports only)
- Used by: Served by the server (static build or Vite dev middleware)

**CLI Layer:**
- Purpose: Setup wizard, diagnostics, configuration, heartbeat invocation, API client commands
- Location: `cli/src/`
- Contains: Commander-based commands (`cli/src/commands/`), config helpers (`cli/src/config/`), CLI prompts (`cli/src/prompts/`), checks (`cli/src/checks/`), API client (`cli/src/client/`)
- Depends on: `@paperclipai/server`, `@paperclipai/db`, `@paperclipai/shared`, all adapter packages
- Used by: End users via `paperclipai` CLI binary

## Data Flow

**Agent Heartbeat Execution (core orchestration loop):**

1. Heartbeat scheduler timer fires in `server/src/index.ts` (every 30s by default)
2. `heartbeatService(db).tickTimers()` in `server/src/services/heartbeat.ts` finds agents with active heartbeat timers whose interval has elapsed
3. For each eligible agent, a heartbeat run is created in the `heartbeat_runs` table with status `queued`
4. `startRun()` in `server/src/services/heartbeat.ts` picks up queued runs, loads agent config + runtime state + task session
5. The adapter is resolved via `getServerAdapter(adapterType)` from `server/src/adapters/registry.ts`
6. Adapter's `execute()` is called with an `AdapterExecutionContext` containing the agent, runtime state, prompt, and log callbacks
7. Adapter spawns the AI tool process (e.g., `claude` CLI), streams stdout/stderr through `onLog` callbacks
8. Log chunks are stored in the run log file via `RunLogStore` and broadcast as `LiveEvent`s to WebSocket clients
9. On completion, the `AdapterExecutionResult` is processed: session state updated, cost events recorded, usage tracked, run status set to `completed`/`error`
10. Live events notify the UI in real-time via the WebSocket connection at `/api/companies/:companyId/events/ws`

**HTTP Request Flow (API):**

1. Express receives request at `server/src/app.ts`
2. JSON body parser, HTTP logger middleware
3. `privateHostnameGuard` middleware validates Host header (authenticated+private mode)
4. `actorMiddleware` (`server/src/middleware/auth.ts`) resolves the actor: `local_implicit` board user, BetterAuth session user, agent API key, or agent JWT
5. `boardMutationGuard` middleware blocks non-board actors from certain mutations
6. Route handler in `server/src/routes/*.ts` validates input with Zod via `validate()` middleware
7. Route handler calls service functions from `server/src/services/*.ts`
8. Services use Drizzle ORM to query/mutate PostgreSQL
9. Services may publish `LiveEvent`s for real-time UI updates
10. Error handler middleware (`server/src/middleware/error-handler.ts`) catches `HttpError`, `ZodError`, or generic errors

**UI Data Flow:**

1. React app bootstraps in `ui/src/main.tsx` with nested providers: `QueryClientProvider` > `ThemeProvider` > `CompanyProvider` > `ToastProvider` > `LiveUpdatesProvider` > `BrowserRouter` > component tree
2. Pages in `ui/src/pages/` use `@tanstack/react-query` hooks to fetch data from `ui/src/api/*.ts` modules
3. API modules use the thin `fetch` wrapper in `ui/src/api/client.ts` (base path `/api`)
4. `LiveUpdatesProvider` (`ui/src/context/LiveUpdatesProvider.tsx`) opens a WebSocket to `/api/companies/:companyId/events/ws` and invalidates React Query caches on relevant events, plus shows toast notifications
5. Company-scoped routing uses a `:companyPrefix` URL parameter, resolved via `CompanyContext`

**State Management:**
- Server: Stateless request handling; all persistent state in PostgreSQL. In-memory: adapter process tracking (`runningProcesses` Map), live event pub/sub (in-process `EventEmitter`-style), heartbeat active run set
- UI: React Query for server state caching (30s stale time). React Context for cross-cutting concerns (company selection, theme, sidebar, panel, dialog, breadcrumbs, toast, live updates)

## Key Abstractions

**ServerAdapterModule:**
- Purpose: Plugin interface for AI agent execution backends
- Definition: `packages/adapter-utils/src/types.ts`
- Registry: `server/src/adapters/registry.ts`
- Pattern: Strategy pattern. Each adapter implements `execute()`, `testEnvironment()`, optional `sessionCodec`, `listModels()`, `onHireApproved()`
- Implementations: `claude_local`, `codex_local`, `cursor`, `opencode_local`, `pi_local`, `openclaw_gateway`, `process` (generic), `http` (webhook)

**UIAdapterModule:**
- Purpose: Client-side adapter for parsing agent stdout into transcript entries for live run display
- Definition: `ui/src/adapters/types.ts`
- Registry: `ui/src/adapters/registry.ts`
- Pattern: Mirrors server adapter types on the UI side; each adapter provides a `StdoutLineParser`

**Service Functions:**
- Purpose: Business logic layer between routes and database
- Location: `server/src/services/*.ts`
- Pattern: Factory function that takes `db: Db` and returns an object with methods. Example: `agentService(db)` returns `{ list, get, create, update, ... }`
- All services exported through barrel file `server/src/services/index.ts`

**Actor Model (Request Authentication):**
- Purpose: Unified identity representation across deployment modes
- Definition: `server/src/types/express.d.ts` (Express Request augmentation)
- Types: `board` (human operator, local implicit or session-based), `agent` (API key or JWT authenticated), `none` (unauthenticated)
- Middleware: `server/src/middleware/auth.ts` resolves actor on every request

**StorageProvider / StorageService:**
- Purpose: Pluggable file storage abstraction (local disk, S3)
- Definition: `server/src/storage/types.ts`
- Implementations: `server/src/storage/local-disk-provider.ts`, `server/src/storage/s3-provider.ts`
- Pattern: Provider interface with `putObject/getObject/headObject/deleteObject`; `StorageService` wraps with company-scoped key namespacing

**SecretProviderModule:**
- Purpose: Pluggable secret encryption/storage
- Definition: `server/src/secrets/types.ts`
- Implementations: `server/src/secrets/local-encrypted-provider.ts`, `server/src/secrets/external-stub-providers.ts`
- Pattern: Provider creates/resolves encrypted secret versions with material blobs

## Entry Points

**Server (`server/src/index.ts`):**
- Location: `server/src/index.ts`
- Triggers: `pnpm dev:server`, `pnpm dev`, `node dist/index.js`, Docker container
- Responsibilities: Load config, initialize database (external or embedded Postgres), run migrations, set up auth, create Express app, start HTTP server, set up WebSocket server, start heartbeat scheduler, start backup scheduler

**UI (`ui/src/main.tsx`):**
- Location: `ui/src/main.tsx`
- Triggers: Browser loads `index.html`; served by server (static or Vite dev)
- Responsibilities: Mount React app with all context providers, register service worker

**CLI (`cli/src/index.ts`):**
- Location: `cli/src/index.ts`
- Triggers: `pnpm paperclipai <command>` or installed `paperclipai` binary
- Responsibilities: Parse CLI args via Commander, dispatch to command handlers (onboard, doctor, configure, run, heartbeat, auth, API client commands)

**Dev Runner (`scripts/dev-runner.mjs`):**
- Location: `scripts/dev-runner.mjs`
- Triggers: `pnpm dev`, `pnpm dev:watch`, `pnpm dev:once`
- Responsibilities: Builds all packages, then starts server with `tsx watch` (hot-reload) and Vite dev middleware for UI

## Error Handling

**Strategy:** Typed HTTP errors with centralized Express error handler middleware

**Patterns:**
- Domain errors throw `HttpError` subclass via factory functions in `server/src/errors.ts`: `badRequest()`, `unauthorized()`, `forbidden()`, `notFound()`, `conflict()`, `unprocessable()`
- Zod validation errors from `validate()` middleware are caught by the error handler and return 400 with details
- Error handler in `server/src/middleware/error-handler.ts` catches all thrown errors, maps to JSON response, attaches context for logging
- UI API client (`ui/src/api/client.ts`) throws `ApiError` with status code and parsed body for non-OK responses
- Adapter execution errors are captured in `AdapterExecutionResult.errorMessage` / `errorCode` and stored in heartbeat run events

## Cross-Cutting Concerns

**Logging:**
- Server uses Pino logger (`server/src/middleware/logger.ts`) with `pino-http` for request logging and `pino-pretty` for dev formatting
- Structured JSON logging with request context

**Validation:**
- Zod schemas defined in `packages/shared/src/validators/` for all API inputs
- Applied via `validate()` middleware in route handlers (`server/src/middleware/validate.ts`)
- Schemas are shared between server validation and UI form validation

**Authentication:**
- Two modes: `local_trusted` (implicit board user, no auth) and `authenticated` (BetterAuth with email/password, session cookies)
- Agent authentication: Bearer token (API key hash lookup) or locally-signed JWT (`server/src/agent-auth-jwt.ts`)
- Actor middleware resolves identity before route handlers run

**Authorization:**
- Route-level: `assertBoard()` and `assertCompanyAccess()` in `server/src/routes/authz.ts`
- Board mutation guard middleware blocks agent actors from certain write operations
- Company membership scoping: authenticated users see only companies they belong to (or all if instance admin)
- Agent permission grants stored in `principal_permission_grants` table

**Realtime:**
- WebSocket server at `/api/companies/:companyId/events/ws` in `server/src/realtime/live-events-ws.ts`
- In-process pub/sub via `publishLiveEvent()` / `subscribeCompanyLiveEvents()` in `server/src/services/live-events.ts`
- UI `LiveUpdatesProvider` invalidates React Query caches and shows toasts on events

---

*Architecture analysis: 2026-03-08*
