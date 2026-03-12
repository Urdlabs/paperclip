---
phase: 04-notifications-agent-capabilities
verified: 2026-03-12T10:05:00Z
status: gaps_found
score: 4/5 must-haves verified
gaps:
  - truth: "An operator can configure outgoing webhook endpoints that receive structured JSON payloads for configurable event types (run.completed, run.failed, run.started, approval.requested, issue.created, issue.updated)"
    status: partial
    reason: "Backend fully supports all 6 event types but the UI WebhookEndpointList component hardcodes wrong event types in its form. The local EVENT_TYPES constant lists [issue.created, issue.updated, issue.comment_added, agent.created, agent.updated, heartbeat.invoked] instead of the backend WEBHOOK_EVENT_TYPES [run.completed, run.failed, run.started, approval.requested, issue.created, issue.updated]. Only 2 of 6 types overlap. Operators cannot subscribe to run.completed, run.failed, run.started, or approval.requested from the UI."
    artifacts:
      - path: "ui/src/components/WebhookEndpointList.tsx"
        issue: "Lines 29-36: local EVENT_TYPES constant does not match backend WEBHOOK_EVENT_TYPES. Should import from @paperclipai/shared or match the 6 backend types."
    missing:
      - "Replace local EVENT_TYPES in WebhookEndpointList.tsx with the correct 6 event types from WEBHOOK_EVENT_TYPES constant (run.completed, run.failed, run.started, approval.requested, issue.created, issue.updated)"
human_verification:
  - test: "Create a webhook endpoint via the UI, subscribe to run.failed, trigger a failed run, and verify the webhook receives a delivery"
    expected: "Webhook endpoint receives a POST with Standard Webhooks headers and a JSON payload containing type=run.failed"
    why_human: "Requires running server, creating an agent run that fails, and inspecting actual HTTP delivery"
  - test: "Open an issue detail page and add subtasks with dependencies, then verify cycle rejection"
    expected: "Adding a circular dependency shows an error, and subtasks render in topological order"
    why_human: "Visual rendering of dependency labels and error toast behavior"
  - test: "Assign a skill profile to an agent and trigger a run, verify prompt augmentation"
    expected: "The agent's system prompt includes the skill profile's systemPromptAdditions section"
    why_human: "Requires running a heartbeat cycle and inspecting the assembled prompt"
---

# Phase 04: Notifications & Agent Capabilities Verification Report

**Phase Goal:** The platform notifies operators of important events via webhooks and agents can handle more complex work through task decomposition, skill profiles, and code review
**Verified:** 2026-03-12T10:05:00Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | An operator can configure outgoing webhook endpoints that receive structured JSON payloads for configurable event types | PARTIAL | Backend supports all 6 types via REST API. UI form hardcodes wrong event types (4 of 6 missing: run.completed, run.failed, run.started, approval.requested). Backend webhook creation works correctly via API. |
| 2 | When an agent run fails, a notification is automatically pushed to all configured webhook endpoints within seconds | VERIFIED | webhook-dispatcher.ts maps heartbeat.run.status with status "failed" or "timed_out" to "run.failed", dispatches to all subscribed endpoints with immediate delivery attempt. startWebhookDispatcher called at server boot (server/src/index.ts:526-527). Retry queue runs every 5 seconds. |
| 3 | An operator can break a complex issue into subtasks with parent-child relationships and dependency ordering, and agents process subtasks in the correct order | VERIFIED | issue_dependencies table with Kahn's algorithm topological sort. issueService extended with createSubtask, listSubtasks (topologically sorted), addDependency (cycle detection), removeDependency, deriveParentStatus, getExecutionWaves. 5 REST endpoints. SubtaskTree UI component with dependency visualization. 11 graph algorithm tests pass. |
| 4 | An operator can assign a skill profile to an agent, and the agent's prompt and behavior change accordingly | VERIFIED | 6 predefined profiles (Refactor, Test Writer, Reviewer, Debugger, Architect, Documentation Writer). skillProfileService with CRUD + seed. resolveSkillProfile pipeline processor augments promptTemplate. Heartbeat resolves skillProfileId from agent runtimeConfig. SkillProfileSelector UI component on AgentDetail page. 8 processor tests pass. |
| 5 | A code review workflow exists where review-assigned agents receive PR diffs, produce structured feedback, and post review comments to the PR | VERIFIED | ReviewProvider interface with fetchDiff, fetchExistingReviews, submitReview, compareDiff. GitHub implementation with installation token auth and line+side fields. codeReviewService orchestrates full review context including incremental re-reviews. github-app.ts handleGitHubPrOpened creates review issues for reviewer-profile agents. 13 tests pass. |

**Score:** 4/5 truths verified (1 partial)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/db/src/schema/webhook_endpoints.ts` | Webhook endpoint config table | VERIFIED | pgTable("webhook_endpoints") with 10 columns, 2 indexes |
| `packages/db/src/schema/webhook_deliveries.ts` | Webhook delivery log table | VERIFIED | pgTable("webhook_deliveries") with 13 columns, 2 indexes |
| `server/src/services/webhooks.ts` | Webhook CRUD + signing + delivery | VERIFIED | 434 lines. HMAC-SHA256 signing, CRUD, retry queue, auto-disable at 5 failures |
| `server/src/services/webhook-dispatcher.ts` | Event-to-webhook bridge | VERIFIED | 171 lines. Maps LiveEvent to WebhookEventType, dispatches to endpoints, retry interval |
| `server/src/routes/webhooks.ts` | Webhook REST API | VERIFIED | 177 lines. POST/GET/PATCH/DELETE + deliveries + test endpoint |
| `packages/db/src/schema/issue_dependencies.ts` | Dependency edge table | VERIFIED | pgTable("issue_dependencies") with unique edge constraint |
| `server/src/services/dependency-graph.ts` | Topological sort + cycle detection | VERIFIED | 139 lines. Kahn's algorithm, validateNoCycle, getExecutionWaves |
| `server/src/services/issues.ts` | Extended with subtask methods | VERIFIED | createSubtask, listSubtasks, addDependency, removeDependency, deriveParentStatus, updateSubtaskStatus, getExecutionWaves |
| `packages/db/src/schema/skill_profiles.ts` | Skill profile table | VERIFIED | pgTable("skill_profiles") with company+slug unique index |
| `server/src/services/skill-profiles.ts` | Skill profile CRUD + seeding | VERIFIED | 217 lines. 6 BUILTIN_SKILL_PROFILES, CRUD, seedBuiltinProfiles with onConflictDoNothing |
| `server/src/context-pipeline/processors/skill-profile-resolver.ts` | Pipeline processor for prompt injection | VERIFIED | 24 lines. Appends skill profile section to promptTemplate |
| `server/src/routes/skill-profiles.ts` | Skill profile REST API | VERIFIED | 147 lines. GET/POST/PATCH/DELETE + seed. Rejects builtin modification (403). |
| `server/src/services/review-providers/types.ts` | ReviewProvider interface | VERIFIED | ReviewProvider, ReviewResult, ReviewComment, ReviewContext types |
| `server/src/services/review-providers/github.ts` | GitHub ReviewProvider | VERIFIED | 212 lines. parsePrUrl, buildReviewPayload, createGitHubReviewProvider with line+side fields |
| `server/src/services/code-review.ts` | Review orchestration service | VERIFIED | 220 lines. prepareReviewContext, submitReview, getReviewProvider with lazy import |
| `ui/src/components/WebhookEndpointList.tsx` | Webhook CRUD list | PARTIAL | 344 lines. Full CRUD UI with dialog form, test delivery, delivery log expansion. BUT: local EVENT_TYPES constant does not match backend WEBHOOK_EVENT_TYPES (4 of 6 types wrong). |
| `ui/src/components/WebhookDeliveryLog.tsx` | Delivery history table | VERIFIED | 109 lines. Expandable rows with payload preview and response body |
| `ui/src/components/SubtaskTree.tsx` | Subtask tree with dependencies | VERIFIED | 255 lines. Dependency labels, add/remove dependency, inline subtask creation |
| `ui/src/components/SkillProfileSelector.tsx` | Skill profile dropdown | VERIFIED | 99 lines. Auto-seed, builtin/custom separation, description display |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| webhook-dispatcher.ts | live-events.ts | subscribeCompanyLiveEvents | WIRED | Import line 5, usage line 114 |
| webhook-dispatcher.ts | webhooks.ts | webhookService.createDelivery | WIRED | Import line 6, usage line 85 |
| webhooks.ts | webhook_endpoints.ts | Drizzle ORM queries | WIRED | Import line 11, used in all CRUD methods |
| issues.ts | dependency-graph.ts | topologicalSort call | WIRED | Import line 23, used in listSubtasks/addDependency/getExecutionWaves |
| routes/issues.ts | services/issues.ts | subtask route handlers | WIRED | createSubtask, listSubtasks, addDependency, removeDependency, getExecutionWaves all called from routes |
| skill-profile-resolver.ts | types.ts | PipelineContext.skillProfile | WIRED | types.ts:46 declares field, processor reads ctx.skillProfile |
| heartbeat.ts | skill-profiles.ts | skillProfileService.getById | WIRED | Import line 35, usage lines 1477-1490, passed to pipeline at line 1514 |
| context-pipeline/index.ts | skill-profile-resolver.ts | defaultProcessors includes resolveSkillProfile | WIRED | Import line 6, position 2 in defaultProcessors array (after resolveTaskType, before serialize) |
| code-review.ts | review-providers/github.ts | createGitHubReviewProvider | WIRED | Import line 5, used in getReviewProvider |
| github-app.ts | code-review flow | Review issue creation in handleGitHubPrOpened | WIRED | Lines 735-789: finds reviewer agent, creates review issue, wakes agent |
| review-providers/github.ts | github-app.ts | generateInstallationToken | WIRED | Via code-review.ts getAuthenticatedGithubFetch which uses lazy import of githubAppService |
| WebhookEndpointList.tsx | api/webhooks.ts | TanStack Query CRUD | WIRED | webhooksApi used for list, create, update, remove, testDelivery |
| SubtaskTree.tsx | api/issues.ts | Subtask queries | WIRED | issuesApi.listSubtasks, createSubtask, addDependency, removeDependency |
| SkillProfileSelector.tsx | api/skillProfiles.ts | Profile list query | WIRED | skillProfilesApi.list, seed |
| CompanySettings.tsx | WebhookEndpointList.tsx | Webhooks section | WIRED | Import line 11, rendered at line 393 |
| IssueDetail.tsx | SubtaskTree.tsx | Sub-issues tab | WIRED | Import line 24, rendered at line 796 |
| AgentDetail.tsx | SkillProfileSelector.tsx | SkillProfileSection | WIRED | Import line 17, rendered via SkillProfileSection at line 1098 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| NOTF-01 | 04-01, 04-05 | Outgoing webhook system with configurable HTTP endpoints | PARTIAL | Backend fully implemented: CRUD API, HMAC signing, delivery. UI form presents wrong event types (4 of 6 missing). API-only usage works correctly. |
| NOTF-02 | 04-01 | Run failure alerting via configured webhook endpoints | SATISFIED | webhook-dispatcher maps run.failed, dispatches to subscribed endpoints. Auto-disable at 5 failures. Retry with exponential backoff. |
| NOTF-03 | 04-01 | Webhook event types: run.completed, run.failed, run.started, approval.requested, issue.created, issue.updated | SATISFIED | WEBHOOK_EVENT_TYPES constant in shared/constants.ts contains all 6 types. Dispatcher maps all 6 from live events. Tests verify all mappings. |
| AGNT-01 | 04-02, 04-05 | Task decomposition with subtasks, parent-child, dependency ordering | SATISFIED | issue_dependencies table, Kahn's topological sort, cycle detection, execution waves, 5 REST endpoints, SubtaskTree UI with dependency visualization |
| AGNT-02 | 04-03, 04-05 | Agent skill profiles (refactor, test-writer, reviewer, debugger) | SATISFIED | 6 predefined profiles, DB-backed CRUD, pipeline processor augments prompt, heartbeat resolves from runtimeConfig, SkillProfileSelector UI |
| AGNT-03 | 04-04 | Code review workflow: PR diffs, structured feedback, review comments | SATISFIED | ReviewProvider interface, GitHub implementation, code review orchestration, PR-opened triggers review issue creation, auto-post without approval gate |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| ui/src/components/WebhookEndpointList.tsx | 29-36 | EVENT_TYPES constant does not match backend WEBHOOK_EVENT_TYPES | WARNING | Operators cannot subscribe to run.completed, run.failed, run.started, approval.requested from UI. 4 phantom types shown that don't exist in backend. |

### Human Verification Required

### 1. End-to-End Webhook Delivery

**Test:** Create a webhook endpoint via the UI (after fixing event types), subscribe to run.failed, trigger a failed agent run, check that the endpoint receives a delivery.
**Expected:** Webhook receives POST with Standard Webhooks headers (webhook-id, webhook-timestamp, webhook-signature) and JSON payload with type=run.failed.
**Why human:** Requires running server, creating a failing run, and inspecting actual HTTP request.

### 2. Subtask Dependency Visualization

**Test:** Open an issue detail page, create multiple subtasks, add dependencies between them, attempt to create a cycle.
**Expected:** Subtasks render with dependency labels. Cycle attempt shows error. Topological ordering is visually correct.
**Why human:** Visual rendering of tree structure and error behavior.

### 3. Skill Profile Prompt Augmentation

**Test:** Assign a skill profile (e.g., Reviewer) to an agent, trigger a heartbeat run, inspect the assembled prompt.
**Expected:** The agent's system prompt includes "## Skill Profile: Reviewer" section with the reviewer's systemPromptAdditions.
**Why human:** Requires running a heartbeat cycle and inspecting internal prompt assembly.

### 4. Code Review PR-to-Issue Flow

**Test:** Open a PR in a GitHub repo connected to Paperclip with a reviewer-profile agent configured. Verify a review issue is created automatically.
**Expected:** New issue appears titled "Review: [PR title]" assigned to the reviewer agent with PR metadata in description.
**Why human:** Requires GitHub App webhook delivery and real PR interaction.

### Gaps Summary

There is one gap blocking full goal achievement:

**WebhookEndpointList EVENT_TYPES mismatch (Partial for Truth #1, NOTF-01):** The UI webhook creation form hardcodes event types that do not match the backend. The local `EVENT_TYPES` constant in `WebhookEndpointList.tsx` (lines 29-36) lists `[issue.created, issue.updated, issue.comment_added, agent.created, agent.updated, heartbeat.invoked]` instead of the backend's `WEBHOOK_EVENT_TYPES` which are `[run.completed, run.failed, run.started, approval.requested, issue.created, issue.updated]`. Only `issue.created` and `issue.updated` overlap. The fix is straightforward: replace the local constant with the correct 6 event types (ideally imported from `@paperclipai/shared`).

The backend is fully functional. The gap is purely in the UI presentation layer. Operators can still use the REST API directly to create webhook endpoints with the correct event types.

---

_Verified: 2026-03-12T10:05:00Z_
_Verifier: Claude (gsd-verifier)_
