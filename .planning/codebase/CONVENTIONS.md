# Coding Conventions

**Analysis Date:** 2026-03-08

## Naming Patterns

**Files:**
- Use `kebab-case` for all TypeScript/TSX files: `error-handler.ts`, `board-mutation-guard.ts`, `live-events.ts`
- DB schema files use `snake_case`: `agent_api_keys.ts`, `heartbeat_runs.ts`, `issue_comments.ts`
- React components use `PascalCase`: `AgentConfigForm.tsx`, `KanbanBoard.tsx`, `StatusBadge.tsx`
- Test files use `kebab-case.test.ts` pattern: `agent-auth-jwt.test.ts`, `hire-hook.test.ts`
- Barrel files are always `index.ts`

**Functions:**
- Use `camelCase` for all functions: `loadConfig()`, `agentService()`, `buildPaperclipEnv()`
- Route factory functions return a Router and are named `{entity}Routes`: `agentRoutes(db)`, `healthRoutes()`, `issueRoutes(db)`
- Service factory functions are named `{entity}Service`: `agentService(db)`, `heartbeatService(db)`
- Boolean helpers use `is`/`has`/`can` prefixes: `isUuidLike()`, `canCreateAgents()`, `isLoopbackHost()`
- Assertion helpers use `assert` prefix: `assertBoard()`, `assertCompanyAccess()`

**Variables:**
- Use `camelCase` for local variables and parameters
- Use `SCREAMING_SNAKE_CASE` for module-level constants: `LOCAL_BOARD_USER_ID`, `CONFIG_REVISION_FIELDS`, `REDACTED_EVENT_VALUE`
- Environment variable names use `SCREAMING_SNAKE_CASE` with `PAPERCLIP_` prefix: `PAPERCLIP_API_URL`, `PAPERCLIP_SECRETS_PROVIDER`

**Types:**
- Use `PascalCase` for types and interfaces: `Config`, `HttpError`, `AgentStatus`, `DeploymentMode`
- Zod schemas use `camelCase` with `Schema` suffix: `createAgentSchema`, `updateIssueSchema`, `envConfigSchema`
- Inferred types from Zod schemas use `PascalCase` matching schema name: `type CreateAgent = z.infer<typeof createAgentSchema>`
- Union literal types are derived from `as const` arrays: `AGENT_STATUSES = [...] as const; type AgentStatus = (typeof AGENT_STATUSES)[number]`

## Code Style

**Formatting:**
- No project-level Prettier or ESLint configuration; formatting is enforced by TypeScript compiler strictness
- Double quotes for strings in all packages
- Semicolons required at end of statements
- 2-space indentation throughout
- Trailing commas used in multi-line arrays and objects

**Linting:**
- No ESLint config at project root; relies on TypeScript `strict: true` in `tsconfig.json`
- `forceConsistentCasingInFileNames: true` enforced
- `isolatedModules: true` enforced

**TypeScript Configuration:**
- Target: `ES2023`
- Module: `NodeNext` with `NodeNext` resolution
- Strict mode enabled project-wide
- `skipLibCheck: true` used for faster builds
- All packages share the root `tsconfig.json` settings

## Import Organization

**Order:**
1. Node.js built-ins with `node:` prefix: `import { existsSync } from "node:fs"`
2. Third-party packages: `import express from "express"`, `import { eq } from "drizzle-orm"`
3. Workspace packages with `@paperclipai/` scope: `import { agents } from "@paperclipai/db"`, `import { createAgentSchema } from "@paperclipai/shared"`
4. Local project imports with relative paths and `.js` extension: `import { loadConfig } from "./config.js"`

**Path Aliases:**
- UI package uses `@/` alias mapped to `./src/`: `import { cn } from "@/lib/utils"`, `import { Button } from "@/components/ui/button"`
- Server and CLI use relative imports only -- no path aliases
- All local imports use `.js` extension (NodeNext module resolution): `import { errorHandler } from "../middleware/error-handler.js"`

**Workspace Packages:**
- `@paperclipai/shared` - constants, types, Zod validators, API route definitions
- `@paperclipai/db` - Drizzle schema, migrations, database client
- `@paperclipai/adapter-utils` - adapter interface types
- `@paperclipai/adapter-{name}` - individual adapter implementations (claude-local, codex-local, cursor-local, opencode-local, pi-local, openclaw-gateway)
- `@paperclipai/server` - Express server
- `@paperclipai/ui` - React frontend
- `paperclipai` - CLI package

## Error Handling

**Server-side HTTP Errors:**
- Use `HttpError` class from `server/src/errors.ts` for all HTTP error responses
- Use factory functions for common HTTP errors: `badRequest()`, `unauthorized()`, `forbidden()`, `notFound()`, `conflict()`, `unprocessable()`
- Throw `HttpError` instances from route handlers and services -- the centralized `errorHandler` middleware catches them
- Pattern: `throw notFound("Agent not found")` or `throw forbidden("Missing permission: agents:create")`

```typescript
// server/src/errors.ts pattern
export function notFound(message = "Not found") {
  return new HttpError(404, message);
}

// Usage in routes/services:
const agent = await svc.getById(agentId);
if (!agent) throw notFound("Agent not found");
```

**Error Handler Middleware:**
- Located at `server/src/middleware/error-handler.ts`
- Handles `HttpError`, `ZodError`, and generic errors
- Attaches error context to `res.__errorContext` for pino-http logging
- `ZodError` instances automatically return 400 with validation details
- Unknown errors return generic 500 with no internal details exposed

**Client-side API Errors (UI):**
- `ApiError` class in `ui/src/api/client.ts` wraps fetch failures
- Pattern: `throw new ApiError(message, status, body)`
- Consumed via try/catch in React Query hooks

**CLI Errors:**
- `ApiRequestError` class in `cli/src/client/http.ts` for API call failures
- Contains `status`, `message`, and `details` fields

## Logging

**Framework:** pino + pino-http + pino-pretty

**Setup:** `server/src/middleware/logger.ts`
- Two transport targets: pretty-printed to stdout (info level), pretty-printed to file (debug level)
- Log file written to configurable directory (defaults to `~/.paperclip/logs/server.log`)
- HTTP request logging via `pino-http` with custom log levels based on status codes

**Patterns:**
- Use structured logging with context objects as the first argument:
```typescript
logger.info({ pendingMigrations: state.pendingMigrations }, "Applying migrations");
logger.error({ err, backupDir }, "Database backup failed");
logger.warn({ signal }, "Stopping embedded PostgreSQL");
```
- Always include the `err` key for error objects
- Error context is attached to responses via `res.__errorContext` for automatic logging by pino-http
- HTTP logger customizes log levels: 500+ = error, 400+ = warn, rest = info

## Comments

**When to Comment:**
- Use comments to explain business logic rationale: `// Reap orphaned runs at startup, resume queued ones, then start the periodic timer.`
- Use comments to explain non-obvious behavior: `// GitHub webhook needs raw body for HMAC verification -- mount before json parser`
- No mandatory JSDoc on functions -- rely on TypeScript types

**JSDoc/TSDoc:**
- Rarely used; appear occasionally for utility functions in `ui/src/lib/utils.ts`: `/** Build an issue URL using the human-readable identifier when available. */`
- Not a project-wide requirement

## Function Design

**Size:** Functions tend to be moderate in size. Route handler closures can be long (50-100+ lines) but are organized within `Router` factories.

**Parameters:**
- Service factory functions accept `db: Db` as their only parameter and return an object of methods
- Route factory functions accept `db: Db` and return an Express `Router`
- Configuration options use object parameters with typed interfaces
- Use optional parameters with defaults rather than overloads

**Return Values:**
- Services return plain objects or arrays (never raw Drizzle results exposed directly)
- Route handlers use `res.json()` for success, `throw HttpError` for errors
- Async functions that might not find an entity return `null` (not `undefined`)

## Module Design

**Exports:**
- Each package has an `index.ts` barrel file exporting the public API
- Adapters expose sub-paths: `@paperclipai/adapter-claude-local/server`, `@paperclipai/adapter-claude-local/ui`, `@paperclipai/adapter-claude-local/cli`
- Server routes and services each have barrel files: `server/src/routes/index.ts`, `server/src/services/index.ts`
- Named exports are used exclusively; no default exports except Vite/Vitest config files

**Barrel Files:**
- `server/src/routes/index.ts` re-exports all route factories
- `server/src/services/index.ts` re-exports all service factories
- `packages/shared/src/index.ts` re-exports constants, types, and validators
- Pattern: `export { agentRoutes } from "./agents.js";`

## Validation

**Framework:** Zod

**Pattern:**
- Schemas defined in `packages/shared/src/validators/` for reuse between server and CLI
- Route validation uses middleware: `validate(createAgentSchema)` from `server/src/middleware/validate.ts`
- Middleware calls `schema.parse(req.body)` and lets `ZodError` propagate to error handler
- Constants defined as `as const` tuples in `packages/shared/src/constants.ts`, used in Zod schemas via `z.enum()`

```typescript
// packages/shared/src/validators/agent.ts
export const createAgentSchema = z.object({
  name: z.string().min(1),
  role: z.enum(AGENT_ROLES).optional().default("general"),
  adapterType: z.enum(AGENT_ADAPTER_TYPES).optional().default("process"),
  adapterConfig: adapterConfigSchema.optional().default({}),
});

// server/src/routes/agents.ts usage
router.post("/", validate(createAgentSchema), async (req, res) => { ... });
```

## Authentication & Authorization

**Actor Model:**
- Every request has `req.actor` populated by `actorMiddleware` in `server/src/middleware/auth.ts`
- Actor types: `"board"` (human user), `"agent"` (API key or JWT), `"none"` (unauthenticated)
- Type declaration in `server/src/types/express.d.ts` extends Express `Request`

**Authorization Functions:**
- `assertBoard(req)` - throws 403 if not a board user
- `assertCompanyAccess(req, companyId)` - verifies the actor can access a specific company
- `getActorInfo(req)` - extracts actor identity for activity logging
- All located in `server/src/routes/authz.ts`

## Configuration

**Pattern:** Environment variables take priority over config file values

```typescript
// server/src/config.ts pattern
const secretsProvider: SecretProvider = providerFromEnv ?? providerFromFile ?? "local_encrypted";
```

- Config loaded via `loadConfig()` in `server/src/config.ts`
- Config file schema validated with Zod in `packages/shared/src/config-schema.ts`
- Boolean env vars compared as string: `process.env.SERVE_UI === "true"`

## UI Patterns

**Component Library:** Radix UI primitives + shadcn/ui pattern in `ui/src/components/ui/`
- Uses `class-variance-authority` for component variants
- `cn()` utility from `ui/src/lib/utils.ts` combines clsx + tailwind-merge

**Data Fetching:** TanStack React Query
- Query keys centralized in `ui/src/lib/queryKeys.ts`
- API calls in `ui/src/api/*.ts` using a thin fetch wrapper (`ui/src/api/client.ts`)
- Pattern: `useQuery({ queryKey: queryKeys.agents.list(companyId), queryFn: () => agentsApi.list(companyId) })`

**State Management:**
- React Context for global state (company selection via `ui/src/context/CompanyContext.tsx`)
- React Query for server state
- No Redux or other state management libraries

**Routing:** react-router-dom v7
- Page components in `ui/src/pages/` with PascalCase names: `AgentDetail.tsx`, `Issues.tsx`

---

*Convention analysis: 2026-03-08*
