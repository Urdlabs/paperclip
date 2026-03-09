# Technology Stack

**Analysis Date:** 2026-03-08

## Languages

**Primary:**
- TypeScript 5.7.3 - All application code (server, UI, CLI, packages)

**Secondary:**
- SQL - Database migrations in `packages/db/src/migrations/`
- Shell (Bash) - Build/release scripts in `scripts/`
- YAML - CI workflows in `.github/workflows/`, Docker Compose configs

## Runtime

**Environment:**
- Node.js >= 20 (production Docker image uses `node:22-slim`)
- ES Modules throughout (`"type": "module"` in all packages)
- TypeScript target: ES2023, module: NodeNext

**Package Manager:**
- pnpm 9.15.4 (declared in `package.json` `packageManager` field)
- Lockfile: `pnpm-lock.yaml` present (lockfileVersion 9.0)
- Corepack enabled in Docker for pnpm resolution

## Monorepo Structure

**Workspace Manager:** pnpm workspaces (`pnpm-workspace.yaml`)

**Packages:**
| Package | Name | Version | Purpose |
|---------|------|---------|---------|
| `server/` | `@paperclipai/server` | 0.2.7 | Express API server |
| `ui/` | `@paperclipai/ui` | 0.0.1 | React SPA frontend |
| `cli/` | `paperclipai` | 0.2.7 | CLI tool (npm-published) |
| `packages/shared/` | `@paperclipai/shared` | 0.2.7 | Shared types, constants, validators |
| `packages/db/` | `@paperclipai/db` | 0.2.7 | Database schema, client, migrations |
| `packages/adapter-utils/` | `@paperclipai/adapter-utils` | 0.2.7 | Adapter type definitions |
| `packages/adapters/claude-local/` | `@paperclipai/adapter-claude-local` | 0.2.7 | Claude Code adapter |
| `packages/adapters/codex-local/` | `@paperclipai/adapter-codex-local` | 0.2.7 | OpenAI Codex adapter |
| `packages/adapters/cursor-local/` | `@paperclipai/adapter-cursor-local` | 0.2.7 | Cursor adapter |
| `packages/adapters/opencode-local/` | `@paperclipai/adapter-opencode-local` | 0.2.7 | OpenCode adapter |
| `packages/adapters/pi-local/` | `@paperclipai/adapter-pi-local` | 0.1.0 | Pi adapter |
| `packages/adapters/openclaw-gateway/` | `@paperclipai/adapter-openclaw-gateway` | 0.2.7 | OpenClaw gateway adapter |

## Frameworks

**Core:**
- Express 5.1.0 - HTTP server (`server/package.json`)
- React 19.0.0 - UI framework (`ui/package.json`)
- React Router DOM 7.1.5 - Client-side routing (`ui/package.json`)

**Data Layer:**
- Drizzle ORM 0.38.4 - Database ORM (`packages/db/package.json`)
- postgres.js 3.4.5 - PostgreSQL driver (`packages/db/package.json`)
- Drizzle Kit 0.31.9 - Migration generation (`packages/db/package.json` devDependencies)

**Authentication:**
- better-auth 1.4.18 - Auth framework with email/password (`server/package.json`)

**UI Libraries:**
- TanStack React Query 5.90.21 - Server state management (`ui/package.json`)
- Tailwind CSS 4.0.7 - Styling (`ui/package.json`)
- Radix UI 1.4.3 - Headless UI primitives (`ui/package.json`)
- class-variance-authority 0.7.1 - Variant-based styling (`ui/package.json`)
- Lucide React 0.574.0 - Icons (`ui/package.json`)
- cmdk 1.1.1 - Command palette (`ui/package.json`)
- @dnd-kit/* - Drag and drop (`ui/package.json`)
- @mdxeditor/editor 3.52.4 - Rich text editing (`ui/package.json`)
- Mermaid 11.12.0 - Diagram rendering (`ui/package.json`)
- react-markdown 10.1.0 + remark-gfm 4.0.1 - Markdown rendering (`ui/package.json`)

**Testing:**
- Vitest 3.0.5 - Test runner (`vitest.config.ts`)
- Supertest 7.0.0 - HTTP testing (`server/package.json`)

**Build/Dev:**
- Vite 6.1.0 - UI bundler and dev server (`ui/vite.config.ts`)
- @vitejs/plugin-react 4.3.4 - React support for Vite
- esbuild 0.27.3 - CLI bundling (`cli/esbuild.config.mjs`)
- tsc - TypeScript compilation for server and packages
- tsx 4.19.2 - TypeScript execution for dev mode
- @changesets/cli 2.30.0 - Version management and changelog

**CLI:**
- Commander 13.1.0 - CLI argument parsing (`cli/package.json`)
- @clack/prompts 0.10.0 - Interactive prompts (`cli/package.json`)
- picocolors 1.1.1 - Terminal colors (used across CLI and adapters)

## Key Dependencies

**Critical:**
- `drizzle-orm` 0.38.4 - All database access flows through Drizzle
- `better-auth` 1.4.18 - Authentication in `authenticated` deployment mode
- `express` 5.1.0 - All API routes and middleware
- `ws` 8.19.0 - WebSocket for real-time live events (`server/src/realtime/live-events-ws.ts`)
- `zod` 3.24.2 - Schema validation for API inputs (`packages/shared/`)
- `@aws-sdk/client-s3` 3.888.0 - S3 storage provider (`server/src/storage/s3-provider.ts`)

**Infrastructure:**
- `pino` 9.6.0 + `pino-http` 10.4.0 + `pino-pretty` 13.1.3 - Structured logging (`server/src/middleware/logger.ts`)
- `embedded-postgres` 18.1.0-beta.16 - Zero-config embedded PostgreSQL for local dev
- `detect-port` 2.1.0 - Auto-detect available ports
- `multer` 2.0.2 - File upload handling
- `dotenv` 17.0.1 - Environment variable loading

**Production Docker Installs (global):**
- `@anthropic-ai/claude-code@latest` - Claude Code CLI for claude_local adapter
- `@openai/codex@latest` - Codex CLI for codex_local adapter
- `opencode-ai` - OpenCode CLI for opencode_local adapter
- `agent-browser@latest` - Lightpanda browser support for agents
- `gh` - GitHub CLI for private repo access

## Configuration

**Environment:**
- Primary config via environment variables (prefixed `PAPERCLIP_*`)
- JSON config file at `PAPERCLIP_CONFIG` path (default: `~/.paperclip/instances/default/config.json`)
- `.env` file loaded from Paperclip home path via dotenv
- `.env.example` at project root with minimal vars: `DATABASE_URL`, `PORT`, `SERVE_UI`
- Config resolution: env vars override config file values (`server/src/config.ts`)

**Key Environment Variables:**
- `DATABASE_URL` - External PostgreSQL connection string (optional; falls back to embedded)
- `PORT` - Server port (default: 3100)
- `HOST` - Bind host (default: 127.0.0.1)
- `SERVE_UI` - Serve built UI from server (default: true)
- `PAPERCLIP_DEPLOYMENT_MODE` - `local_trusted` or `authenticated`
- `PAPERCLIP_DEPLOYMENT_EXPOSURE` - `private` or `public`
- `BETTER_AUTH_SECRET` - Required in authenticated mode
- `PAPERCLIP_PUBLIC_URL` - Public-facing URL for auth callbacks
- `ANTHROPIC_API_KEY` - For Claude adapter
- `OPENAI_API_KEY` - For Codex adapter
- `GITHUB_TOKEN` - Fallback GitHub access token
- `PAPERCLIP_SECRETS_PROVIDER` - `local_encrypted`, `aws_secrets_manager`, `gcp_secret_manager`, `vault`
- `PAPERCLIP_STORAGE_PROVIDER` - `local_disk` or `s3`
- `PAPERCLIP_AGENT_JWT_SECRET` - JWT signing for agent auth

**Build:**
- `tsconfig.json` - Root TypeScript config (ES2023, NodeNext modules, strict)
- `vitest.config.ts` - Root test config referencing project workspaces
- `ui/vite.config.ts` - Vite config with React plugin, Tailwind, and API proxy to :3100
- Each package has its own `tsconfig.json` extending root

## Platform Requirements

**Development:**
- Node.js >= 20
- pnpm 9.15.4 (via corepack)
- PostgreSQL 17 (or use embedded-postgres for zero-config)
- No native build dependencies required

**Production:**
- Docker (multi-stage build, `node:22-slim` base)
- PostgreSQL 17 (external via `DATABASE_URL` or embedded)
- Optional: S3-compatible storage for assets
- Default port: 3100
- Volume mount at `/paperclip` for persistent data

**CI:**
- GitHub Actions (`pr-verify.yml`): Node 20, pnpm 9.15.4, runs typecheck + test + build
- `pr-policy.yml` and `refresh-lockfile.yml` additional workflows

---

*Stack analysis: 2026-03-08*
