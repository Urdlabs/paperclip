# Codebase Structure

**Analysis Date:** 2026-03-08

## Directory Layout

```
paperclip/
├── cli/                        # CLI tool (paperclipai binary)
│   └── src/
│       ├── __tests__/          # CLI tests
│       ├── adapters/           # CLI-side adapter log formatters
│       ├── checks/             # Diagnostic check modules (doctor command)
│       ├── client/             # API client for remote commands
│       ├── commands/           # Commander command handlers
│       │   └── client/         # API client subcommands (company, issue, agent, etc.)
│       ├── config/             # Config file/data-dir resolution
│       ├── prompts/            # Interactive CLI prompts (@clack/prompts)
│       └── utils/              # CLI utilities
├── docker/                     # Docker-related files
│   └── openclaw-smoke/         # OpenClaw smoke test Docker setup
├── doc/                        # Internal documentation
│   ├── assets/                 # Logos, avatars
│   ├── plans/                  # Planning documents
│   ├── plugins/                # Plugin documentation
│   └── spec/                   # Specifications
├── docs/                       # Public documentation (Mintlify)
│   ├── adapters/               # Adapter docs
│   ├── api/                    # API reference docs
│   ├── cli/                    # CLI reference docs
│   ├── deploy/                 # Deployment guides
│   ├── guides/                 # User guides
│   │   ├── agent-developer/    # Agent developer guide
│   │   └── board-operator/     # Board operator guide
│   ├── specs/                  # Public specs
│   └── start/                  # Getting started
├── packages/                   # Shared workspace packages
│   ├── adapter-utils/          # Shared adapter types and process utilities
│   │   └── src/
│   │       ├── index.ts        # Barrel exports
│   │       ├── types.ts        # All adapter interfaces (ServerAdapterModule, etc.)
│   │       └── server-utils.ts # Process spawn helpers, parsing utilities
│   ├── adapters/               # AI agent backend adapter packages
│   │   ├── claude-local/       # Claude Code CLI adapter
│   │   │   └── src/
│   │   │       ├── index.ts    # Shared metadata (models, configDoc)
│   │   │       ├── server/     # execute(), testEnvironment(), sessionCodec
│   │   │       ├── ui/         # Stdout line parser for transcript
│   │   │       └── cli/        # CLI log formatter
│   │   ├── codex-local/        # OpenAI Codex CLI adapter
│   │   ├── cursor-local/       # Cursor editor adapter
│   │   ├── openclaw-gateway/   # OpenClaw cloud gateway adapter
│   │   ├── opencode-local/     # OpenCode CLI adapter
│   │   └── pi-local/           # Pi (Anthropic) adapter
│   ├── db/                     # Database package (Drizzle ORM)
│   │   └── src/
│   │       ├── index.ts        # Public API barrel
│   │       ├── client.ts       # createDb(), migration helpers
│   │       ├── schema/         # Drizzle table definitions (36 tables)
│   │       ├── migrations/     # SQL migration files + meta journal
│   │       ├── backup-lib.ts   # Database backup utilities
│   │       ├── backup.ts       # CLI backup entry point
│   │       ├── migrate.ts      # CLI migration entry point
│   │       └── seed.ts         # Database seeding
│   └── shared/                 # Shared types, constants, validators
│       └── src/
│           ├── index.ts        # Barrel exports (everything)
│           ├── constants.ts    # Enum arrays and literal types
│           ├── config-schema.ts # Zod schema for paperclip.yaml config
│           ├── api.ts          # API route prefix constant
│           ├── types/          # Domain type interfaces (18 files)
│           └── validators/     # Zod input schemas (13 files)
├── releases/                   # Release artifacts/changelogs
├── scripts/                    # Build, release, and dev scripts
│   ├── dev-runner.mjs          # Monorepo dev launcher
│   ├── build-npm.sh            # NPM package build script
│   ├── release.sh              # Release automation
│   ├── backup-db.sh            # Database backup shell script
│   ├── check-forbidden-tokens.mjs # CI token leak checker
│   ├── generate-npm-package-json.mjs # NPM publish package.json generator
│   ├── migrate-inline-env-secrets.ts # Secret migration utility
│   └── smoke/                  # Smoke test scripts
├── server/                     # Express server package
│   └── src/
│       ├── index.ts            # Server entrypoint (bootstrap, startup)
│       ├── app.ts              # Express app factory (createApp)
│       ├── config.ts           # Config loading (env + file)
│       ├── errors.ts           # HttpError class + factory functions
│       ├── adapters/           # Server-side adapter registry
│       │   ├── registry.ts     # Adapter type -> module map
│       │   ├── types.ts        # Re-exports from adapter-utils
│       │   ├── index.ts        # Public API barrel
│       │   ├── http/           # Generic HTTP webhook adapter
│       │   ├── process/        # Generic process spawn adapter
│       │   ├── codex-models.ts # Codex model discovery
│       │   ├── cursor-models.ts # Cursor model discovery
│       │   └── utils.ts        # Process tracking utilities
│       ├── auth/               # Authentication
│       │   └── better-auth.ts  # BetterAuth integration
│       ├── middleware/          # Express middleware
│       │   ├── auth.ts         # Actor resolution middleware
│       │   ├── board-mutation-guard.ts # Write-protect for non-board actors
│       │   ├── private-hostname-guard.ts # Host header validation
│       │   ├── error-handler.ts # Global error handler
│       │   ├── logger.ts       # Pino logger + HTTP logger
│       │   ├── validate.ts     # Zod body validation middleware
│       │   └── index.ts        # Barrel
│       ├── routes/             # Express route handlers (19 files)
│       │   ├── access.ts       # Company membership, invites, join requests, permissions
│       │   ├── agents.ts       # Agent CRUD, wake, test environment, keys
│       │   ├── issues.ts       # Issue CRUD, checkout, comments, attachments
│       │   ├── projects.ts     # Project CRUD, workspaces
│       │   ├── companies.ts    # Company CRUD
│       │   ├── approvals.ts    # Approval CRUD, resolve, resubmit
│       │   ├── goals.ts        # Goal CRUD
│       │   ├── secrets.ts      # Secret CRUD
│       │   ├── costs.ts        # Cost tracking
│       │   ├── activity.ts     # Activity feed
│       │   ├── dashboard.ts    # Dashboard summary
│       │   ├── sidebar-badges.ts # Sidebar badge counts
│       │   ├── health.ts       # Health check endpoint
│       │   ├── assets.ts       # File upload/download
│       │   ├── github.ts       # GitHub App/webhook routes
│       │   ├── llms.ts         # LLM-facing endpoints (llms.txt)
│       │   ├── authz.ts        # Auth assertion helpers
│       │   └── index.ts        # Barrel
│       ├── services/           # Business logic (23 files)
│       │   ├── heartbeat.ts    # Core: agent heartbeat execution engine (~83KB)
│       │   ├── issues.ts       # Issue management
│       │   ├── agents.ts       # Agent management
│       │   ├── companies.ts    # Company management
│       │   ├── projects.ts     # Project management
│       │   ├── company-portability.ts # Company export/import
│       │   ├── github-app.ts   # GitHub App integration
│       │   ├── secrets.ts      # Secret management
│       │   ├── costs.ts        # Cost tracking
│       │   ├── approvals.ts    # Approval workflows
│       │   ├── issue-approvals.ts # Issue-approval linking
│       │   ├── access.ts       # Membership/permissions logic
│       │   ├── activity.ts     # Activity feed queries
│       │   ├── activity-log.ts # Activity logging helper
│       │   ├── dashboard.ts    # Dashboard aggregations
│       │   ├── sidebar-badges.ts # Badge count queries
│       │   ├── goals.ts        # Goal management
│       │   ├── assets.ts       # Asset management
│       │   ├── live-events.ts  # In-process pub/sub for realtime
│       │   ├── run-log-store.ts # Run log file management
│       │   ├── hire-hook.ts    # Post-hire notification hook
│       │   ├── agent-permissions.ts # Permission evaluation
│       │   └── index.ts        # Barrel exports
│       ├── realtime/           # WebSocket server
│       │   └── live-events-ws.ts # WS server for live company events
│       ├── storage/            # File storage abstraction
│       │   ├── types.ts        # StorageProvider, StorageService interfaces
│       │   ├── index.ts        # Factory + singleton access
│       │   ├── service.ts      # StorageService implementation
│       │   ├── provider-registry.ts # Provider factory
│       │   ├── local-disk-provider.ts # Local filesystem provider
│       │   └── s3-provider.ts  # AWS S3 provider
│       ├── secrets/            # Secret encryption providers
│       │   ├── types.ts        # SecretProviderModule interface
│       │   ├── provider-registry.ts # Provider factory
│       │   ├── local-encrypted-provider.ts # AES encryption provider
│       │   └── external-stub-providers.ts # Placeholder for external KMS
│       ├── types/              # TypeScript declaration augmentation
│       │   └── express.d.ts    # Express Request.actor augmentation
│       ├── __tests__/          # Server tests
│       ├── agent-auth-jwt.ts   # Local agent JWT signing/verification
│       ├── board-claim.ts      # Board claim challenge (mode migration)
│       ├── config-file.ts      # YAML config file reader
│       ├── home-paths.ts       # Platform-aware default paths (~/.paperclip/)
│       ├── paths.ts            # Env file path resolution
│       ├── redaction.ts        # Sensitive field redaction for logs
│       └── startup-banner.ts   # ASCII art startup banner
├── skills/                     # Claude skills (prompt/instruction files)
│   ├── agent-browser/          # Browser skill for agents
│   ├── create-agent-adapter/   # Skill for creating new adapters
│   ├── paperclip/              # Core paperclip skill
│   ├── paperclip-create-agent/ # Agent creation skill
│   ├── para-memory-files/      # PARA memory system skill
│   ├── release/                # Release process skill
│   └── release-changelog/      # Changelog generation skill
├── ui/                         # React SPA (Vite)
│   ├── public/                 # Static assets
│   │   └── brands/             # Brand icons
│   └── src/
│       ├── main.tsx            # App bootstrap, provider tree
│       ├── App.tsx             # Root router component
│       ├── index.css           # Global CSS (Tailwind v4)
│       ├── adapters/           # UI-side adapter modules
│       │   ├── registry.ts     # Adapter type -> UIAdapterModule map
│       │   ├── types.ts        # UIAdapterModule interface
│       │   ├── transcript.ts   # Transcript parsing utilities
│       │   ├── claude-local/   # Claude transcript parser
│       │   ├── codex-local/    # Codex transcript parser
│       │   ├── cursor/         # Cursor transcript parser
│       │   ├── openclaw-gateway/ # OpenClaw transcript parser
│       │   ├── opencode-local/ # OpenCode transcript parser
│       │   ├── pi-local/       # Pi transcript parser
│       │   ├── process/        # Generic process transcript parser
│       │   └── http/           # HTTP adapter transcript parser
│       ├── api/                # API client modules (17 files)
│       │   ├── client.ts       # Base fetch wrapper
│       │   ├── agents.ts       # Agent API calls
│       │   ├── issues.ts       # Issue API calls
│       │   └── ...             # One file per domain
│       ├── components/         # React components (~56 files)
│       │   ├── ui/             # Primitive UI components (shadcn/radix based, 21 files)
│       │   ├── Layout.tsx      # App shell (sidebar + content)
│       │   ├── AgentConfigForm.tsx # Agent configuration form (~57KB)
│       │   ├── IssuesList.tsx  # Issue list with kanban/table views
│       │   ├── LiveRunWidget.tsx # Live agent run transcript viewer
│       │   ├── MarkdownEditor.tsx # MDX editor component
│       │   ├── CommandPalette.tsx # Keyboard-driven command palette
│       │   └── ...             # Feature-specific components
│       ├── context/            # React context providers (8 files)
│       │   ├── CompanyContext.tsx # Company selection state
│       │   ├── LiveUpdatesProvider.tsx # WebSocket connection + cache invalidation
│       │   ├── DialogContext.tsx # Dialog/modal state
│       │   ├── ThemeContext.tsx # Dark/light theme
│       │   ├── ToastContext.tsx # Toast notifications
│       │   ├── SidebarContext.tsx # Sidebar collapse state
│       │   ├── PanelContext.tsx # Side panel state
│       │   └── BreadcrumbContext.tsx # Breadcrumb trail
│       ├── hooks/              # Custom React hooks (3 files)
│       │   ├── useCompanyPageMemory.ts # Remember last page per company
│       │   ├── useKeyboardShortcuts.ts # Global keyboard shortcuts
│       │   └── useProjectOrder.ts # Drag-and-drop project ordering
│       ├── lib/                # Shared utilities (10 files)
│       │   ├── queryKeys.ts    # React Query key factory
│       │   ├── router.tsx      # React Router wrapper/re-exports
│       │   ├── utils.ts        # cn() helper and general utilities
│       │   ├── company-routes.ts # Company-prefixed route helpers
│       │   ├── status-colors.ts # Status -> color mapping
│       │   └── ...             # Other utils
│       └── pages/              # Page-level components (25 files)
│           ├── Dashboard.tsx   # Company dashboard
│           ├── AgentDetail.tsx # Agent detail view (~104KB, largest file)
│           ├── Agents.tsx      # Agent list
│           ├── IssueDetail.tsx # Issue detail view
│           ├── Issues.tsx      # Issue list
│           ├── ProjectDetail.tsx # Project detail
│           ├── CompanySettings.tsx # Company settings
│           ├── Auth.tsx        # Login/signup page
│           ├── InviteLanding.tsx # Invite acceptance page
│           └── ...             # Other pages
├── .changeset/                 # Changesets for versioning
├── .claude/                    # Claude Code configuration
│   └── skills/                 # Claude skills for this project
├── .github/                    # GitHub Actions workflows
│   └── workflows/
├── .planning/                  # GSD planning documents
│   └── codebase/               # Codebase analysis documents
├── .serena/                    # Serena AI assistant cache
├── package.json                # Root workspace package.json
├── pnpm-workspace.yaml         # Workspace package globs
├── pnpm-lock.yaml              # Lock file
├── tsconfig.json               # Root TypeScript config (shared base)
├── vitest.config.ts            # Root Vitest config (workspace projects)
├── Dockerfile                  # Production Docker image
├── docker-compose.yml          # Docker Compose for development
├── docker-compose.quickstart.yml # Quick-start Docker Compose
└── AGENTS.md                   # Agent instructions for AI tools
```

## Directory Purposes

**`packages/shared/`:**
- Purpose: Single source of truth for all domain types, enum constants, Zod validators, and config schemas
- Contains: TypeScript interfaces, const arrays with `as const`, Zod schemas
- Key files: `src/constants.ts` (all enums), `src/types/` (18 type definition files), `src/validators/` (13 Zod schema files)
- Every other package depends on this

**`packages/db/`:**
- Purpose: Database schema, migrations, client creation, backup utilities
- Contains: Drizzle ORM table definitions, SQL migrations, `createDb()` factory
- Key files: `src/schema/` (36 table files), `src/client.ts` (DB client + migration inspection), `src/migrations/` (SQL files)

**`packages/adapter-utils/`:**
- Purpose: Shared interfaces and utilities for the adapter plugin system
- Contains: `ServerAdapterModule`, `AdapterExecutionContext`, `AdapterExecutionResult`, process spawn helpers
- Key files: `src/types.ts` (all adapter interfaces), `src/server-utils.ts` (process utilities)

**`packages/adapters/`:**
- Purpose: Individual AI agent backend adapters, each with server/ui/cli sub-modules
- Contains: One directory per supported AI tool (claude-local, codex-local, cursor-local, opencode-local, pi-local, openclaw-gateway)
- Each adapter exports from three entry points: `.` (shared), `./server`, `./ui`, `./cli`

**`server/src/routes/`:**
- Purpose: Express route handlers (HTTP endpoint definitions)
- Contains: One file per domain entity/feature, each exports a factory function taking `db: Db`
- Pattern: Route file calls service functions, handles HTTP concerns (params, response codes)

**`server/src/services/`:**
- Purpose: Business logic layer; all database queries and domain operations
- Contains: Service factory functions that return method objects
- Key files: `heartbeat.ts` (~83KB, core agent orchestration), `issues.ts`, `agents.ts`, `company-portability.ts`

**`server/src/middleware/`:**
- Purpose: Express middleware chain (auth, logging, validation, error handling)
- Contains: Actor resolution, hostname guards, mutation guards, Pino logger, Zod validation, error handler

**`ui/src/components/ui/`:**
- Purpose: Primitive/atomic UI components (shadcn-style, Radix-based)
- Contains: Button, Dialog, Select, Card, Badge, Input, etc. (21 components)
- Pattern: Each component uses `class-variance-authority` for variants, `tailwind-merge` for class merging

**`ui/src/api/`:**
- Purpose: Typed API client layer for the UI
- Contains: One file per domain (agents, issues, projects, etc.) + base client
- Pattern: Domain files export an object with methods that call `api.get/post/patch/delete` from `client.ts`

**`skills/`:**
- Purpose: Claude Code skill instruction files for AI-assisted development
- Contains: Markdown instruction files organized by capability
- Not part of the application runtime; used by Claude Code for project-specific guidance

## Key File Locations

**Entry Points:**
- `server/src/index.ts`: Server bootstrap (database, auth, Express, WebSocket, schedulers)
- `server/src/app.ts`: Express app factory (`createApp()`)
- `ui/src/main.tsx`: React app mount with provider tree
- `ui/src/App.tsx`: Root router with all page routes
- `cli/src/index.ts`: CLI entry point (Commander program definition)
- `scripts/dev-runner.mjs`: Dev mode launcher

**Configuration:**
- `package.json`: Root workspace scripts and devDependencies
- `pnpm-workspace.yaml`: Workspace package definitions
- `tsconfig.json`: Root TypeScript config (base for all packages)
- `vitest.config.ts`: Test runner workspace configuration
- `server/src/config.ts`: Server runtime configuration (`loadConfig()`)
- `packages/shared/src/config-schema.ts`: Zod schema for `paperclip.yaml` config file

**Core Logic:**
- `server/src/services/heartbeat.ts`: Agent heartbeat execution engine (the core loop)
- `server/src/adapters/registry.ts`: Server-side adapter type registry
- `server/src/middleware/auth.ts`: Actor resolution (identity for every request)
- `server/src/realtime/live-events-ws.ts`: WebSocket server for live updates
- `ui/src/context/LiveUpdatesProvider.tsx`: Client-side WebSocket + cache invalidation

**Testing:**
- `server/src/__tests__/`: Server tests
- `cli/src/__tests__/`: CLI tests
- `vitest.config.ts`: Root test configuration

## Naming Conventions

**Files:**
- TypeScript source: `kebab-case.ts` / `kebab-case.tsx` (e.g., `live-events-ws.ts`, `agent-auth-jwt.ts`)
- React pages: `PascalCase.tsx` (e.g., `AgentDetail.tsx`, `Dashboard.tsx`)
- React components: `PascalCase.tsx` (e.g., `Layout.tsx`, `CommandPalette.tsx`)
- UI primitives: `kebab-case.tsx` (e.g., `button.tsx`, `dialog.tsx`)
- DB schema files: `snake_case.ts` matching table names (e.g., `heartbeat_runs.ts`, `agent_api_keys.ts`)
- Test files: `*.test.ts` co-located in `__tests__/` directories

**Directories:**
- Packages: `kebab-case` (e.g., `adapter-utils`, `claude-local`)
- Server modules: `kebab-case` (e.g., `adapters`, `middleware`, `routes`, `services`)
- UI modules: `kebab-case` (e.g., `components`, `context`, `hooks`, `api`)

**Packages:**
- Scoped to `@paperclipai/` (e.g., `@paperclipai/shared`, `@paperclipai/db`, `@paperclipai/adapter-claude-local`)
- CLI package: `paperclipai` (unscoped, the published binary)

## Where to Add New Code

**New API Endpoint:**
1. Add Zod input schema: `packages/shared/src/validators/{domain}.ts`
2. Add/update type: `packages/shared/src/types/{domain}.ts`
3. Export from barrels: `packages/shared/src/validators/index.ts`, `packages/shared/src/types/index.ts`, `packages/shared/src/index.ts`
4. Add service logic: `server/src/services/{domain}.ts`, export from `server/src/services/index.ts`
5. Add route handler: `server/src/routes/{domain}.ts`, mount in `server/src/app.ts`
6. Add UI API client: `ui/src/api/{domain}.ts`, export from `ui/src/api/index.ts`

**New Database Table:**
1. Create schema file: `packages/db/src/schema/{table_name}.ts`
2. Export from `packages/db/src/schema/index.ts`
3. Run `pnpm db:generate` to create migration SQL
4. Run `pnpm db:migrate` to apply

**New Adapter (AI Agent Backend):**
1. Create adapter package: `packages/adapters/{name}/`
2. Implement three entry points following the existing adapter structure:
   - `src/index.ts` -- export `models`, `agentConfigurationDoc`
   - `src/server/` -- implement `execute()`, `testEnvironment()`, optional `sessionCodec`
   - `src/ui/` -- implement stdout line parser
   - `src/cli/` -- implement CLI log formatter
3. Register in `server/src/adapters/registry.ts`
4. Register in `ui/src/adapters/registry.ts`
5. Add to `AGENT_ADAPTER_TYPES` in `packages/shared/src/constants.ts`
6. Add UI config form section in `ui/src/components/AgentConfigForm.tsx`
7. Reference: `skills/create-agent-adapter/` contains detailed instructions

**New UI Page:**
1. Create page component: `ui/src/pages/{PageName}.tsx`
2. Add route in `ui/src/App.tsx` inside `boardRoutes()`
3. Add API client if needed: `ui/src/api/{domain}.ts`
4. Add query keys: `ui/src/lib/queryKeys.ts`

**New React Component:**
- Feature component: `ui/src/components/{ComponentName}.tsx`
- Primitive UI component: `ui/src/components/ui/{component-name}.tsx`

**New Service:**
1. Create service: `server/src/services/{domain}.ts`
2. Follow the factory function pattern: `export function {domain}Service(db: Db) { return { ... } }`
3. Export from `server/src/services/index.ts`

**New CLI Command:**
1. Create command handler: `cli/src/commands/{command-name}.ts`
2. Register in `cli/src/index.ts` with Commander

**New Shared Utility:**
- Server utility: `server/src/{module-name}.ts`
- UI utility: `ui/src/lib/{utility-name}.ts`
- Cross-package utility: `packages/shared/src/{utility-name}.ts`

## Special Directories

**`node_modules/`:**
- Purpose: Installed dependencies
- Generated: Yes (by pnpm)
- Committed: No

**`dist/` (in each package):**
- Purpose: TypeScript compilation output
- Generated: Yes (by `tsc` or `esbuild`)
- Committed: No

**`packages/db/src/migrations/`:**
- Purpose: Drizzle Kit generated SQL migration files
- Generated: Yes (by `pnpm db:generate`)
- Committed: Yes (migrations are versioned)

**`.changeset/`:**
- Purpose: Changesets for package version bumps
- Generated: By `pnpm changeset` command
- Committed: Yes

**`ui/dist/`:**
- Purpose: Vite production build output
- Generated: Yes (by `vite build`)
- Committed: No

**`skills/`:**
- Purpose: Claude Code skill files (AI development instructions)
- Generated: No (manually authored)
- Committed: Yes

**`.planning/`:**
- Purpose: GSD codebase analysis and planning documents
- Generated: By GSD commands
- Committed: Yes

---

*Structure analysis: 2026-03-08*
