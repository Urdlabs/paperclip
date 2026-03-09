# External Integrations

**Analysis Date:** 2026-03-08

## APIs & External Services

**GitHub API:**
- Full GitHub App integration for repository management
  - SDK/Client: Native `fetch()` to `https://api.github.com` (`server/src/services/github-app.ts`)
  - Auth: RS256 JWT generated from stored GitHub App private key; installation access tokens cached in-memory
  - API Version: `2022-11-28` (sent via `X-GitHub-Api-Version` header)
  - Permissions requested: `contents:write`, `pull_requests:write`, `issues:write`, `metadata:read`, `workflows:write`
  - Events subscribed: `issues`, `issue_comment`, `pull_request`, `pull_request_review_comment`, `workflow_run`
  - GitHub App manifest flow: generates manifest at `/api/github/manifest`, exchanges code at `/api/github/callback`
  - Installation token generation with caching (5-min early expiry) and company-scoped app priority
  - Env var: `GITHUB_TOKEN` (fallback token for agent git operations)

**AI Agent CLIs (invoked as child processes):**
- Claude Code (`@anthropic-ai/claude-code`) - Adapter: `claude_local` (`packages/adapters/claude-local/`)
  - Auth: `ANTHROPIC_API_KEY` env var
- OpenAI Codex (`@openai/codex`) - Adapter: `codex_local` (`packages/adapters/codex-local/`)
  - Auth: `OPENAI_API_KEY` env var
- OpenCode AI (`opencode-ai`) - Adapter: `opencode_local` (`packages/adapters/opencode-local/`)
- Cursor - Adapter: `cursor` (`packages/adapters/cursor-local/`)
- Pi - Adapter: `pi_local` (`packages/adapters/pi-local/`)
- OpenClaw Gateway - Adapter: `openclaw_gateway` (`packages/adapters/openclaw-gateway/`), uses WebSocket (`ws` package)

**Lightpanda Browser:**
- Headless browser binary installed in Docker at `/usr/local/bin/lightpanda`
- Used by `agent-browser` package for agent web browsing capabilities
- Downloaded from `https://github.com/lightpanda-io/browser/releases`

## Adapter System

The adapter system (`server/src/adapters/registry.ts`) provides a pluggable interface for AI coding agents:

**Registered Adapters:**
| Type | Package | Transport | JWT Support |
|------|---------|-----------|-------------|
| `claude_local` | `@paperclipai/adapter-claude-local` | Process | Yes |
| `codex_local` | `@paperclipai/adapter-codex-local` | Process | Yes |
| `cursor` | `@paperclipai/adapter-cursor-local` | Process | Yes |
| `opencode_local` | `@paperclipai/adapter-opencode-local` | Process | Yes |
| `pi_local` | `@paperclipai/adapter-pi-local` | Process | Yes |
| `openclaw_gateway` | `@paperclipai/adapter-openclaw-gateway` | HTTP/WS | No |
| `process` | Built-in (`server/src/adapters/process/`) | Process | - |
| `http` | Built-in (`server/src/adapters/http/`) | HTTP | - |

Each adapter implements: `execute()`, `testEnvironment()`, optional `sessionCodec`, optional `listModels()`.
Adapter modules export from three entry points: `/server`, `/ui`, `/cli`.

## Data Storage

**Databases:**
- PostgreSQL 17 (primary and only database)
  - Connection: `DATABASE_URL` env var or config file `database.connectionString`
  - Client: Drizzle ORM via `postgres` driver (`packages/db/src/client.ts`)
  - ORM: `drizzle-orm/postgres-js` with full schema in `packages/db/src/schema/`
  - Migrations: Drizzle Kit generated SQL migrations in `packages/db/src/migrations/`
  - Embedded option: `embedded-postgres` package for zero-config local development (port 54329 default)
  - Backup: Built-in scheduled backup system (`packages/db/src/backup-lib.ts`) with configurable interval and retention

**Database Schema Tables:**
- `auth_users`, `auth_sessions`, `auth_accounts`, `auth_verifications` - Better Auth tables
- `companies`, `company_memberships`, `company_secrets`, `company_secret_versions` - Multi-tenant company data
- `agents`, `agent_api_keys`, `agent_config_revisions`, `agent_runtime_state`, `agent_task_sessions`, `agent_wakeup_requests` - Agent management
- `projects`, `project_workspaces`, `project_goals` - Project tracking
- `issues`, `issue_comments`, `issue_attachments`, `issue_labels`, `issue_approvals`, `issue_read_states` - Issue tracker
- `goals` - Company goals
- `approvals`, `approval_comments` - Approval workflow
- `heartbeat_runs`, `heartbeat_run_events` - Agent execution lifecycle
- `cost_events` - Usage/cost tracking
- `activity_log` - Audit trail
- `github_apps`, `github_app_installations` - GitHub App configuration
- `instance_user_roles`, `invites`, `join_requests`, `labels`, `assets` - Access control and misc
- `principal_permission_grants` - Fine-grained permissions

**File Storage:**
- Pluggable storage provider system (`server/src/storage/`)
  - `local_disk` (default): Files stored on local filesystem (`server/src/storage/local-disk-provider.ts`)
    - Base dir: configurable via `PAPERCLIP_STORAGE_LOCAL_DIR` or config file
  - `s3`: AWS S3 or S3-compatible storage (`server/src/storage/s3-provider.ts`)
    - SDK: `@aws-sdk/client-s3` 3.888.0
    - Config: `PAPERCLIP_STORAGE_S3_BUCKET`, `PAPERCLIP_STORAGE_S3_REGION`, `PAPERCLIP_STORAGE_S3_ENDPOINT`, `PAPERCLIP_STORAGE_S3_PREFIX`, `PAPERCLIP_STORAGE_S3_FORCE_PATH_STYLE`
  - Provider interface defined in `server/src/storage/types.ts`: `putObject`, `getObject`, `headObject`, `deleteObject`
  - Storage service adds company-scoped key namespacing, SHA-256 hashing (`server/src/storage/service.ts`)

**Caching:**
- In-memory only: GitHub installation token cache (`server/src/services/github-app.ts`, `tokenCache` Map)
- No external cache (Redis, Memcached, etc.)

## Authentication & Identity

**Auth Provider: better-auth (self-hosted)**
- Implementation: `server/src/auth/better-auth.ts`
- Features: Email/password auth, session management
- Storage: Drizzle adapter writing to `auth_*` PostgreSQL tables
- Config: `BETTER_AUTH_SECRET` required in authenticated mode
- Trusted origins: Derived from config + `BETTER_AUTH_TRUSTED_ORIGINS` env var
- Optional: Sign-up can be disabled via `PAPERCLIP_AUTH_DISABLE_SIGN_UP`

**Deployment Modes:**
- `local_trusted`: No auth required; all requests treated as local board user (`LOCAL_BOARD_USER_ID = "local-board"`)
- `authenticated`: Full better-auth flow; requires `BETTER_AUTH_SECRET`

**Agent Authentication:**
- API keys: SHA-256 hashed, stored in `agent_api_keys` table, checked in middleware (`server/src/middleware/auth.ts`)
- Local agent JWT: HS256 HMAC tokens for adapter-to-server auth during runs (`server/src/agent-auth-jwt.ts`)
  - Claims: `sub` (agent ID), `company_id`, `adapter_type`, `run_id`
  - Config: `PAPERCLIP_AGENT_JWT_SECRET`, `PAPERCLIP_AGENT_JWT_TTL_SECONDS` (default: 48h)

**Board Claim System:**
- Bootstrap CEO invite auto-created when no instance admin exists (`server/src/board-claim.ts`)
- One-time claim URL for transitioning from `local_trusted` to `authenticated`

## Secrets Management

**Provider System:** `server/src/secrets/`
- `local_encrypted` (default, fully implemented): AES-256-GCM encryption at rest (`server/src/secrets/local-encrypted-provider.ts`)
  - Master key from `PAPERCLIP_SECRETS_MASTER_KEY` env var or file at `PAPERCLIP_SECRETS_MASTER_KEY_FILE`
  - Auto-generates master key if none exists
  - Same encryption used for GitHub App credentials
- `aws_secrets_manager`: Stub only (`server/src/secrets/external-stub-providers.ts`) - throws "not configured"
- `gcp_secret_manager`: Stub only - throws "not configured"
- `vault` (HashiCorp Vault): Stub only - throws "not configured"
- Strict mode: `PAPERCLIP_SECRETS_STRICT_MODE` - controls whether missing secrets cause errors

## Monitoring & Observability

**Logging:**
- Framework: Pino 9.6.0 with pino-http for request logging (`server/src/middleware/logger.ts`)
- Output: Dual-target transport
  - stdout: pino-pretty at `info` level with colors
  - File: pino-pretty at `debug` level to `{logDir}/server.log`
- Log dir: configurable via `PAPERCLIP_LOG_DIR` or config file `logging.logDir`
- HTTP logging: Status-based log levels (500+ = error, 400+ = warn, else info)
- Child loggers used per service/route (e.g., `logger.child({ service: "github-app" })`)

**Error Tracking:**
- No external error tracking service (Sentry, etc.)
- Errors logged via Pino; error handler middleware in `server/src/middleware/error-handler.ts`

**Health Check:**
- `GET /api/health` endpoint (`server/src/routes/health.ts`)
- Docker HEALTHCHECK configured: `curl -f http://localhost:3100/api/health` every 30s

## Real-time Communication

**WebSocket Server:**
- Library: `ws` 8.19.0 (via `createRequire` for CJS compat) (`server/src/realtime/live-events-ws.ts`)
- Endpoint: `GET /api/companies/:companyId/events/ws` (upgrade)
- Auth: Bearer token (agent API key) or session cookie (board user), local_trusted skips auth
- Ping/pong heartbeat every 30s with dead connection cleanup
- Publishes company-scoped live events (agent status changes, issue updates, etc.)
- In-memory pub/sub via `server/src/services/live-events.ts`

## CI/CD & Deployment

**Hosting:**
- Docker-based deployment (`Dockerfile` multi-stage: base -> deps -> build -> production)
- Docker Compose configs: `docker-compose.yml` (with external PostgreSQL), `docker-compose.quickstart.yml` (standalone with embedded PG)
- npm published packages (CLI `paperclipai` and library packages via `@paperclipai/*` scope)

**CI Pipeline:**
- GitHub Actions
  - `pr-verify.yml`: On PRs to master - checkout, pnpm install, typecheck, test, build (Node 20, pnpm 9.15.4, ubuntu-latest, 20min timeout)
  - `pr-policy.yml`: PR policy checks
  - `refresh-lockfile.yml`: Lockfile maintenance

**Release:**
- Changesets for versioning (`@changesets/cli`, `.changeset/` directory)
- `scripts/release.sh` for release process
- `scripts/build-npm.sh` for npm package builds

## Webhooks & Callbacks

**Incoming:**
- `POST /api/github/webhook` - GitHub webhook receiver (`server/src/routes/github.ts`)
  - Raw body parsing (before express.json) for HMAC SHA-256 signature verification
  - Events handled: `installation` (created/deleted/suspend/unsuspend), `issues` (opened), `issue_comment` (created), `pull_request` (opened), `pull_request_review_comment` (created), `workflow_run` (completed+failure)
  - Auto-creates Paperclip issues from GitHub events and wakes assigned agents

**Outgoing:**
- No outgoing webhooks

**Callbacks:**
- `GET /api/github/callback?code=<code>` - GitHub App manifest code exchange
- Redirects to GitHub App installation page after successful exchange

## Environment Configuration

**Required env vars (authenticated mode):**
- `BETTER_AUTH_SECRET` - Auth secret key
- `PAPERCLIP_PUBLIC_URL` - Public URL (for GitHub App setup, auth redirects)

**Required env vars (with external PostgreSQL):**
- `DATABASE_URL` - PostgreSQL connection string

**Optional env vars:**
- `PORT` (default: 3100)
- `HOST` (default: 127.0.0.1)
- `SERVE_UI` (default: true)
- `ANTHROPIC_API_KEY` - For Claude adapter
- `OPENAI_API_KEY` - For Codex adapter
- `GITHUB_TOKEN` - Fallback GitHub token
- `PAPERCLIP_DEPLOYMENT_MODE` - `local_trusted` (default) or `authenticated`
- `PAPERCLIP_DEPLOYMENT_EXPOSURE` - `private` (default) or `public`
- `PAPERCLIP_SECRETS_PROVIDER` - Secret backend selection
- `PAPERCLIP_STORAGE_PROVIDER` - Storage backend selection
- `PAPERCLIP_STORAGE_S3_*` - S3 storage configuration
- `PAPERCLIP_AGENT_JWT_SECRET` - Agent JWT signing key
- `HEARTBEAT_SCHEDULER_ENABLED` - Enable/disable heartbeat (default: true)
- `HEARTBEAT_SCHEDULER_INTERVAL_MS` - Heartbeat interval (default: 30000, min: 10000)
- `PAPERCLIP_DB_BACKUP_ENABLED` - Auto backup (default: true)
- `PAPERCLIP_DB_BACKUP_INTERVAL_MINUTES` - Backup interval (default: 60)
- `PAPERCLIP_DB_BACKUP_RETENTION_DAYS` - Backup retention (default: 30)
- `PAPERCLIP_EMBEDDED_POSTGRES_VERBOSE` - Verbose embedded PG logs

**Secrets location:**
- Master encryption key: file at `PAPERCLIP_SECRETS_MASTER_KEY_FILE` (default: `data/secrets/master.key`)
- Application secrets: encrypted in `company_secrets` / `company_secret_versions` PostgreSQL tables
- GitHub App credentials: encrypted in `github_apps` PostgreSQL table (same AES-256-GCM scheme)

---

*Integration audit: 2026-03-08*
