# Phase 4: Notifications & Agent Capabilities - Research

**Researched:** 2026-03-11
**Domain:** Webhooks, task decomposition, agent skill profiles, code review workflow
**Confidence:** HIGH

## Summary

Phase 4 adds four major capabilities to Paperclip: (1) outgoing webhook notifications following the Standard Webhooks specification, (2) subtask decomposition with dependency graphs, (3) agent skill profiles that augment system prompts, and (4) a dedicated code review workflow using the GitHub API. The existing codebase provides strong foundations: the `publishLiveEvent()` event bus is the natural hook for webhook dispatch, the issues table already has a `parentId` column for subtask relationships, the `runtimeConfig` JSONB field on agents can store skill profiles, and the GitHub App service already handles PR webhooks and manages installation tokens.

The primary technical challenges are: designing the webhook delivery queue with retry semantics that survive server restarts, implementing cycle detection for subtask dependencies, and abstracting the code review provider interface so GitHub is the first but not only implementation.

**Primary recommendation:** Use a DB-backed webhook delivery queue (not in-process timers) to ensure retry persistence across restarts, implement Kahn's algorithm for dependency resolution with cycle detection, store skill profiles as DB records per company with a seed of six predefined profiles, and create a `ReviewProvider` interface that the GitHub implementation fulfills.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Both UI settings page + REST API for webhook endpoint management
- Follow Standard Webhooks spec (https://github.com/standard-webhooks/standard-webhooks) for payload format, signatures, and headers
- Retry with exponential backoff on delivery failure (1s, 10s, 60s, 5min, 30min). Auto-disable endpoint after consecutive failures
- Per-event subscription: each endpoint subscribes to specific event types (run.completed, run.failed, run.started, approval.requested, issue.created, issue.updated)
- Webhook config UI lives in Company Settings
- Delivery history/logs visible per endpoint for debugging
- Flat parent-child relationship: subtasks are regular issues with a parentIssueId column, reusing existing issue infrastructure
- Dependency graph between subtasks: subtasks can declare "depends on" other subtasks, enabling parallelism where no dependency exists
- Both operators and agents can create subtasks: operators via UI/API, agents via tool call (respects agent permissions)
- UI: expandable tree view on board and issue detail -- click parent to expand into subtask tree with dependency arrows
- Parent issue status derived from subtask states (e.g., blocked until dependencies resolve, done when all subtasks complete)
- Profiles extend (not replace) Phase 2 task-type routing -- task types select context per issue, skill profiles are per-agent persona overlays that augment the system prompt
- Six predefined profiles at launch: Refactor, Test Writer, Reviewer, Debugger, Architect, Documentation Writer
- Each profile defines: system prompt additions, tool preferences, output format expectations
- One active profile per agent, configured via agent settings (dropdown in UI, field in API). Stored in runtimeConfig JSONB
- Predefined + custom profiles: operators can create custom profiles with their own name, system prompt additions, and tool preferences. Custom profiles stored in DB per company
- GitHub webhook trigger: PR opened event (already handled by GitHub App) creates review issue with diff URL attached. Agent fetches diff via GitHub API using installation token
- Abstracted review provider interface: GitHub is first implementation, design allows GitLab/Bitbucket later
- Structured feedback format: inline comments with line references + overall summary (approve/request changes/comment) + severity per comment (critical/suggestion/nitpick). Maps to GitHub review API
- Auto-post reviews to GitHub -- no approval gate. Agent posts directly using installation token
- Context-aware reviews: agent receives PR description, all existing review comments (human and agent), and conversation thread -- avoids repeating feedback already given
- Incremental re-review on new pushes: agent receives previous review + diff since last review. Focuses on whether previous feedback was addressed + new issues in changed code

### Claude's Discretion
- Webhook delivery queue implementation (in-process vs DB-backed job queue)
- Subtask dependency resolution algorithm and cycle detection
- Exact system prompt additions per skill profile
- How to extract structured review comments from agent output (tool call vs output parsing)
- Review provider interface contract details
- How to diff between PR revisions for incremental review

### Deferred Ideas (OUT OF SCOPE)
- Agents self-improving prompt templates based on run outcomes -- v2 (carried from Phase 2)
- GitLab/Bitbucket review provider implementations -- v2 INTG-02
- Slack/email notification channels -- v2 INTG-01, INTG-03
- Parallel agent coordination on single issue -- v2 AGNT-04
- A/B testing prompt templates for effectiveness comparison -- v2 TOPT-07
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NOTF-01 | Outgoing webhook system allows users to configure arbitrary HTTP endpoints that receive structured event payloads | Standard Webhooks spec research, DB schema for webhook_endpoints + webhook_deliveries tables, REST API + UI patterns |
| NOTF-02 | Run failure alerting pushes notifications when agent runs fail or error, via configured webhook endpoints | Event-to-webhook mapping from publishLiveEvent pipeline, `run.failed` event type handling |
| NOTF-03 | Webhook event types include: run.completed, run.failed, run.started, approval.requested, issue.created, issue.updated | LIVE_EVENT_TYPES extension, event mapping table, Standard Webhooks payload format |
| AGNT-01 | Task decomposition allows breaking complex issues into subtasks with parent-child relationships and dependency ordering | Issues table already has parentId, new issue_dependencies table for edges, Kahn's algorithm for topological sort + cycle detection |
| AGNT-02 | Agent skills/persona library provides predefined skill profiles that shape agent prompt and behavior | skill_profiles table schema, runtimeConfig injection point in heartbeat.ts, pipeline context augmentation |
| AGNT-03 | Dedicated code review workflow where review-assigned agents receive PR diffs, produce structured feedback, and post review comments | GitHub Reviews API, ReviewProvider interface, diff fetching via installation token, structured output extraction |
</phase_requirements>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.38.4 | Database ORM, schema, migrations | Already used throughout -- all new tables follow same pattern |
| Express 5 | existing | REST API routes | Existing server framework |
| zod | existing | Request validation schemas | All existing validators use zod |
| node:crypto | built-in | HMAC-SHA256 for webhook signatures | Standard Webhooks requires HMAC-SHA256, already used in github-app.ts |
| TanStack Query | existing | UI data fetching | Existing pattern for all API calls |

### Supporting (No New Dependencies Needed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:crypto.randomBytes | built-in | Generate webhook signing secrets | When creating new webhook endpoints |
| node:crypto.createHmac | built-in | Sign webhook payloads | Already imported in github-app.ts |
| node:crypto.timingSafeEqual | built-in | Constant-time signature comparison | Consumer-side verification (we provide as utility) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| DB-backed retry queue | BullMQ / pg-boss | Adds Redis or complex dependency; DB-backed is simpler and sufficient for this scale |
| Custom topo sort | toposort npm package | 0-dependency, but Kahn's algorithm is ~30 lines and avoids external dep |
| Structured output parsing | Tool call for review output | Tool call is more reliable but requires adapter support; output parsing works with all adapters |

**Installation:**
```bash
# No new packages needed -- all functionality built on existing stack
```

## Architecture Patterns

### Recommended New Files Structure
```
packages/db/src/schema/
  webhook_endpoints.ts          # Webhook endpoint config per company
  webhook_deliveries.ts         # Delivery log with retry state
  issue_dependencies.ts         # Subtask dependency edges
  skill_profiles.ts             # Skill profile definitions per company

server/src/services/
  webhooks.ts                   # Webhook service (CRUD + delivery + retry)
  webhook-dispatcher.ts         # Event listener -> dispatch logic
  dependency-graph.ts           # Topological sort, cycle detection
  skill-profiles.ts             # Profile CRUD + resolution
  code-review.ts                # Review orchestration
  review-providers/
    types.ts                    # ReviewProvider interface
    github.ts                   # GitHub implementation

server/src/context-pipeline/processors/
  skill-profile-resolver.ts     # Pipeline processor for profile prompt injection

server/src/routes/
  webhooks.ts                   # REST endpoints for webhook CRUD + delivery log

ui/src/pages/
  CompanySettings.tsx           # Extended with Webhooks section
  IssueDetail.tsx               # Extended with subtask tree

ui/src/api/
  webhooks.ts                   # API client for webhooks
  skillProfiles.ts              # API client for skill profiles

ui/src/components/
  SubtaskTree.tsx               # Expandable tree with dependency visualization
  SkillProfileSelector.tsx      # Dropdown for agent settings
  WebhookEndpointList.tsx       # Webhook management UI
  WebhookDeliveryLog.tsx        # Delivery history per endpoint
```

### Pattern 1: DB-Backed Webhook Delivery Queue (RECOMMENDED)
**What:** Store each delivery attempt in a `webhook_deliveries` table with state tracking. A periodic sweep picks up pending/retryable deliveries.
**When to use:** Always -- this ensures retries survive server restarts.
**Why over in-process:** In-process timers (setTimeout) are lost on restart. The user's retry schedule (1s, 10s, 60s, 5m, 30m) spans 30+ minutes, making persistence essential.

```typescript
// Schema: webhook_deliveries table
export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  endpointId: uuid("endpoint_id").notNull().references(() => webhookEndpoints.id, { onDelete: "cascade" }),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  eventType: text("event_type").notNull(),         // e.g., "run.completed"
  payload: jsonb("payload").notNull(),              // Standard Webhooks JSON body
  status: text("status").notNull().default("pending"), // pending, succeeded, failed, disabled
  attemptCount: integer("attempt_count").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(5),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
  lastResponseStatus: integer("last_response_status"),
  lastResponseBody: text("last_response_body"),     // truncated for debugging
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Delivery retry sweep (runs on interval, e.g., every 5 seconds)
async function processRetryQueue(db: Db) {
  const due = await db.select().from(webhookDeliveries)
    .where(and(
      eq(webhookDeliveries.status, "pending"),
      lte(webhookDeliveries.nextAttemptAt, new Date()),
      lt(webhookDeliveries.attemptCount, webhookDeliveries.maxAttempts),
    ))
    .orderBy(asc(webhookDeliveries.nextAttemptAt))
    .limit(50); // batch size

  for (const delivery of due) {
    await attemptDelivery(db, delivery);
  }
}
```

### Pattern 2: Event-to-Webhook Bridge via publishLiveEvent
**What:** Subscribe to the existing `publishLiveEvent` EventEmitter and create webhook deliveries for matching subscriptions.
**When to use:** This is the integration point -- avoids modifying every event source.

```typescript
// webhook-dispatcher.ts
import { subscribeCompanyLiveEvents } from "./live-events.js";

// Map internal event types to webhook event types
const EVENT_TYPE_MAP: Record<string, string> = {
  "heartbeat.run.status": "run.status_changed", // maps to run.completed, run.failed, run.started
  "activity.logged": "activity",                 // maps to issue.created, issue.updated, etc.
};

// On server startup, subscribe a global listener
export function startWebhookDispatcher(db: Db) {
  // Listen to all companies -- filter by subscription
  // Alternative: subscribe per company as endpoints are registered
}
```

### Pattern 3: Subtask Dependency Graph with Kahn's Algorithm
**What:** Store dependency edges in `issue_dependencies` table. Use Kahn's BFS-based topological sort for ordering and cycle detection.
**When to use:** When creating/validating dependencies, determining execution order, and checking for cycles.

```typescript
// dependency-graph.ts
interface DependencyEdge {
  issueId: string;       // the issue that depends
  dependsOnId: string;   // the issue it depends on
}

/**
 * Kahn's algorithm: returns topological order or throws if cycle detected.
 * O(V + E) time complexity.
 */
function topologicalSort(issueIds: string[], edges: DependencyEdge[]): string[] {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const id of issueIds) {
    inDegree.set(id, 0);
    adj.set(id, []);
  }
  for (const edge of edges) {
    adj.get(edge.dependsOnId)?.push(edge.issueId);
    inDegree.set(edge.issueId, (inDegree.get(edge.issueId) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);
    for (const neighbor of adj.get(current) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  if (sorted.length !== issueIds.length) {
    throw new Error("Cycle detected in subtask dependencies");
  }
  return sorted;
}
```

### Pattern 4: Skill Profile Pipeline Processor
**What:** A new context pipeline processor that injects the agent's active skill profile prompt additions into the context.
**When to use:** Runs in the context pipeline before adapter execution, after task-type resolution.

```typescript
// skill-profile-resolver.ts
export function resolveSkillProfile(ctx: PipelineContext): PipelineContext {
  const profileId = ctx.agent.runtimeConfig?.skillProfileId;
  if (!profileId) return ctx;

  // Profile data loaded from DB and attached to context before pipeline runs
  const profile = ctx.agent.runtimeConfig?._resolvedSkillProfile as SkillProfile | undefined;
  if (!profile) return ctx;

  // Augment prompt template with profile additions
  const augmentedPrompt = profile.systemPromptAdditions
    ? `${ctx.promptTemplate}\n\n## Skill Profile: ${profile.name}\n${profile.systemPromptAdditions}`
    : ctx.promptTemplate;

  return { ...ctx, promptTemplate: augmentedPrompt };
}
```

### Pattern 5: GitHub Review Provider
**What:** Abstracted review provider interface with GitHub as first implementation.
**When to use:** When posting code reviews. The interface allows GitLab/Bitbucket later.

```typescript
// review-providers/types.ts
export interface ReviewComment {
  path: string;
  line: number;
  side: "LEFT" | "RIGHT";
  body: string;
  severity: "critical" | "suggestion" | "nitpick";
}

export interface ReviewResult {
  event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT";
  summary: string;
  comments: ReviewComment[];
}

export interface ReviewProvider {
  fetchDiff(prUrl: string): Promise<string>;
  fetchExistingReviews(prUrl: string): Promise<string>;
  submitReview(prUrl: string, review: ReviewResult): Promise<void>;
  compareDiff(prUrl: string, baseSha: string, headSha: string): Promise<string>;
}
```

### Anti-Patterns to Avoid
- **In-process retry timers for webhooks:** `setTimeout` chains are lost on server restart. The retry schedule (up to 30min) requires persistence. Use DB-backed queue.
- **Storing webhook secrets in plaintext:** Reuse the existing `encrypt()`/`decrypt()` pattern from `github-app.ts` for webhook signing secrets.
- **Direct dependency on publishLiveEvent payload shape:** The webhook payload should follow Standard Webhooks format, not mirror internal event payloads. Transform at the dispatcher layer.
- **Circular dependency references in subtasks:** Always validate via cycle detection before persisting dependency edges.
- **Coupling skill profiles to task types:** Skill profiles are orthogonal to task types. Both contribute to the prompt but serve different purposes (task type = what context to include; skill profile = how to behave).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HMAC-SHA256 signing | Custom crypto | `node:crypto.createHmac('sha256', secret)` | Already used in github-app.ts, battle-tested |
| Webhook ID generation | Custom UUID format | `crypto.randomUUID()` with `msg_` prefix per Standard Webhooks | Spec-compliant, simple |
| Diff parsing | Custom diff parser | Raw diff string passed to agent (agent handles interpretation) | Agent LLMs understand unified diff format natively |
| JSON serialization consistency | Custom serializer | `JSON.stringify()` with stable key ordering | Sign the exact bytes you send |

**Key insight:** The Standard Webhooks spec is intentionally simple -- HMAC-SHA256 over `{msg_id}.{timestamp}.{body}`. Node's built-in crypto is sufficient; no webhook library is needed.

## Common Pitfalls

### Pitfall 1: Webhook Signature Mismatch Due to JSON Re-serialization
**What goes wrong:** Signing a JSON string, then re-serializing the payload before sending, produces different bytes.
**Why it happens:** `JSON.stringify()` may produce different output if the object was parsed and re-serialized.
**How to avoid:** Sign the exact bytes that will be sent. Serialize once, sign that string, send that string.
**Warning signs:** Consumers report signature verification failures despite correct secrets.

### Pitfall 2: Webhook Retry Storm on Bulk Operations
**What goes wrong:** A bulk operation (e.g., closing all subtasks) triggers dozens of webhook deliveries simultaneously, overwhelming both the queue and the target endpoint.
**Why it happens:** Each status change fires a live event, each event creates a delivery.
**How to avoid:** Batch processing in the retry sweep (already addressed by LIMIT on the query). Consider rate limiting per endpoint.
**Warning signs:** Target endpoints returning 429 Too Many Requests.

### Pitfall 3: Subtask Cycle Detection Race Condition
**What goes wrong:** Two concurrent requests each add a dependency edge that, combined, creates a cycle, but neither request detects it alone.
**Why it happens:** Cycle detection reads current edges, but another request may insert edges between read and write.
**How to avoid:** Use a database transaction with row-level locks on the parent issue's subtask edges when inserting new dependencies. Alternatively, use a serializable transaction for dependency mutations.
**Warning signs:** Topological sort failures at execution time despite passing validation at creation time.

### Pitfall 4: GitHub Review Position Calculation
**What goes wrong:** The `position` field in GitHub Review API refers to the line index within the diff hunk, not the file line number. Agents naturally think in file line numbers.
**Why it happens:** The GitHub API uses diff-relative positioning. `position` is the number of lines from the first `@@` hunk header.
**How to avoid:** Parse the diff to build a mapping from file line numbers to diff positions. Alternatively, use the newer `line` + `side` fields (available since 2022) which accept file line numbers directly.
**Warning signs:** Comments appearing on wrong lines or API returning 422 errors.

### Pitfall 5: Webhook Endpoint Disable-and-Forget
**What goes wrong:** An endpoint is auto-disabled after consecutive failures, but no one notices.
**Why it happens:** No notification mechanism for disabled endpoints (ironic, since this IS the notification system).
**How to avoid:** Log endpoint disabling as an activity event. Show disabled status prominently in the UI. Consider a reactivation mechanism with a test delivery.
**Warning signs:** Operators complaining they stopped receiving notifications without knowing why.

### Pitfall 6: Skill Profile Prompt Injection Order
**What goes wrong:** Skill profile additions are inserted at the wrong position in the prompt, either getting truncated or interfering with existing instructions.
**Why it happens:** The context pipeline has a specific ordering, and skill profiles need to be injected at the right stage.
**How to avoid:** Insert skill profile additions as a clearly delineated section (with XML-like tags or markdown headers) after the base prompt template but before issue-specific context. Run the processor after task-type resolution but before serialization.
**Warning signs:** Agent behavior not changing with profile selection, or profile instructions overriding core behavior.

## Code Examples

### Standard Webhooks Payload and Signature

```typescript
// Source: Standard Webhooks Spec (https://github.com/standard-webhooks/standard-webhooks)
import { createHmac, randomUUID } from "node:crypto";

interface WebhookPayload {
  type: string;              // e.g., "run.completed"
  timestamp: string;         // ISO 8601
  data: Record<string, unknown>;
}

function signPayload(
  msgId: string,
  timestamp: number,
  body: string,
  secret: Buffer,  // raw bytes, NOT base64-encoded
): string {
  const content = `${msgId}.${timestamp}.${body}`;
  const sig = createHmac("sha256", secret).update(content).digest("base64");
  return `v1,${sig}`;
}

function buildWebhookHeaders(msgId: string, body: string, secretBase64: string) {
  // Standard Webhooks secrets are base64-encoded with "whsec_" prefix
  const raw = secretBase64.startsWith("whsec_")
    ? secretBase64.slice(6)
    : secretBase64;
  const secret = Buffer.from(raw, "base64");
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signPayload(msgId, timestamp, body, secret);

  return {
    "webhook-id": msgId,
    "webhook-timestamp": String(timestamp),
    "webhook-signature": signature,
    "content-type": "application/json",
  };
}
```

### GitHub Review API

```typescript
// Source: https://docs.github.com/en/rest/pulls/reviews
// POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews

interface GitHubReviewRequest {
  commit_id?: string;  // SHA of commit to review (latest if omitted)
  body: string;        // Review summary
  event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT";
  comments: Array<{
    path: string;      // File path relative to repo root
    line: number;      // File line number (not diff position) -- use with side
    side: "LEFT" | "RIGHT";  // LEFT = deletion, RIGHT = addition/context
    body: string;      // Comment text (supports markdown)
  }>;
}

// Get PR diff using Accept header
// GET /repos/{owner}/{repo}/pulls/{pull_number}
// Accept: application/vnd.github.diff
// Returns: unified diff string

// Compare commits for incremental review
// GET /repos/{owner}/{repo}/compare/{base}...{head}
// Accept: application/vnd.github.diff
// Returns: diff between two commits
```

### Webhook Endpoint Schema

```typescript
// packages/db/src/schema/webhook_endpoints.ts
export const webhookEndpoints = pgTable("webhook_endpoints", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  url: text("url").notNull(),
  description: text("description"),
  secretEncrypted: text("secret_encrypted").notNull(),  // whsec_... encrypted via encrypt()
  eventTypes: jsonb("event_types").$type<string[]>().notNull(), // subscribed event types
  enabled: boolean("enabled").notNull().default(true),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  disabledAt: timestamp("disabled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### Issue Dependencies Schema

```typescript
// packages/db/src/schema/issue_dependencies.ts
export const issueDependencies = pgTable(
  "issue_dependencies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    issueId: uuid("issue_id").notNull().references(() => issues.id, { onDelete: "cascade" }),
    dependsOnId: uuid("depends_on_id").notNull().references(() => issues.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueEdge: uniqueIndex("issue_dependencies_unique_idx").on(table.issueId, table.dependsOnId),
    issueIdx: index("issue_dependencies_issue_idx").on(table.issueId),
    dependsOnIdx: index("issue_dependencies_depends_on_idx").on(table.dependsOnId),
  }),
);
```

### Skill Profile Schema

```typescript
// packages/db/src/schema/skill_profiles.ts
export const skillProfiles = pgTable(
  "skill_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    slug: text("slug").notNull(),  // e.g., "refactor", "test-writer"
    description: text("description"),
    systemPromptAdditions: text("system_prompt_additions").notNull(),
    toolPreferences: jsonb("tool_preferences").$type<Record<string, unknown>>(),
    outputFormatHints: text("output_format_hints"),
    isBuiltin: boolean("is_builtin").notNull().default(false),  // predefined vs custom
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companySlugIdx: uniqueIndex("skill_profiles_company_slug_idx").on(table.companyId, table.slug),
    companyIdx: index("skill_profiles_company_idx").on(table.companyId),
  }),
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom webhook formats per service | Standard Webhooks spec | 2023-2024 adoption wave | Interoperable, consumers can reuse verification libraries |
| GitHub Review API `position` field | `line` + `side` fields | 2022 | File-relative line numbers instead of diff-relative positions |
| In-process retry timers | DB-backed queues | Industry standard | Survives restarts, scales horizontally |

**Deprecated/outdated:**
- GitHub Review API `position` field: Still works but `line` + `side` is preferred -- avoids the diff-position calculation complexity

## Existing Code Integration Points

### Live Events to Webhook Bridge
The `publishLiveEvent()` function in `server/src/services/live-events.ts` uses an in-process EventEmitter scoped by companyId. The webhook dispatcher should subscribe to this same emitter to receive all events, then filter by endpoint subscriptions.

**Key insight:** The current `LIVE_EVENT_TYPES` array needs extending with webhook-specific event types. The mapping is:
| Live Event Type | Webhook Event Type |
|----------------|-------------------|
| `heartbeat.run.status` (payload.status = "running") | `run.started` |
| `heartbeat.run.status` (payload.status = "succeeded") | `run.completed` |
| `heartbeat.run.status` (payload.status = "failed") | `run.failed` |
| `activity.logged` (action = "issue.created") | `issue.created` |
| `activity.logged` (action = "issue.updated") | `issue.updated` |
| `activity.logged` (action = "approval.created") | `approval.requested` |

### GitHub App Service for Code Review
`server/src/services/github-app.ts` already:
- Handles `pull_request` opened events via `handleGitHubPrOpened()`
- Creates Paperclip issues from PRs with `externalUrl` pointing to PR
- Manages installation tokens via `generateInstallationToken()`
- Has `githubFetch()` helper with proper headers

For code review, extend `handleGitHubPrOpened()` to:
1. Detect if the PR should be reviewed (based on project config or agent assignment)
2. Create a review-type issue (with a "review" label)
3. Attach diff URL and PR metadata
4. Wake a review-profile agent

### Heartbeat Prompt Injection
`server/src/services/heartbeat.ts` at line ~1466 reads `resolvedConfig.promptTemplate`. The context pipeline (`runContextPipeline()`) runs at line ~1495. Skill profiles should be resolved before the pipeline runs, injecting the profile's `systemPromptAdditions` into `promptTemplate` or as a separate field in the pipeline context.

### Issues Table parentId
The `issues` table already has `parentId: uuid("parent_id").references(() => issues.id)` with an index `issues_company_parent_idx`. Subtasks use this existing column. The new `issue_dependencies` table adds the dependency graph on top.

### Agent runtimeConfig JSONB
`packages/db/src/schema/agents.ts` defines `runtimeConfig: jsonb("runtime_config").$type<Record<string, unknown>>()`. Skill profile selection stores as `runtimeConfig.skillProfileId`. The heartbeat service already passes `runtimeConfig` through the pipeline context.

## Open Questions

1. **Webhook dispatch granularity for run status events**
   - What we know: `heartbeat.run.status` fires for every status change (queued, running, succeeded, failed, cancelled, timed_out)
   - What's unclear: Should `run.started` fire on `queued` or `running`? (Recommendation: `running` -- that is when the agent actually starts executing)
   - Recommendation: Map `running` -> `run.started`, `succeeded` -> `run.completed`, `failed`/`timed_out` -> `run.failed`

2. **Consecutive failure threshold for auto-disable**
   - What we know: User wants auto-disable after consecutive failures
   - What's unclear: Exact threshold number
   - Recommendation: 5 consecutive failures (matches the 5 retry attempts). After 5 delivery attempts all fail for 5 consecutive events = disable.

3. **Review agent structured output extraction**
   - What we know: Agent needs to produce structured review comments
   - What's unclear: Whether to use a dedicated tool call or parse from agent output
   - Recommendation: Define a tool call (e.g., `submit_review`) that the agent invokes with structured data. This is more reliable than output parsing and works with all adapters that support tool calls. The tool definition becomes part of the review skill profile's tool preferences.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^3.0.5 |
| Config file | `server/vitest.config.ts`, `ui/vitest.config.ts` |
| Quick run command | `pnpm vitest run --reporter=verbose` |
| Full suite command | `pnpm test:run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NOTF-01 | Webhook CRUD + signature generation + delivery | unit | `pnpm vitest run server/src/__tests__/webhooks.test.ts -x` | Wave 0 |
| NOTF-02 | Run failure triggers webhook delivery for subscribed endpoints | unit | `pnpm vitest run server/src/__tests__/webhook-dispatcher.test.ts -x` | Wave 0 |
| NOTF-03 | Event type mapping from live events to webhook types | unit | `pnpm vitest run server/src/__tests__/webhook-dispatcher.test.ts -x` | Wave 0 |
| AGNT-01 | Dependency graph cycle detection + topological sort | unit | `pnpm vitest run server/src/__tests__/dependency-graph.test.ts -x` | Wave 0 |
| AGNT-02 | Skill profile resolution + prompt injection | unit | `pnpm vitest run server/src/__tests__/skill-profile-resolver.test.ts -x` | Wave 0 |
| AGNT-03 | Review provider interface + GitHub implementation | unit | `pnpm vitest run server/src/__tests__/code-review.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm vitest run --reporter=verbose`
- **Per wave merge:** `pnpm test:run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `server/src/__tests__/webhooks.test.ts` -- covers NOTF-01 (endpoint CRUD, signature signing, delivery logic)
- [ ] `server/src/__tests__/webhook-dispatcher.test.ts` -- covers NOTF-02, NOTF-03 (event mapping, dispatch filtering)
- [ ] `server/src/__tests__/dependency-graph.test.ts` -- covers AGNT-01 (topological sort, cycle detection, edge validation)
- [ ] `server/src/__tests__/skill-profile-resolver.test.ts` -- covers AGNT-02 (prompt augmentation, profile resolution)
- [ ] `server/src/__tests__/code-review.test.ts` -- covers AGNT-03 (review provider interface, structured output)
- [ ] DB migration for new tables (webhook_endpoints, webhook_deliveries, issue_dependencies, skill_profiles)

## Sources

### Primary (HIGH confidence)
- Standard Webhooks Spec: https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md -- headers, signature algorithm, retry schedule, payload format
- GitHub REST API Pull Request Reviews: https://docs.github.com/en/rest/pulls/reviews -- endpoint format, parameters, event values
- GitHub REST API Pull Request Review Comments: https://docs.github.com/en/rest/pulls/comments -- inline comment structure
- Existing codebase: `server/src/services/live-events.ts`, `server/src/services/github-app.ts`, `server/src/services/heartbeat.ts`, `packages/db/src/schema/issues.ts`, `packages/db/src/schema/agents.ts`

### Secondary (MEDIUM confidence)
- GitHub Compare API for incremental diffs: https://docs.github.com/en/rest/commits/commits -- compare endpoint for base...head diffs
- Kahn's algorithm for topological sort: standard CS algorithm, well-documented, verified against multiple sources

### Tertiary (LOW confidence)
- Exact retry timing behavior under heavy load -- depends on sweep interval tuning (recommend 5-second interval, adjust empirically)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies needed, all built on existing patterns
- Architecture: HIGH - integration points clearly identified in existing code, schemas designed
- Pitfalls: HIGH - Standard Webhooks spec is well-documented, GitHub API is mature, codebase patterns are established
- Code review workflow: MEDIUM - GitHub API `line`/`side` fields for review comments need testing with actual PR diffs to confirm edge cases

**Research date:** 2026-03-11
**Valid until:** 2026-04-10 (stable -- Standard Webhooks spec and GitHub API are mature)
