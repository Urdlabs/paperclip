# Phase 1: Token Analytics Foundation - Research

**Researched:** 2026-03-09
**Domain:** Token analytics instrumentation, real-time WebSocket events, Drizzle ORM schema migration, React/TanStack Query dashboard extension
**Confidence:** HIGH

## Summary

Phase 1 adds token analytics to an existing AI agent orchestration platform built as a TypeScript pnpm monorepo. The codebase already tracks token usage per run (`heartbeat_runs.usageJson`) and per agent (`cost_events` table), but lacks token breakdown by prompt component, cached token tracking in `cost_events`, context window utilization metrics, and real-time token counters during execution. All four requirements (TOKN-01 through TOKN-04) map directly to extension points that already exist in the codebase -- no new infrastructure is needed.

The implementation touches five layers: (1) database schema (add `cachedInputTokens` column, extend `usageJson` shape), (2) server-side heartbeat service (token estimation before adapter execution, usage recording after), (3) live events system (new `heartbeat.run.usage` event type), (4) cost service API (extend aggregation queries with cached token data), and (5) UI (extend Costs page tables, add run detail token breakdown tab, add agent card live counter).

**Primary recommendation:** Implement in strict bottom-up order -- schema migration first, then server-side estimation/recording, then API aggregation, then UI components. The Claude adapter already parses `cache_read_input_tokens` from stream-json output; the real-time counter parses the same `onLog` stdout stream during execution.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Estimate tokens for each prompt component using char heuristic (~4 chars/token): system prompt, skills/tools definitions, issue context, file content, conversation history
- Initial prompt components only -- do not parse individual tool calls during execution (Phase 1 scope)
- Store breakdown at run time in DB, not computed on-demand
- Calibrate estimation accuracy over time by comparing estimated vs actual totals
- Extend existing Costs page with token analytics data -- do not create a separate page
- Tables only for Phase 1 -- charts and visual trends deferred to Phase 3 (MNTR-03)
- Add token data to summary tab: total tokens, cache hit rate, avg tokens/run
- Add cached tokens and efficiency columns to by-agent and by-project tables
- Token breakdown visible in run detail panel (tab alongside transcript)
- Context window utilization bar integrated into run detail: "Context: 68% used (17K / 25K tokens)"
- Stacked breakdown showing each prompt component with token count and percentage
- Parse Claude adapter stdout for JSON events containing usage data during run
- Emit new `heartbeat.run.usage` live event type via WebSocket
- Show compact token counter on agent card when running: "Tokens: 12.4K  $0.02"
- Show updating breakdown in run detail panel during active runs
- Other adapters (Codex, Cursor, etc.) show tokens only at completion -- Claude gets live updates
- Add `cachedInputTokens` (integer, default 0) column to `cost_events` table
- Extend `heartbeat_runs.usageJson` JSONB with `breakdown` object: `{systemPrompt, skillsTools, issueContext, fileContent, history}`
- Store `contextWindowSize` in usageJson -- looked up from static model context limits map at run time
- No new tables needed -- extend existing schema

### Claude's Discretion
- Exact prompt component parsing logic (where to split system prompt vs skills vs context)
- Static model context window size map (which models, what limits)
- Token counter update frequency / debouncing on the UI side
- How to handle non-Claude adapters that don't stream usage data (show "N/A" or "completion only")

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TOKN-01 | System tracks input/output/cached tokens per run, broken down by phase (system prompt, issue context, tool calls, conversation history) | Token estimation via ~4 chars/token heuristic on prompt components in `executeRun()` before adapter call. Store breakdown in `usageJson`. Add `cachedInputTokens` to `cost_events` for SQL aggregation. |
| TOKN-02 | Dashboard shows token usage per agent, per project, and per run with cost attribution | Extend existing Costs page (`ui/src/pages/Costs.tsx`) summary/byAgent/byProject tabs. Extend `costService` queries to aggregate cached tokens. Extend shared types. |
| TOKN-03 | Context window utilization metrics show percentage breakdown of what fills the context | Static model context window size map + breakdown stored in `usageJson`. UI displays percentage bar and stacked component breakdown in run detail panel. |
| TOKN-04 | Real-time token counter displays live token consumption during active runs via WebSocket | Parse Claude stdout `message_start`/`message_delta` events in `onLog` callback for cumulative usage. Emit `heartbeat.run.usage` live event. UI shows compact counter on agent card and updating breakdown in run detail. |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | ^0.38.4 | Schema definition, migrations, queries | Already used throughout; `cost_events` and `heartbeat_runs` schemas defined with it |
| drizzle-kit | ^0.31.9 | Migration generation | Existing migration workflow: `pnpm db:generate` then `pnpm db:migrate` |
| Express 5 | (existing) | API routes | Cost routes already defined in `server/src/routes/costs.ts` |
| React 19 | (existing) | UI components | All pages use React with TanStack Query |
| TanStack Query | (existing) | Server state management | `useQuery` pattern used in Costs page and all other pages |
| Tailwind CSS v4 | (existing) | Styling | Design system with OKLCH tokens, shadcn/ui components |
| ws | (existing) | WebSocket server | `live-events-ws.ts` already dispatches events to connected clients |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui | (existing) | Card, Tabs, Badge, Progress components | All dashboard UI elements |
| class-variance-authority | (existing) | Component variants | Token breakdown component variants |
| lucide-react | (existing) | Icons | Token/analytics icons in UI |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ~4 chars/token heuristic | tiktoken-js / gpt-tokenizer | Locked decision: heuristic is intentionally approximate for Phase 1. Exact tokenization adds latency and complexity for marginal improvement in percentage breakdowns. |
| Extend existing tables | New analytics tables | Locked decision: no new tables. Existing `cost_events` + `usageJson` JSONB is sufficient. |

**Installation:**
No new dependencies needed -- all libraries already in the monorepo.

## Architecture Patterns

### Recommended Project Structure
```
packages/db/src/schema/cost_events.ts           # Add cachedInputTokens column
packages/db/src/migrations/0029_*.sql            # Generated migration
packages/shared/src/constants.ts                 # Add "heartbeat.run.usage" to LIVE_EVENT_TYPES
packages/shared/src/types/cost.ts                # Extend CostSummary, CostByAgent with token fields
packages/shared/src/model-context-limits.ts      # NEW: static map of model -> context window size
server/src/services/costs.ts                     # Extend aggregation queries with cached tokens
server/src/services/heartbeat.ts                 # Token estimation + usage event emission in executeRun()
server/src/services/token-estimation.ts          # NEW: estimation logic extracted from heartbeat
server/src/routes/costs.ts                       # May need minor route additions
ui/src/api/costs.ts                              # Extend response types
ui/src/pages/Costs.tsx                           # Extend summary/byAgent/byProject tabs
ui/src/pages/AgentDetail.tsx                     # Add token breakdown tab to RunDetail, live counter
ui/src/components/TokenBreakdown.tsx             # NEW: reusable token breakdown display
ui/src/components/ContextUtilizationBar.tsx       # NEW: context window utilization bar
```

### Pattern 1: Schema Extension with Drizzle Migration
**What:** Add `cachedInputTokens` column to `cost_events`, generate and run migration.
**When to use:** Any time a new column is needed on an existing table.
**Example:**
```typescript
// packages/db/src/schema/cost_events.ts - Add to the table definition:
cachedInputTokens: integer("cached_input_tokens").notNull().default(0),
```
Then:
```bash
# Generate migration (must build first since drizzle.config uses dist/)
cd packages/db && pnpm build && pnpm generate
# Run migration
pnpm db:migrate
```

### Pattern 2: Live Event Extension
**What:** Add a new live event type and emit it during execution.
**When to use:** Any time real-time UI updates are needed for a new data stream.
**Example:**
```typescript
// packages/shared/src/constants.ts
export const LIVE_EVENT_TYPES = [
  "heartbeat.run.queued",
  "heartbeat.run.status",
  "heartbeat.run.event",
  "heartbeat.run.log",
  "heartbeat.run.usage",  // NEW
  "agent.status",
  "activity.logged",
] as const;

// server/src/services/heartbeat.ts - inside onLog callback
publishLiveEvent({
  companyId: run.companyId,
  type: "heartbeat.run.usage",
  payload: {
    runId: run.id,
    agentId: run.agentId,
    inputTokens: cumulativeInput,
    outputTokens: cumulativeOutput,
    cachedInputTokens: cumulativeCached,
    costUsd: estimatedCost,
  },
});
```

### Pattern 3: Service Factory Extension
**What:** Add new methods to existing service factories like `costService(db)`.
**When to use:** Extending server-side business logic for existing API surface.
**Example:**
```typescript
// server/src/services/costs.ts - Inside costService():
summary: async (companyId: string, range?: CostDateRange) => {
  // Existing code... plus:
  const [{ totalTokens, totalCached, runCount }] = await db
    .select({
      totalTokens: sql<number>`coalesce(sum(${costEvents.inputTokens} + ${costEvents.outputTokens}), 0)::int`,
      totalCached: sql<number>`coalesce(sum(${costEvents.cachedInputTokens}), 0)::int`,
      runCount: sql<number>`count(*)::int`,
    })
    .from(costEvents)
    .where(and(...conditions));
  // Return extended summary
}
```

### Pattern 4: LiveUpdatesProvider Cache Invalidation
**What:** Handle new live event types in the UI's WebSocket message handler to invalidate relevant query caches.
**When to use:** Making the UI react to new real-time event types.
**Example:**
```typescript
// ui/src/context/LiveUpdatesProvider.tsx - in handleLiveEvent()
if (event.type === "heartbeat.run.usage") {
  // Targeted invalidation for run detail and live counters
  const runId = readString(payload.runId);
  const agentId = readString(payload.agentId);
  // Update local state or invalidate specific queries
}
```

### Anti-Patterns to Avoid
- **Don't compute breakdowns on-demand from stored data:** Locked decision requires storing breakdowns at run time. Computing from raw prompt text on every view would be slow and the prompt text is not stored.
- **Don't create a new page for token analytics:** Locked decision requires extending the existing Costs page. No new routes.
- **Don't parse individual tool calls during execution:** Locked decision limits Phase 1 to initial prompt components only.
- **Don't add heavyweight tokenizer libraries:** The ~4 chars/token heuristic is intentionally approximate. Don't add tiktoken.
- **Don't use heavy polling for real-time updates:** Use WebSocket events (the existing pattern), not polling.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DB migration | Manual SQL files | `drizzle-kit generate` | Drizzle generates correct SQL from schema diffs, handles column defaults, indexes |
| WebSocket event dispatch | Custom WebSocket logic | `publishLiveEvent()` + existing `live-events-ws.ts` | Already handles auth, connection lifecycle, per-company routing |
| Query cache invalidation | Manual refetch calls | `queryClient.invalidateQueries()` in `LiveUpdatesProvider` | TanStack Query handles deduplication, stale-while-revalidate |
| UI component styling | Custom CSS | shadcn/ui Card, Tabs, Badge + Tailwind design tokens | Design guide requires using established patterns |
| Number formatting | Custom formatters | Existing `formatTokens()` and `formatCents()` from `ui/src/lib/utils.ts` | Already used in Costs page, handles K/M suffixes |

**Key insight:** Every integration point already exists. The phase is about extending existing patterns, not creating new infrastructure.

## Common Pitfalls

### Pitfall 1: Forgetting to build before drizzle-kit generate
**What goes wrong:** `drizzle-kit generate` reads from `./dist/schema/*.js` (per `drizzle.config.ts`). If you modify the `.ts` schema files but don't build, the generated migration won't include your changes.
**Why it happens:** The drizzle config uses compiled JS, not TS source.
**How to avoid:** Always run `cd packages/db && pnpm build && pnpm generate` -- the `generate` script in `package.json` already chains `tsc` before `drizzle-kit generate`.
**Warning signs:** Generated migration SQL is empty or doesn't match your schema changes.

### Pitfall 2: JSONB field type safety
**What goes wrong:** `usageJson` is typed as `Record<string, unknown>` in Drizzle. Adding a structured `breakdown` object requires careful typing on both read and write.
**Why it happens:** JSONB columns are schemaless by nature; TypeScript types exist only at the application level.
**How to avoid:** Define a shared `UsageJsonBreakdown` interface in `@paperclipai/shared`. Cast on read, validate on write. Don't trust existing data to have the new shape -- always use optional chaining.
**Warning signs:** Runtime type errors when reading old runs that lack the `breakdown` field.

### Pitfall 3: Claude stream-json events lack intermediate usage data
**What goes wrong:** Expecting to parse `input_tokens` from Claude CLI `stream-json` events mid-execution.
**Why it happens:** The Claude CLI's `stream-json` output wraps the raw API events. The `message_start` event contains initial `input_tokens` in its `usage` field, and `message_delta` events contain cumulative `output_tokens`. But these are raw API events nested inside the CLI's wrapper format. The `parseClaudeStreamJson()` function currently only parses the final `result` event.
**How to avoid:** Parse `stream_event` type events from the onLog stdout stream line-by-line during execution. Look for events where `type === "stream_event"` and `event.type === "message_start"` (for input_tokens) or `event.type === "message_delta"` (for cumulative output_tokens). Alternatively, parse the top-level `assistant` events which also carry usage data. Debounce emissions to avoid flooding the WebSocket.
**Warning signs:** Real-time counter shows 0 until run completes. Fix: ensure you're parsing intermediate events, not just the final `result`.

### Pitfall 4: heartbeat.ts is a 2,400-line monolith
**What goes wrong:** Adding token estimation logic directly inside `executeRun()` makes the file even harder to maintain.
**Why it happens:** Historical accumulation of execution logic in one file.
**How to avoid:** Extract token estimation into a separate module (`server/src/services/token-estimation.ts`). Import and call from `executeRun()`. Keep the heartbeat changes minimal -- just the call site and the usage recording.
**Warning signs:** PR diff touching hundreds of lines in heartbeat.ts.

### Pitfall 5: cost_events INSERT missing cachedInputTokens
**What goes wrong:** The existing `updateRuntimeState()` function (heartbeat.ts line 1001) inserts into `cost_events` but currently does NOT include `cachedInputTokens`. After adding the column, you must also update this insert statement.
**Why it happens:** The column doesn't exist yet; adding it to the schema without updating the insert is easy to miss.
**How to avoid:** Grep for all `INSERT INTO cost_events` or `db.insert(costEvents)` and ensure each includes the new column.
**Warning signs:** `cachedInputTokens` is always 0 in the database even though `usageJson` shows cached tokens.

### Pitfall 6: Live event flooding
**What goes wrong:** Emitting a `heartbeat.run.usage` event on every stdout line from Claude can flood the WebSocket with hundreds of events per second.
**Why it happens:** Claude streams JSON events rapidly during execution.
**How to avoid:** Debounce usage event emission -- emit at most once every 1-2 seconds, or only when the token count has changed by a meaningful amount (e.g., >100 tokens since last emit). Use a simple timestamp check in the `onLog` callback.
**Warning signs:** Browser tab becomes unresponsive during active runs; WebSocket backpressure.

## Code Examples

### Token Estimation Logic
```typescript
// server/src/services/token-estimation.ts
// Source: Codebase analysis of executeRun() flow

interface TokenBreakdown {
  systemPrompt: number;
  skillsTools: number;
  issueContext: number;
  fileContent: number;
  history: number;
}

/** Estimate tokens using ~4 chars/token heuristic */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Estimate token breakdown for prompt components.
 * Called in executeRun() after context/config resolution, before adapter.execute().
 */
export function estimatePromptBreakdown(
  config: Record<string, unknown>,
  context: Record<string, unknown>,
): TokenBreakdown {
  const promptTemplate = typeof config.promptTemplate === 'string' ? config.promptTemplate : '';
  const instructionsPath = typeof config.instructionsFilePath === 'string' ? config.instructionsFilePath : '';

  // These are the components the adapter will send to Claude:
  // 1. System prompt = default Claude Code system prompt + appended instructions
  // 2. Skills/tools = injected via --add-dir (paperclip skills directory)
  // 3. Issue context = rendered prompt template with issue/task context
  // 4. File content = workspace files loaded by Claude during session
  // 5. History = conversation history from session resume

  return {
    systemPrompt: estimateTokens(promptTemplate),
    skillsTools: 0,    // Estimated from skills directory size, or static estimate
    issueContext: 0,    // Estimated from context snapshot fields
    fileContent: 0,     // Hard to estimate pre-execution; use 0 or prior run average
    history: 0,         // Estimated from session state if resuming
  };
}
```

### Claude Stream Usage Parsing
```typescript
// Inside onLog callback in heartbeat.ts executeRun()
// Source: Claude API streaming docs (message_start/message_delta events)

let lastUsageEmitMs = 0;
let cumulativeUsage = { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 };
const USAGE_EMIT_INTERVAL_MS = 2000;

const onLog = async (stream: "stdout" | "stderr", chunk: string) => {
  // ... existing logging logic ...

  if (stream === "stdout") {
    // Parse each line for usage events
    for (const line of chunk.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const event = JSON.parse(trimmed);
        // Claude CLI stream-json wraps API events
        if (event.type === "system" && event.subtype === "init") {
          // Initial event - may have model info
        }
        // Check for raw usage in assistant/result events
        if (event.usage) {
          const u = event.usage;
          if (typeof u.input_tokens === 'number') cumulativeUsage.inputTokens = u.input_tokens;
          if (typeof u.output_tokens === 'number') cumulativeUsage.outputTokens = u.output_tokens;
          if (typeof u.cache_read_input_tokens === 'number') cumulativeUsage.cachedInputTokens = u.cache_read_input_tokens;
        }
        // Also check nested message.usage (for assistant events)
        if (event.message?.usage) {
          const u = event.message.usage;
          if (typeof u.input_tokens === 'number') cumulativeUsage.inputTokens = u.input_tokens;
          if (typeof u.output_tokens === 'number') cumulativeUsage.outputTokens = u.output_tokens;
          if (typeof u.cache_read_input_tokens === 'number') cumulativeUsage.cachedInputTokens = u.cache_read_input_tokens;
        }
      } catch {
        continue; // Not JSON, skip
      }
    }

    // Debounced emission
    const now = Date.now();
    if (now - lastUsageEmitMs >= USAGE_EMIT_INTERVAL_MS &&
        (cumulativeUsage.inputTokens > 0 || cumulativeUsage.outputTokens > 0)) {
      lastUsageEmitMs = now;
      publishLiveEvent({
        companyId: run.companyId,
        type: "heartbeat.run.usage",
        payload: {
          runId: run.id,
          agentId: run.agentId,
          ...cumulativeUsage,
        },
      });
    }
  }
};
```

### Static Model Context Window Map
```typescript
// packages/shared/src/model-context-limits.ts
// Source: Anthropic model documentation

/** Context window sizes in tokens for known models */
export const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  // Claude 4 family
  "claude-opus-4-6": 200_000,
  "claude-sonnet-4-6": 200_000,
  // Claude 3.5 family
  "claude-3-5-sonnet-20241022": 200_000,
  "claude-3-5-haiku-20241022": 200_000,
  // Claude 3 family
  "claude-3-opus-20240229": 200_000,
  "claude-3-sonnet-20240229": 200_000,
  "claude-3-haiku-20240307": 200_000,
  // Aliases used in config
  "sonnet": 200_000,
  "opus": 200_000,
  "haiku": 200_000,
};

/** Default context window size when model is unknown */
export const DEFAULT_CONTEXT_LIMIT = 200_000;

export function getContextWindowSize(model: string): number {
  // Normalize: lowercase, trim
  const normalized = model.toLowerCase().trim();
  return MODEL_CONTEXT_LIMITS[normalized] ?? DEFAULT_CONTEXT_LIMIT;
}
```

### Cost Service Extension
```typescript
// server/src/services/costs.ts - Extend summary method
// Source: existing costService pattern in codebase

// In the summary method, add token aggregation:
const [tokenStats] = await db
  .select({
    totalTokens: sql<number>`coalesce(sum(${costEvents.inputTokens} + ${costEvents.outputTokens}), 0)::int`,
    totalCached: sql<number>`coalesce(sum(${costEvents.cachedInputTokens}), 0)::int`,
    totalInput: sql<number>`coalesce(sum(${costEvents.inputTokens}), 0)::int`,
    runCount: sql<number>`count(*)::int`,
  })
  .from(costEvents)
  .where(and(...conditions));

const cacheHitRate = tokenStats.totalInput > 0
  ? Number(((tokenStats.totalCached / tokenStats.totalInput) * 100).toFixed(1))
  : 0;

return {
  ...existingReturn,
  totalTokens: Number(tokenStats.totalTokens),
  cacheHitRate,
  avgTokensPerRun: tokenStats.runCount > 0
    ? Math.round(tokenStats.totalTokens / tokenStats.runCount)
    : 0,
};
```

### updateRuntimeState Cost Events Fix
```typescript
// server/src/services/heartbeat.ts line ~1000-1011
// MUST update the cost_events INSERT to include cachedInputTokens

if (additionalCostCents > 0 || hasTokenUsage) {
  await db.insert(costEvents).values({
    companyId: agent.companyId,
    agentId: agent.id,
    provider: result.provider ?? "unknown",
    model: result.model ?? "unknown",
    inputTokens,
    outputTokens,
    cachedInputTokens,  // NEW: was missing, must add
    costCents: additionalCostCents,
    occurredAt: new Date(),
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `cost_events` lacks cached token column | Add `cachedInputTokens` column | This phase | Enables SQL-level cache hit rate aggregation without parsing JSONB |
| Token usage only visible after run completes | Real-time token counter via WebSocket | This phase | Operators see live consumption during execution |
| No breakdown of what fills context | Estimated breakdown stored per run | This phase | Enables context optimization decisions in Phase 2 |
| Claude CLI v1 `--output-format json` (final only) | `--output-format stream-json` with intermediate events | Already used | Enables real-time parsing of usage from `message_start`/`message_delta` events |

**Deprecated/outdated:**
- None relevant -- all existing patterns are current and continue to be used.

## Open Questions

1. **Exact prompt component estimation granularity**
   - What we know: The adapter receives `promptTemplate` (rendered), `context` (object with issue/task/comment IDs), and `config` (with `instructionsFilePath`, skills dir). The actual prompt text sent to Claude is constructed inside the adapter's `execute()` function.
   - What's unclear: The system prompt and skills are injected by Claude Code itself (not by Paperclip). Paperclip only controls the rendered `promptTemplate` (passed as stdin), the `--append-system-prompt-file`, and the `--add-dir` skills directory. The rest of the context window is managed by Claude Code internally.
   - Recommendation: For Phase 1, estimate what Paperclip controls: rendered prompt template size, instructions file size (read it for estimation), skills directory total file size. Mark "Claude internal" as an unknown residual. After the run completes, compare estimated total vs actual `inputTokens` to track accuracy.

2. **Session resume history size**
   - What we know: When `--resume` is used with a session ID, Claude Code loads prior conversation history. The history size is unknown to Paperclip.
   - What's unclear: No API to query the current session's history size.
   - Recommendation: When a session is being resumed, mark the `history` breakdown field as `null` (unknown) rather than 0. Over time, the delta between estimated components and actual total gives an implicit history estimate.

3. **Non-Claude adapter real-time behavior**
   - What we know: Only the Claude adapter outputs `stream-json` events. Codex, Cursor, etc. have different output formats.
   - What's unclear: Whether any other adapter provides intermediate usage data.
   - Recommendation: Only parse real-time usage for Claude adapters. For all others, emit a single `heartbeat.run.usage` event after the run completes (when usage data is available in the `AdapterExecutionResult`). UI shows "Live" badge for Claude, "Completion only" for others.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.0.5 |
| Config file | `vitest.config.ts` (root, with project refs to `server`, `ui`, `cli`, `packages/db`, `packages/adapters/opencode-local`) |
| Quick run command | `pnpm vitest run --project server` |
| Full suite command | `pnpm test:run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TOKN-01 | Token estimation produces valid breakdown from prompt components | unit | `pnpm vitest run server/src/__tests__/token-estimation.test.ts -x` | Wave 0 |
| TOKN-01 | cachedInputTokens saved in cost_events after run | unit | `pnpm vitest run server/src/__tests__/token-estimation.test.ts -x` | Wave 0 |
| TOKN-01 | usageJson includes breakdown and contextWindowSize | unit | `pnpm vitest run server/src/__tests__/token-estimation.test.ts -x` | Wave 0 |
| TOKN-02 | Cost summary includes totalTokens, cacheHitRate, avgTokensPerRun | unit | `pnpm vitest run server/src/__tests__/cost-token-analytics.test.ts -x` | Wave 0 |
| TOKN-02 | byAgent/byProject include cachedInputTokens column | unit | `pnpm vitest run server/src/__tests__/cost-token-analytics.test.ts -x` | Wave 0 |
| TOKN-03 | getContextWindowSize returns correct values for known models | unit | `pnpm vitest run server/src/__tests__/model-context-limits.test.ts -x` | Wave 0 |
| TOKN-03 | Context utilization percentage calculated correctly | unit | `pnpm vitest run server/src/__tests__/token-estimation.test.ts -x` | Wave 0 |
| TOKN-04 | Claude stdout parsing extracts usage from stream events | unit | `pnpm vitest run server/src/__tests__/claude-usage-streaming.test.ts -x` | Wave 0 |
| TOKN-04 | Usage event emitted via publishLiveEvent with correct payload | unit | `pnpm vitest run server/src/__tests__/claude-usage-streaming.test.ts -x` | Wave 0 |
| TOKN-04 | Debouncing prevents excessive event emission | unit | `pnpm vitest run server/src/__tests__/claude-usage-streaming.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm vitest run --project server`
- **Per wave merge:** `pnpm test:run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `server/src/__tests__/token-estimation.test.ts` -- covers TOKN-01, TOKN-03 (estimation logic, breakdown shape, context utilization)
- [ ] `server/src/__tests__/cost-token-analytics.test.ts` -- covers TOKN-02 (extended cost service queries)
- [ ] `server/src/__tests__/model-context-limits.test.ts` -- covers TOKN-03 (context window map)
- [ ] `server/src/__tests__/claude-usage-streaming.test.ts` -- covers TOKN-04 (stream parsing, debounce, event emission)

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `packages/db/src/schema/cost_events.ts` -- existing schema, confirmed missing `cachedInputTokens`
- Codebase analysis: `packages/db/src/schema/heartbeat_runs.ts` -- confirmed `usageJson` as JSONB `Record<string, unknown>`
- Codebase analysis: `server/src/services/heartbeat.ts` -- confirmed `executeRun()` flow, `updateRuntimeState()`, line-level integration points
- Codebase analysis: `server/src/services/costs.ts` -- confirmed `costService` factory pattern, existing aggregation queries
- Codebase analysis: `server/src/services/live-events.ts` -- confirmed `publishLiveEvent()` signature
- Codebase analysis: `packages/shared/src/constants.ts` -- confirmed `LIVE_EVENT_TYPES` array to extend
- Codebase analysis: `packages/adapters/claude-local/src/server/parse.ts` -- confirmed `parseClaudeStreamJson()` pattern for parsing usage
- Codebase analysis: `packages/adapters/claude-local/src/server/execute.ts` -- confirmed `--output-format stream-json`, `onLog` callback pattern
- Codebase analysis: `ui/src/pages/Costs.tsx` -- confirmed page structure, existing tabs
- Codebase analysis: `ui/src/context/LiveUpdatesProvider.tsx` -- confirmed event handling pattern for cache invalidation
- Codebase analysis: `ui/src/pages/AgentDetail.tsx` -- confirmed `RunDetail` component, `runMetrics()` usage parser
- Codebase analysis: `packages/db/drizzle.config.ts` -- confirmed migration config reads from `./dist/schema/*.js`

### Secondary (MEDIUM confidence)
- [Claude Code CLI reference](https://code.claude.com/docs/en/cli-reference) -- `stream-json` output format documentation
- [Agent SDK streaming output](https://platform.claude.com/docs/en/agent-sdk/streaming-output) -- `StreamEvent` types, `message_start`/`message_delta` event structure
- [Claude API streaming docs](https://platform.claude.com/docs/en/build-with-claude/streaming) -- Verified `message_start` contains `usage.input_tokens`, `message_delta` contains cumulative `usage.output_tokens` and `cache_read_input_tokens`

### Tertiary (LOW confidence)
- Model context window sizes (200K for Claude 3/3.5/4 family) -- based on training data knowledge. Should be verified against current Anthropic documentation. All current Claude models are 200K, but this may change for future models.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, verified via codebase analysis
- Architecture: HIGH -- all integration points verified with line-level references
- Pitfalls: HIGH -- identified from direct code analysis of current implementation gaps
- Real-time parsing: MEDIUM -- Claude stream-json event structure verified via API docs, but exact CLI wrapper format needs runtime validation

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable codebase, no fast-moving dependencies)
