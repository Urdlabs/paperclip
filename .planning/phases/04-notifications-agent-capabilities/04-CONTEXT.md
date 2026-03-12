# Phase 4: Notifications & Agent Capabilities - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Outgoing webhook notifications for platform events, task decomposition with subtask dependency graphs, agent skill profiles that shape behavior, and a dedicated code review workflow where agents review PRs and post feedback to GitHub. Requirements: NOTF-01, NOTF-02, NOTF-03, AGNT-01, AGNT-02, AGNT-03.

</domain>

<decisions>
## Implementation Decisions

### Webhook Delivery & Configuration (NOTF-01, NOTF-02, NOTF-03)
- Both UI settings page + REST API for webhook endpoint management
- Follow Standard Webhooks spec (https://github.com/standard-webhooks/standard-webhooks) for payload format, signatures, and headers
- Retry with exponential backoff on delivery failure (1s, 10s, 60s, 5min, 30min). Auto-disable endpoint after consecutive failures
- Per-event subscription: each endpoint subscribes to specific event types (run.completed, run.failed, run.started, approval.requested, issue.created, issue.updated)
- Webhook config UI lives in Company Settings
- Delivery history/logs visible per endpoint for debugging

### Task Decomposition & Subtasks (AGNT-01)
- Flat parent-child relationship: subtasks are regular issues with a parentIssueId column, reusing existing issue infrastructure
- Dependency graph between subtasks: subtasks can declare "depends on" other subtasks, enabling parallelism where no dependency exists
- Both operators and agents can create subtasks: operators via UI/API, agents via tool call (respects agent permissions)
- UI: expandable tree view on board and issue detail — click parent to expand into subtask tree with dependency arrows
- Parent issue status derived from subtask states (e.g., blocked until dependencies resolve, done when all subtasks complete)

### Agent Skill Profiles (AGNT-02)
- Profiles extend (not replace) Phase 2 task-type routing — task types select context per issue, skill profiles are per-agent persona overlays that augment the system prompt
- Six predefined profiles at launch: Refactor, Test Writer, Reviewer, Debugger, Architect, Documentation Writer
- Each profile defines: system prompt additions, tool preferences, output format expectations
- One active profile per agent, configured via agent settings (dropdown in UI, field in API). Stored in runtimeConfig JSONB
- Predefined + custom profiles: operators can create custom profiles with their own name, system prompt additions, and tool preferences. Custom profiles stored in DB per company

### Code Review Workflow (AGNT-03)
- GitHub webhook trigger: PR opened event (already handled by GitHub App) creates review issue with diff URL attached. Agent fetches diff via GitHub API using installation token
- Abstracted review provider interface: GitHub is first implementation, design allows GitLab/Bitbucket later
- Structured feedback format: inline comments with line references + overall summary (approve/request changes/comment) + severity per comment (critical/suggestion/nitpick). Maps to GitHub review API
- Auto-post reviews to GitHub — no approval gate. Agent posts directly using installation token
- Context-aware reviews: agent receives PR description, all existing review comments (human and agent), and conversation thread — avoids repeating feedback already given
- Incremental re-review on new pushes: agent receives previous review + diff since last review. Focuses on whether previous feedback was addressed + new issues in changed code

### Claude's Discretion
- Webhook delivery queue implementation (in-process vs DB-backed job queue)
- Subtask dependency resolution algorithm and cycle detection
- Exact system prompt additions per skill profile
- How to extract structured review comments from agent output (tool call vs output parsing)
- Review provider interface contract details
- How to diff between PR revisions for incremental review

</decisions>

<specifics>
## Specific Ideas

- Standard Webhooks spec for payload format — industry standard, well-documented, interoperable
- Dependency graph for subtasks enables parallel execution where independent work exists (e.g., tests and docs can run in parallel)
- Architect and Documentation Writer profiles beyond the original 4 — broader coverage for different agent roles
- Review agents must consider previous comments to avoid redundant feedback and verify whether issues were addressed
- Incremental reviews focus on changes since last review — respects PR author's time

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/src/services/github-app.ts`: GitHub App with PR webhook handling (opened, review_comment). Already creates Paperclip issues from PRs. Extend for review workflow
- `server/src/services/live-events.ts`: publishLiveEvent() — webhook delivery can tap into same event pipeline
- `packages/shared/src/constants.ts`: LIVE_EVENT_TYPES array — extend with webhook-triggering events
- `server/src/services/activity-log.ts`: Activity logging — webhook deliveries should be logged here
- `packages/db/src/schema/agents.ts`: runtimeConfig JSONB — can store skillProfile setting
- `server/src/services/heartbeat.ts`: promptTemplate used per agent — skill profiles augment this
- `packages/db/src/schema/issues.ts`: Existing issues table — add parentIssueId for subtask relationship
- `server/src/context-pipeline/processors/task-type-resolver.ts`: Task type routing — skill profiles are orthogonal overlay

### Established Patterns
- Service factory pattern: `service(db)` returns methods — follow for new webhook service
- JSONB config fields for extensible agent settings (adapterConfig, runtimeConfig, permissions)
- GitHub installation token management for API calls to repos
- WebSocket live events for real-time UI updates

### Integration Points
- `server/src/services/github-app.ts` handleWebhook(): Extend PR event handling for review workflow
- `server/src/services/heartbeat.ts`: Inject skill profile prompt additions before adapter.execute()
- `server/src/services/issues.ts`: Add subtask creation, dependency resolution, parent status derivation
- `ui/src/pages/CompanySettings.tsx`: Add webhook configuration section
- `ui/src/pages/IssueDetail.tsx`: Add subtask tree view
- `ui/src/pages/AgentDetail.tsx` or agent settings: Add skill profile selector

</code_context>

<deferred>
## Deferred Ideas

- Agents self-improving prompt templates based on run outcomes — v2 (carried from Phase 2)
- GitLab/Bitbucket review provider implementations — v2 INTG-02
- Slack/email notification channels — v2 INTG-01, INTG-03
- Parallel agent coordination on single issue — v2 AGNT-04
- A/B testing prompt templates for effectiveness comparison — v2 TOPT-07

</deferred>

---

*Phase: 04-notifications-agent-capabilities*
*Context gathered: 2026-03-11*
