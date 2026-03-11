# Phase 2: Context Optimization Pipeline - Research

**Researched:** 2026-03-10
**Domain:** Token optimization via context serialization, compression, budget enforcement, task-type routing, and prompt cache awareness
**Confidence:** MEDIUM-HIGH

## Summary

Phase 2 transforms the Paperclip agent execution pipeline from one that passes raw, verbose context to agents into one that serializes, compresses, routes, budgets, and cache-optimizes that context. The work divides into five distinct capabilities -- each mapping to a requirement -- that share a common insertion point: the `executeRun()` codepath in `heartbeat.ts` between context resolution (line ~1095) and adapter invocation (line ~1416).

The architecture is additive. Existing adapter interfaces (`ServerAdapterModule`, `AdapterExecutionContext`) remain untouched. New modules intercept the context before it reaches the adapter, apply transformations, and pass the result through. The biggest technical consideration is that Paperclip's Claude adapter runs the Claude CLI (`claude --print`), not the Anthropic API directly. This means the compaction API (`compact-2026-01-12`) must be configured through Claude Code's environment variables (`CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`) rather than raw API parameters. Prompt caching, however, is handled by Claude Code internally when prompts are structured with stable prefixes -- Paperclip controls this through how it orders the prompt template and `--append-system-prompt-file` content.

The standard approach is: build a context pipeline module with ordered processors, implement budget tracking in the heartbeat loop, add task-type detection from issue labels, create template variants per task type, and restructure prompt assembly order for cache hits. All capabilities produce measurable outcomes visible in Phase 1's existing analytics (token counts, cached tokens, cost tracking).

**Primary recommendation:** Build a `server/src/context-pipeline/` module with a processor chain pattern. Each TOPT requirement maps to one or two processors. Insert the pipeline call between context resolution and adapter invocation in `heartbeat.ts`. Extend existing types and UI components for budget visualization and cache analytics.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Serialization (TOPT-01):** Two-layer approach -- Paperclip compacts initial context (structured brief), Anthropic compaction API handles conversation history
  - Structured brief: issue title (full), description truncated to ~2K chars, last 3 comments each truncated to ~500 chars, triggering comment in full, strip orchestration metadata
  - Target: 40-70% reduction in formatting waste for initial context
- **Compaction (TOPT-04):** Use Anthropic server-side compaction API (beta header `compact-2026-01-12`) for multi-turn conversation history management. Supported on Sonnet 4.6 and Opus 4.6. No custom summarization logic needed.
- **Budget enforcement (TOPT-02):** Three-tier hierarchy: per-run override > per-agent default > per-project default. Graceful wind-down at ~90% of budget (inject system message to wrap up). Do NOT hard-kill. Live budget bar in UI extending Phase 1's live token counter.
- **Task-type routing (TOPT-03):** Four task types (bug, feature, review, refactor) determined from issue labels. Fallback: auto-detect from issue content with generic template for low confidence. System-defined defaults + operator overrides per agent/project.
- **Prompt caching (TOPT-05):** 4-layer prompt structure (static system + tools, project context, task template + issue context, conversation messages). Tool definitions sorted in stable order. Natural 5-minute TTL expiration. Cache hit rates tracked in analytics.

### Claude's Discretion
- Exact serialization format details (JSON structure, field ordering, whitespace handling)
- Token estimation adjustments for compressed vs uncompressed content
- Auto-detection heuristics for task type inference from issue content
- How to structure the compaction API integration within the heartbeat loop

### Deferred Ideas (OUT OF SCOPE)
- Agents self-improving prompt templates based on run outcomes -- Phase 4 AGNT-02
- A/B testing prompt templates for effectiveness comparison -- v2 TOPT-07
- Model routing by task complexity -- v2 TOPT-06
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TOPT-01 | Data serialization optimization compacts issue context, file summaries, and conversation history before sending to agents (targeting 40-70% reduction) | Context serializer processor in pipeline; structured brief format; whitespace stripping; measured via Phase 1 token breakdown |
| TOPT-02 | Per-run token budget cap with graceful early termination when budget is reached | Budget enforcer in heartbeat loop; three-tier config hierarchy; 90% wind-down threshold; budget bar UI component extending ContextUtilizationBar |
| TOPT-03 | Smart prompt templates per task type that include only relevant context | Task-type resolver from issue labels; four template variants; label-to-type mapping in DB; template override config on agents/projects |
| TOPT-04 | Context compression pipeline with deduplication, rolling summaries, and history compaction (targeting 40-60% token reduction) | Claude Code auto-compaction via `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` env var; structured brief eliminates redundancy; deduplication processor strips repeated context |
| TOPT-05 | Prompt caching awareness -- structure prompts to maximize Anthropic prompt cache hits (90% savings on cached input) | 4-layer prompt ordering; stable tool definitions; `--append-system-prompt-file` for static system content; cache hit rate display in Costs page |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM (existing) | current | Schema migrations for budget fields, task-type config | Already used throughout; `packages/db/src/schema/` pattern established |
| Vitest (existing) | current | Unit tests for pipeline processors, serializer, budget logic | Already configured at `server/vitest.config.ts` |
| React Query / TanStack Query (existing) | current | Live budget bar state via `setQueryData` | Phase 1 pattern: `heartbeat.run.usage` events update React Query cache |
| Express 5 (existing) | current | API routes for budget config, template management | All server routes follow existing Express patterns |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| No new dependencies | - | All Phase 2 work uses existing stack | Serialization, budget, routing, and caching are all logic-only changes |

**Installation:**
```bash
# No new packages needed. All Phase 2 work is within existing dependencies.
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom serializer | `msgpack` / `protobuf` | Overkill -- context is passed as stdin text to CLI, not binary. JSON compaction with whitespace removal is sufficient |
| Custom history summarizer | LLM-based summarization via API | Costs tokens to save tokens; Claude Code's built-in compaction handles this server-side for free |
| Custom caching layer | Redis prompt cache | Anthropic handles prefix caching automatically -- no client-side cache needed |

## Architecture Patterns

### Recommended Project Structure

```
server/src/
  context-pipeline/
    index.ts                    # Pipeline runner + processor chain
    processors/
      context-serializer.ts     # TOPT-01: Structured brief format
      deduplicator.ts           # TOPT-04: Remove redundant context
      task-type-resolver.ts     # TOPT-03: Detect task type from labels/content
      prompt-reorderer.ts       # TOPT-05: 4-layer cache-optimized ordering
    types.ts                    # Pipeline context types
  services/
    token-estimation.ts         # EXTEND: compressed context measurement
    budget.ts                   # TOPT-02: Budget resolution + enforcement
    costs.ts                    # EXTEND: cache efficiency metrics
    heartbeat.ts                # MODIFY: insert pipeline, budget checks
packages/shared/src/types/
    usage.ts                    # EXTEND: budget fields
    task-types.ts               # NEW: task type enum, template types
packages/db/src/schema/
    agents.ts                   # EXTEND: budget config fields
    projects.ts                 # EXTEND: default budget
    prompt-templates.ts         # NEW: task-type template storage
ui/src/components/
    BudgetBar.tsx               # NEW: budget progress bar (extends ContextUtilizationBar pattern)
    TaskTypeBadge.tsx            # NEW: task type indicator
ui/src/pages/
    Costs.tsx                   # EXTEND: cache hit rate metric
```

### Pattern 1: Context Pipeline (Processor Chain)

**What:** An ordered array of processor functions that transform the execution context before it reaches the adapter. Each processor receives the full pipeline context and returns a modified version.
**When to use:** Every agent run passes through the pipeline.

```typescript
// server/src/context-pipeline/types.ts
interface PipelineContext {
  agent: AdapterAgent;
  config: Record<string, unknown>;
  context: Record<string, unknown>;  // the contextSnapshot
  taskType: TaskType | null;
  budget: BudgetConfig | null;
  promptTemplate: string;
  instructionsContent: string | null;
  issueLabels: string[];
  issue: { title: string; description: string | null; comments: IssueComment[] } | null;
  metrics: {
    originalTokenEstimate: number;
    compressedTokenEstimate: number;
    compressionRatio: number;
  };
}

type Processor = (ctx: PipelineContext) => PipelineContext;

// server/src/context-pipeline/index.ts
function runPipeline(
  input: PipelineContext,
  processors: Processor[]
): PipelineContext {
  return processors.reduce((ctx, proc) => proc(ctx), input);
}

const defaultProcessors: Processor[] = [
  resolveTaskType,      // TOPT-03: detect task type from labels
  serializeContext,     // TOPT-01: structured brief format
  deduplicateContext,   // TOPT-04: remove redundant data
  reorderForCaching,    // TOPT-05: stable prefix ordering
];
```

### Pattern 2: Three-Tier Budget Resolution

**What:** Budget resolved from most-specific to least-specific source.
**When to use:** At pipeline start and monitored throughout execution via usage tracker.

```typescript
// server/src/services/budget.ts
interface BudgetConfig {
  maxTokens: number | null;  // null = no budget
  source: 'run' | 'agent' | 'project' | 'none';
  windDownThreshold: number;  // 0.9 = 90%
}

function resolveBudget(params: {
  runOverride: number | null;
  agentDefault: number | null;
  projectDefault: number | null;
}): BudgetConfig {
  if (params.runOverride != null && params.runOverride > 0) {
    return { maxTokens: params.runOverride, source: 'run', windDownThreshold: 0.9 };
  }
  if (params.agentDefault != null && params.agentDefault > 0) {
    return { maxTokens: params.agentDefault, source: 'agent', windDownThreshold: 0.9 };
  }
  if (params.projectDefault != null && params.projectDefault > 0) {
    return { maxTokens: params.projectDefault, source: 'project', windDownThreshold: 0.9 };
  }
  return { maxTokens: null, source: 'none', windDownThreshold: 0.9 };
}
```

### Pattern 3: Task-Type Template Selection

**What:** Issue labels map to task types; each type has a distinct prompt template.
**When to use:** During pipeline processing, after issue context is loaded.

```typescript
// packages/shared/src/types/task-types.ts
type TaskType = 'bug_fix' | 'feature' | 'review' | 'refactor' | 'generic';

// Label-to-type mapping (configurable per company)
const DEFAULT_LABEL_MAPPING: Record<string, TaskType> = {
  bug: 'bug_fix',
  fix: 'bug_fix',
  feature: 'feature',
  enhancement: 'feature',
  review: 'review',
  'code review': 'review',
  refactor: 'refactor',
  refactoring: 'refactor',
};

// Auto-detection heuristics when no label matches
function inferTaskType(issue: { title: string; description: string | null }): TaskType | null {
  const text = `${issue.title} ${issue.description ?? ''}`.toLowerCase();
  if (/\b(bug|fix|error|crash|broken|regression)\b/.test(text)) return 'bug_fix';
  if (/\b(add|implement|create|build|new feature)\b/.test(text)) return 'feature';
  if (/\b(review|pr|pull request|feedback)\b/.test(text)) return 'review';
  if (/\b(refactor|clean up|reorganize|restructure)\b/.test(text)) return 'refactor';
  return null;  // low confidence -> use generic
}
```

### Pattern 4: Structured Brief Serialization

**What:** Compact the contextSnapshot into a minimal structured brief that removes formatting waste.
**When to use:** TOPT-01 processor in the pipeline.

```typescript
// server/src/context-pipeline/processors/context-serializer.ts
interface StructuredBrief {
  issueTitle: string;
  description: string;          // truncated to ~2K chars
  recentComments: string[];     // last 3, each truncated to ~500 chars
  triggeringComment: string;    // full text
  taskType: TaskType | null;
  // NO: timestamps, internal IDs, orchestration metadata
}

function serializeToStructuredBrief(
  issue: IssueWithComments,
  triggeringCommentId: string | null,
): StructuredBrief {
  const triggeringComment = triggeringCommentId
    ? issue.comments.find(c => c.id === triggeringCommentId)
    : null;

  const otherComments = issue.comments
    .filter(c => c.id !== triggeringCommentId)
    .slice(-3);  // last 3

  return {
    issueTitle: issue.title,
    description: truncate(issue.description ?? '', 2000),
    recentComments: otherComments.map(c => truncate(c.body, 500)),
    triggeringComment: triggeringComment?.body ?? '',
    taskType: null,  // filled by task-type resolver
  };
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 3) + '...';
}
```

### Anti-Patterns to Avoid

- **Modifying the adapter interface:** All optimization must be invisible to adapters. They receive pre-optimized context through the same `AdapterExecutionContext` shape.
- **Building custom conversation summarization:** Claude Code handles compaction internally. Building a parallel summarization system wastes effort and creates competing compression.
- **Hard-killing agent processes at budget limit:** Agents must finish their current step cleanly. The wind-down message gives the agent one more turn to commit work.
- **Optimizing the prompt template text itself:** The prompt template is tiny (~50 tokens). The real savings come from context serialization and cache hits, not prompt wordsmithing.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Conversation history compaction | Custom LLM-based summarizer | Claude Code's built-in auto-compaction (`CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` env var) | Claude Code handles this server-side; building a parallel system wastes tokens and creates competing compressions |
| Prompt prefix caching | Client-side prompt cache | Anthropic's automatic prefix caching | Anthropic caches KV representations automatically when prefixes match; no client-side cache needed |
| Token counting for compressed content | Exact tokenizer integration | Existing `estimateTokens()` heuristic (chars/4) | The heuristic is good enough for budget enforcement; exact counting adds latency and complexity for marginal accuracy gain |
| Cache invalidation logic | TTL management / proactive invalidation | Anthropic's natural 5-minute TTL | Cache invalidation is notoriously hard; Anthropic manages this; no proactive invalidation needed |

**Key insight:** The Claude CLI adapter means Paperclip controls context BEFORE it reaches Claude, but Claude Code manages the conversation DURING execution. Paperclip optimizes the input; Claude Code optimizes the runtime.

## Common Pitfalls

### Pitfall 1: Confusing Anthropic API Compaction with Claude Code Auto-Compaction

**What goes wrong:** The CONTEXT.md references the Anthropic compaction API (`compact-2026-01-12`), but Paperclip's Claude adapter runs the CLI (`claude --print`), not the API directly. Attempting to pass `context_management` parameters to the CLI will fail.
**Why it happens:** The compaction API is for direct API usage. Claude Code CLI handles compaction internally.
**How to avoid:** For the `claude_local` adapter, configure compaction via the `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` environment variable injected into the adapter's env. This is set in `buildClaudeRuntimeConfig()` where env vars are assembled (execute.ts line ~199). The compaction API parameters would only apply if/when a direct API adapter is built.
**Warning signs:** Agent runs timing out or erroring with unknown parameters.

### Pitfall 2: Budget Enforcement Race Condition with Async Usage Updates

**What goes wrong:** Usage data arrives via debounced WebSocket events (2-second intervals per `createUsageTracker`). Budget checks based on stale usage data may trigger wind-down too late or too early.
**Why it happens:** The usage tracker processes Claude's stream-json output and emits at 2-second intervals. Between emissions, the actual token count may exceed the budget.
**How to avoid:** Budget enforcement should use the usage tracker's cumulative state (not just emitted values). Add a `checkBudget()` method to the tracker that compares `getCurrent()` against the budget threshold on every `processChunk()` call, not just on emit intervals.
**Warning signs:** Agents running significantly past budget before wind-down triggers.

### Pitfall 3: Template Routing Breaks Session Resume

**What goes wrong:** When an agent's task type changes between sessions (e.g., same issue goes from "feature" to "review"), the prompt prefix changes, which invalidates Claude Code's session state.
**Why it happens:** Session resume (`--resume sessionId`) expects consistent prompt structure. Changing the template between heartbeats changes the system prompt, which Claude Code may handle poorly.
**How to avoid:** Task type should be determined once per issue lifecycle, not per heartbeat. Store the resolved task type on the issue or run record. When resuming a session, use the same task type as the original run.
**Warning signs:** Session resume failures, agents re-reading context they already had.

### Pitfall 4: Structured Brief Loses Critical Context for Bug Fixes

**What goes wrong:** Truncating description to 2K chars and comments to 500 chars may cut off error stacktraces, reproduction steps, or code snippets that are essential for bug fix tasks.
**Why it happens:** Fixed truncation limits don't account for content type.
**How to avoid:** Task-type-aware truncation limits. Bug fix templates should allow longer descriptions (4K) and preserve code blocks. Feature templates can truncate more aggressively. Review templates should include the PR diff URL/reference rather than full diff text.
**Warning signs:** Agents asking for context that was truncated, increasing tool call tokens to re-fetch information.

### Pitfall 5: Cache Hit Rate Metric Conflates CLI and API Caching

**What goes wrong:** The `cachedInputTokens` field from Claude's stream-json reflects Claude Code's internal caching behavior, not Paperclip's prompt structuring efforts. Operators may attribute cache improvements to Paperclip changes when they're actually Claude Code version changes.
**Why it happens:** Paperclip cannot directly control prefix caching -- it's handled by the Claude CLI's API calls. Paperclip can only influence it indirectly by keeping prompts stable.
**How to avoid:** Display cache hit rates with a note that they reflect the full stack (Paperclip + Claude Code + Anthropic API). Track the compression ratio (original vs. serialized context tokens) as the metric Paperclip directly controls. Both metrics are valuable but measure different things.
**Warning signs:** Cache hit rates varying wildly without any Paperclip changes.

### Pitfall 6: Budget Wind-Down Message Ignored by Agent

**What goes wrong:** Injecting a "wrap up" system message at 90% budget doesn't guarantee the agent will actually wrap up. The agent may continue its current task and blow through the budget.
**Why it happens:** Claude Code sessions are autonomous -- Paperclip can inject messages but can't force behavior. The `--max-turns` flag is the actual enforcement mechanism.
**How to avoid:** The wind-down strategy should be two-pronged: (1) inject the system message as a warning, (2) use a reduced `--max-turns` for the remaining budget to hard-cap turns. The graceful wind-down is advisory; the max-turns limit is the enforcement. However, since `maxTurns` is set at CLI invocation time and cannot be changed mid-run, enforcement must rely on the existing timeout mechanism or waiting for the CLI to exit naturally.
**Warning signs:** Agents consistently exceeding budget by more than 15%.

## Code Examples

### Integration Point: Pipeline Insertion in Heartbeat

```typescript
// server/src/services/heartbeat.ts (around line ~1405)
// BEFORE: direct adapter invocation
// AFTER: pipeline transforms context first

import { runContextPipeline, defaultProcessors } from '../context-pipeline/index.js';
import { resolveBudget } from './budget.js';

// ... existing code to build context, promptTemplate, etc. ...

// NEW: Resolve budget
const budget = resolveBudget({
  runOverride: asNumber(run.contextSnapshot?.tokenBudget, 0) || null,
  agentDefault: asNumber(agent.runtimeConfig?.tokenBudget, 0) || null,
  projectDefault: projectBudget,
});

// NEW: Run context pipeline
const pipelineResult = runContextPipeline({
  agent,
  config: resolvedConfig,
  context,
  taskType: null,  // resolved by pipeline
  budget,
  promptTemplate,
  instructionsContent,
  issueLabels: issueLabels ?? [],
  issue: issueForPipeline,
  metrics: { originalTokenEstimate: 0, compressedTokenEstimate: 0, compressionRatio: 1 },
}, defaultProcessors);

// Use pipeline-transformed values for adapter invocation
const optimizedContext = pipelineResult.context;
const optimizedPromptTemplate = pipelineResult.promptTemplate;
```

### Budget Bar UI Component

```typescript
// ui/src/components/BudgetBar.tsx
// Extends the ContextUtilizationBar pattern from Phase 1

interface BudgetBarProps {
  usedTokens: number;
  budgetTokens: number | null;  // null = no budget
  className?: string;
}

export function BudgetBar({ usedTokens, budgetTokens, className }: BudgetBarProps) {
  if (budgetTokens === null) {
    // No budget configured -- show counter without bar
    return (
      <span className="text-xs text-muted-foreground">
        {formatTokens(usedTokens)} tokens (no budget)
      </span>
    );
  }

  const pct = Math.min(100, (usedTokens / budgetTokens) * 100);
  const barColor =
    pct > 95 ? "bg-red-400"
    : pct > 80 ? "bg-yellow-400"
    : "bg-green-400";

  return (
    <div className={cn("space-y-1", className)}>
      <span className="text-xs text-muted-foreground">
        Budget: {pct.toFixed(0)}% ({formatTokens(usedTokens)} / {formatTokens(budgetTokens)})
      </span>
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width,background-color] duration-150 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
```

### Enhanced Usage Tracker with Budget Check

```typescript
// server/src/services/claude-usage-streaming.ts (EXTEND)

interface UsageTrackerOptions {
  emitIntervalMs?: number;
  onEmit: (usage: UsageState) => void;
  onBudgetWarning?: (usage: UsageState, budget: BudgetConfig) => void;
  budget?: BudgetConfig | null;
}

// In processChunk, after updating cumulative state:
if (changed && opts.budget?.maxTokens) {
  const totalUsed = inputTokens + outputTokens;
  const threshold = opts.budget.maxTokens * opts.budget.windDownThreshold;
  if (totalUsed >= threshold && !windDownTriggered) {
    windDownTriggered = true;
    opts.onBudgetWarning?.(getCurrent(), opts.budget);
  }
}
```

### Compaction Configuration via Env Vars

```typescript
// packages/adapters/claude-local/src/server/execute.ts (EXTEND buildClaudeRuntimeConfig)

// Inject compaction configuration
const compactionPct = asNumber(config.autoCompactPct, 0);
if (compactionPct > 0 && compactionPct <= 100) {
  env.CLAUDE_AUTOCOMPACT_PCT_OVERRIDE = String(compactionPct);
}
```

### Cache-Optimized Prompt Ordering

```typescript
// server/src/context-pipeline/processors/prompt-reorderer.ts

function reorderForCaching(ctx: PipelineContext): PipelineContext {
  // Layer 1: System prompt stays as-is (configured per agent, stable across runs)
  // Layer 2: Instructions file (--append-system-prompt-file) contains project context
  //          -> this is already stable per agent config
  // Layer 3: Task-type template + serialized issue context
  //          -> inject into the promptTemplate, changes per issue
  // Layer 4: Conversation messages are managed by Claude Code sessions
  //          -> Paperclip cannot control this layer

  // Ensure tool definitions are sorted for stable cache keys
  // (This is handled by Claude Code internally, but we ensure
  //  the Paperclip skills directory is always sorted)

  // The key optimization: keep promptTemplate structure identical
  // across runs for the same agent configuration, changing only
  // the variable interpolation values.

  return ctx;  // Reordering is structural, not per-run transformation
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom LLM-based history summarization | Anthropic server-side compaction API / Claude Code auto-compaction | Jan 2026 | Eliminates custom summarization code; server handles it automatically |
| Manual `cache_control` breakpoint placement | Automatic caching with single `cache_control` at request level | 2025 | Automatic mode handles breakpoint movement as conversations grow |
| 5-minute cache TTL only | 5-minute (default) or 1-hour (extended) TTL options | 2025 | Extended TTL useful for agents that heartbeat at intervals > 5 minutes |
| Fixed prompt structure for all tasks | Task-type-specific prompt templates with selective context | 2025-2026 (industry trend) | 30-50% reduction in irrelevant context per Spotify engineering reports |

**Deprecated/outdated:**
- Custom conversation truncation/windowing: Replaced by server-side compaction
- Manual KV cache management: Anthropic handles this automatically
- `gpt-tokenizer` for Claude token counting: Anthropic's `countTokens()` API is free and exact, but for budget enforcement the chars/4 heuristic is sufficient and faster

## Open Questions

1. **How to inject wind-down messages mid-run via Claude CLI**
   - What we know: Claude CLI reads stdin at start and runs autonomously. There is no mid-run message injection mechanism via the CLI.
   - What's unclear: Whether the agent can be signaled to wrap up without killing the process. The `--max-turns` flag is set at launch, not adjustable mid-run.
   - Recommendation: Budget enforcement for the `claude_local` adapter should work at the heartbeat level: track cumulative tokens across runs (not just within a single run), and set `maxTurnsPerRun` lower for subsequent heartbeats when the budget is running low. Within a single CLI invocation, the existing timeout mechanism is the backstop.

2. **Label-to-task-type mapping: company-configurable or hardcoded**
   - What we know: The CONTEXT.md says "system-defined default templates + operator overrides per agent or per project"
   - What's unclear: Whether the label-to-type mapping itself should be configurable, or just the templates. Labels vary widely between organizations.
   - Recommendation: Store default mapping in code, but allow company-level override mapping in agent/project runtimeConfig. This avoids a new DB table while keeping it flexible.

3. **Prompt template storage: filesystem or database**
   - What we know: Current `promptTemplate` is a string field in agent `adapterConfig`. Instructions are a filesystem path.
   - What's unclear: Whether task-type templates should follow the same pattern (config field) or be stored in the database for UI editing.
   - Recommendation: Store default templates as constants in code (like `DEFAULT_LABEL_MAPPING`). Store operator overrides in the agent's `adapterConfig` or a new `prompt_templates` jsonb field on agents. This follows the existing pattern and avoids a new table for v1.

4. **Per-run budget override mechanism**
   - What we know: The three-tier hierarchy is decided. Per-run overrides need a way to be specified.
   - What's unclear: Whether per-run overrides come from the wakeup request (API call), the UI, or the issue itself.
   - Recommendation: Add `tokenBudget` to the wakeup options (`WakeupOptions`) and store it in the `contextSnapshot`. UI can set it when triggering manual runs. This follows the existing pattern for `contextSnapshot` enrichment.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (existing) |
| Config file | `server/vitest.config.ts` |
| Quick run command | `cd server && npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` (root -- runs all workspaces) |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TOPT-01 | Structured brief serialization produces compact output | unit | `cd server && npx vitest run src/__tests__/context-serializer.test.ts -x` | Wave 0 |
| TOPT-01 | Compression ratio measured correctly | unit | `cd server && npx vitest run src/__tests__/context-serializer.test.ts -x` | Wave 0 |
| TOPT-02 | Budget resolved from three-tier hierarchy | unit | `cd server && npx vitest run src/__tests__/budget.test.ts -x` | Wave 0 |
| TOPT-02 | Wind-down triggers at 90% threshold | unit | `cd server && npx vitest run src/__tests__/budget.test.ts -x` | Wave 0 |
| TOPT-02 | No-budget state renders correctly | unit | `cd server && npx vitest run src/__tests__/budget.test.ts -x` | Wave 0 |
| TOPT-03 | Label-to-task-type mapping resolves correctly | unit | `cd server && npx vitest run src/__tests__/task-type-resolver.test.ts -x` | Wave 0 |
| TOPT-03 | Auto-detection heuristics produce correct types | unit | `cd server && npx vitest run src/__tests__/task-type-resolver.test.ts -x` | Wave 0 |
| TOPT-03 | Generic template used when detection is low confidence | unit | `cd server && npx vitest run src/__tests__/task-type-resolver.test.ts -x` | Wave 0 |
| TOPT-04 | Deduplication removes repeated context fields | unit | `cd server && npx vitest run src/__tests__/deduplicator.test.ts -x` | Wave 0 |
| TOPT-04 | Compaction env var injected for Claude adapter | unit | `cd server && npx vitest run src/__tests__/claude-local-adapter.test.ts -x` | Extend existing |
| TOPT-05 | Prompt template ordering is stable across runs | unit | `cd server && npx vitest run src/__tests__/prompt-reorderer.test.ts -x` | Wave 0 |
| TOPT-05 | Cache hit rate computed from usage data | unit | `cd server && npx vitest run src/__tests__/cost-token-analytics.test.ts -x` | Extend existing |

### Sampling Rate

- **Per task commit:** `cd server && npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run` (all workspaces)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `server/src/__tests__/context-serializer.test.ts` -- covers TOPT-01 structured brief
- [ ] `server/src/__tests__/budget.test.ts` -- covers TOPT-02 resolution + enforcement
- [ ] `server/src/__tests__/task-type-resolver.test.ts` -- covers TOPT-03 label mapping + auto-detect
- [ ] `server/src/__tests__/deduplicator.test.ts` -- covers TOPT-04 redundancy removal
- [ ] `server/src/__tests__/prompt-reorderer.test.ts` -- covers TOPT-05 ordering stability
- [ ] `server/src/__tests__/context-pipeline.test.ts` -- covers pipeline runner integration

## Sources

### Primary (HIGH confidence)
- [Anthropic Compaction API docs](https://platform.claude.com/docs/en/build-with-claude/compaction) -- Beta header `compact-2026-01-12`, `context_management` parameter, supported models (Opus 4.6, Sonnet 4.6)
- [Anthropic Prompt Caching docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) -- 4-layer structure, cache_control breakpoints, TTL (5m default, 1h extended), pricing (cache reads 10% of input), minimum cacheable sizes (2048-4096 tokens)
- Paperclip codebase analysis -- `heartbeat.ts` execution flow, `claude-local/execute.ts` CLI invocation, `claude-usage-streaming.ts` debounced tracker, existing schema/types/UI
- [Anthropic pricing](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) -- Sonnet 4.6: $3/MTok input, $0.30/MTok cache read; Opus 4.6: $5/MTok input, $0.50/MTok cache read

### Secondary (MEDIUM confidence)
- [Claude Code auto-compaction docs](https://code.claude.com/docs/en/how-claude-code-works) -- `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` env var, 33K-45K token buffer, auto-compaction at ~98% threshold
- [Claude Code GitHub issues on compaction](https://github.com/anthropics/claude-code/issues/24589) -- community reports on compaction behavior and env var reliability
- [Effective Context Engineering for AI Agents (Anthropic engineering)](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) -- Architecture patterns for compaction, context pipeline design

### Tertiary (LOW confidence)
- [Spotify Context Engineering for Background Agents](https://engineering.atspotify.com/2025/11/context-engineering-background-coding-agents-part-2) -- task-type routing patterns, production numbers (cited as "30-50% reduction" but single source)
- [Factory.ai Compressing Context](https://factory.ai/news/compressing-context) -- 40-60% reduction claims for rolling summaries (aligns with REQUIREMENTS targets but single source)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all patterns exist in codebase
- Architecture: HIGH -- pipeline insertion point verified in source, processor chain is standard pattern
- Serialization (TOPT-01): HIGH -- structured brief format is straightforward truncation + filtering
- Budget enforcement (TOPT-02): MEDIUM -- mid-run enforcement limited by CLI architecture; per-heartbeat enforcement is reliable
- Task-type routing (TOPT-03): HIGH -- label system exists in DB, template routing is config-driven
- Compaction (TOPT-04): MEDIUM -- relies on Claude Code's internal behavior via env var; `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` has reported reliability issues in community
- Cache awareness (TOPT-05): MEDIUM -- Paperclip influences caching indirectly by keeping prompts stable; cannot directly control Claude Code's API calls
- Pitfalls: HIGH -- derived from direct codebase analysis of the CLI adapter architecture

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable -- no fast-moving dependencies)
