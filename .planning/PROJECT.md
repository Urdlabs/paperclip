# Paperclip (Urdlabs Fork)

## What This Is

A fork of Paperclip — an AI agent orchestration platform — tailored to personal needs. Paperclip manages autonomous coding agents (Claude, Codex, Cursor, etc.) through a heartbeat-driven execution loop, issue tracker, and project management board. This fork adds deeper GitHub integration, bug fixes, new agent tools, and aims for significant improvements in token efficiency, UI/UX, infrastructure, and agent capabilities.

## Core Value

Agents that do more with less — smarter context management, lower token cost, better results — in a tool that fits exactly how I work.

## Requirements

### Validated

- Multi-agent orchestration with heartbeat-driven execution loop — existing
- Pluggable adapter system for AI backends (Claude, Codex, Cursor, OpenCode, Pi, OpenClaw) — existing
- Issue tracker with comments, labels, attachments, approval workflows — existing
- Project management with workspaces, goals, and agent assignment — existing
- GitHub App integration (installation lifecycle, repo access tokens) — existing
- GitHub webhook automation (issues, PRs, comments, pipeline failures → Paperclip issues) — existing
- Real-time UI updates via WebSocket live events — existing
- Two deployment modes (local_trusted, authenticated with BetterAuth) — existing
- Pluggable storage (local disk, S3) and secrets management (AES-256-GCM) — existing
- CLI tool for setup, diagnostics, and agent invocation — existing
- Agent browser support via Lightpanda — existing
- Activity logging and cost tracking — existing

### Active

- [ ] Token usage optimization — reduce agent token consumption through smarter context, prompt engineering, and tool usage
- [ ] UI/UX improvements — better board experience, workflows, and agent monitoring
- [ ] New agent capabilities — additional adapters, tools, and skills
- [ ] Infrastructure improvements — deployment, monitoring, performance
- [ ] Additional integrations — beyond GitHub (Slack, Linear, etc.)

### Out of Scope

- Upstream PR splitting — not the current focus, may revisit later
- Mobile app — web-first
- Multi-cloud secrets providers — stubs exist but not priority (local_encrypted works)

## Context

- Forked from the original Paperclip repo to customize freely
- Recent additions: GitHub App webhook automation for issues/PRs/comments/pipeline failures, Lightpanda browser support, various bug fixes
- The codebase is a pnpm monorepo with TypeScript throughout: server (Express 5), UI (React 19 + TanStack Query), CLI (Commander), shared packages, and adapter plugins
- PostgreSQL 17 via Drizzle ORM, with embedded-postgres option for dev
- Token optimization is the highest-value improvement area — agents currently burn through tokens on context that could be reduced

## Constraints

- **Stack**: TypeScript monorepo with pnpm workspaces — maintain existing architecture
- **Compatibility**: Must stay broadly compatible with upstream Paperclip for potential future merges
- **Deployment**: Docker-based with embedded postgres option must keep working
- **Adapters**: Plugin interface must remain stable for existing adapter packages

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fork instead of upstream PRs | Faster iteration, full control over direction | — Pending |
| Token optimization as top priority | Biggest ROI — reduces cost and improves agent quality | — Pending |
| Keep upstream compatibility | Option to contribute back or pull upstream changes | — Pending |

---
*Last updated: 2026-03-08 after initialization*
