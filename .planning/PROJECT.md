# Paperclip (Urdlabs Fork)

## What This Is

A fork of Paperclip — an AI agent orchestration platform — with deep token optimization, observability, extended agent capabilities, and automated upstream sync. Paperclip manages autonomous coding agents (Claude, Codex, Cursor, etc.) through a heartbeat-driven execution loop, issue tracker, and project management board. This fork adds a context optimization pipeline that reduces token waste, live token analytics with cost attribution, trace visualization, webhook notifications, task decomposition with dependency graphs, agent skill profiles, automated code review workflows, and a GitHub Action that continuously syncs upstream changes into the fork.

## Core Value

Agents that do more with less — smarter context management, lower token cost, better results — in a tool that fits exactly how I work.

## Requirements

### Validated

- ✓ Multi-agent orchestration with heartbeat-driven execution loop — existing
- ✓ Pluggable adapter system for AI backends (Claude, Codex, Cursor, OpenCode, Pi, OpenClaw) — existing
- ✓ Issue tracker with comments, labels, attachments, approval workflows — existing
- ✓ Project management with workspaces, goals, and agent assignment — existing
- ✓ GitHub App integration (installation lifecycle, repo access tokens) — existing
- ✓ GitHub webhook automation (issues, PRs, comments → Paperclip issues) — existing
- ✓ Real-time UI updates via WebSocket live events — existing
- ✓ Two deployment modes (local_trusted, authenticated with BetterAuth) — existing
- ✓ Pluggable storage (local disk, S3) and secrets management (AES-256-GCM) — existing
- ✓ CLI tool for setup, diagnostics, and agent invocation — existing
- ✓ Agent browser support via Lightpanda — existing
- ✓ Activity logging and cost tracking — existing
- ✓ Token usage tracking per run with input/output/cached breakdown and live counters — v1.0
- ✓ Token analytics dashboard with cost attribution by agent, project, and run — v1.0
- ✓ Context window utilization visualization with percentage breakdown — v1.0
- ✓ Context optimization pipeline with serialization, deduplication, and prompt caching — v1.0
- ✓ Per-run token budget cap with graceful wind-down — v1.0
- ✓ Smart prompt templates per task type (bug fix, feature, review, etc.) — v1.0
- ✓ Outgoing webhook notifications with Standard Webhooks signing — v1.0
- ✓ Trace visualization for structured execution path inspection — v1.0
- ✓ Filtered activity feeds by agent, project, event type, severity — v1.0
- ✓ Analytics charts for token trends, cost breakdown, context composition — v1.0
- ✓ Task decomposition with subtasks and dependency ordering — v1.0
- ✓ Agent skill profiles shaping prompt and behavior — v1.0
- ✓ Code review workflow with PR diffs and structured feedback — v1.0
- ✓ Upstream merge — 226 upstream commits safely integrated with conflict map, migration renumbering, and rollback safety — v1.1
- ✓ Post-merge verification — 613 tests passing, zero TypeScript errors, Docker healthy, all v1.0 features confirmed — v1.1
- ✓ Automated upstream sync — GitHub Action with weekly cron, area-grouped PRs/issues, rerere seeding, lockfile regen — v1.1
- ✓ Sync health badge — shields.io endpoint badge in README showing commits-behind count — v1.1

### Active

(None — planning next milestone)

### Future

- [ ] Model routing by task complexity — cheaper models for simple tasks
- [ ] Slack integration (bidirectional) — notifications and commands
- [ ] Linear/Jira bidirectional issue sync
- [ ] MCP server/client support
- [ ] Historical run comparison — side-by-side diff
- [ ] Parallel agent coordination on single issue

### Out of Scope

- Built-in IDE / code editor — agents work in repos via CLI
- Custom LLM hosting — use provider APIs with user keys
- Visual agent builder (drag-and-drop) — config-driven simplicity is the strength
- Multi-tenant SaaS billing — self-hosted tool
- Mobile app — web works on mobile browsers
- Chat-with-agent interface — task-based orchestration, issue comments for async communication
- Plugin marketplace — adapter system is the extension point
- Upstream PR splitting — not the current focus

## Current State

v1.0 + v1.1 shipped. Fork is fully synced with upstream (0 commits behind) and 119+ ahead. Automated weekly sync workflow ensures the fork never silently drifts again.

## Context

TypeScript monorepo with pnpm workspaces: server (Express 5), UI (React 19 + TanStack Query), CLI (Commander), shared packages, adapter plugins. PostgreSQL 17 via Drizzle ORM.

v1.0 delivered token analytics + optimization pipeline + observability dashboards + webhooks + task decomposition + skill profiles + code review in 3 days (4 phases, 14 plans).

v1.1 merged 226 upstream commits (onboarding wizard, Gemini adapter, heartbeat settings, max turns 300, CI improvements), verified all v1.0 features survived, and established automated sync with GitHub Actions. 613 tests passing. 2 days (4 phases, 10 plans).

## Constraints

- **Stack**: TypeScript monorepo with pnpm workspaces — maintain existing architecture
- **Compatibility**: Must stay broadly compatible with upstream Paperclip for potential future merges
- **Deployment**: Docker-based with embedded postgres option must keep working
- **Adapters**: Plugin interface must remain stable for existing adapter packages

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fork instead of upstream PRs | Faster iteration, full control over direction | ✓ Good — shipped v1.0 in 3 days |
| Token optimization as top priority | Biggest ROI — reduces cost and improves agent quality | ✓ Good — full pipeline in place |
| Keep upstream compatibility | Option to contribute back or pull upstream changes | — Pending |
| ~4 chars/token heuristic for estimation | Simple, fast, sufficient accuracy for analytics | ✓ Good |
| Processor-chain pipeline pattern | Composable, testable context transformations | ✓ Good — 5 processors running |
| Standard Webhooks spec for signing | Industry standard, well-documented, interoperable | ✓ Good |
| Kahn's algorithm for dependency ordering | Iterative BFS, no stack overflow risk, natural wave grouping | ✓ Good |
| ReviewProvider abstraction | Extensible to GitLab/Bitbucket without core changes | ✓ Good |
| Recharts for analytics | Lightweight, React-native, sufficient for dashboard needs | ✓ Good |

| Incremental merge over big-bang rebase | Safer conflict resolution, easier rollback, preserves our commit history | ✓ Good — 226 commits merged cleanly |
| GitHub Action for ongoing sync | Eliminates manual merge drift, catches conflicts early | ✓ Good — weekly cron + manual dispatch |
| git rerere for conflict replay | Auto-applies prior conflict resolutions in future syncs | ✓ Good — seeded from Phase 6 merge |
| Single merge commit for all 16 conflicts | Git requires all conflicts resolved in one commit | ✓ Good — conflict map playbook worked |

---
*Last updated: 2026-03-13 after v1.1 milestone complete*
