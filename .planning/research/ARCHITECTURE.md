# Architecture Patterns

**Domain:** Token optimization, context management, and monitoring for AI agent orchestration platform
**Researched:** 2026-03-09

## Recommended Architecture

### Overview

The architecture integrates three new subsystems into Paperclip's existing layered monolith without disrupting the adapter plugin interface or the heartbeat execution loop. The key insight: all three concerns (token optimization, context management, monitoring) converge at the same point in the execution flow -- the gap between "heartbeat service prepares a run" and "adapter.execute() is called." This is where a **Context Pipeline** should be inserted.

```
                           EXISTING FLOW
                           =============

  Heartbeat Timer/Wakeup
         |
         v
  heartbeatService.executeRun()
         |
    [resolve agent, runtime state, context snapshot,
     workspace, session, adapter config, secrets, env]
         |
         v                          NEW COMPONENTS
  +------+-------+                  ==============
  |              |
  | (insert here)|------>  Context Pipeline  ------>  Analytics Collector
  |              |         [processors in order]      [per-run metrics]
  +------+-------+
         |
         v
  adapter.execute(ctx)     (prompt already in ctx.config.promptTemplate
         |                  and rendered via renderTemplate() in adapter)
         v
  AdapterExecutionResult
         |
         v                  NEW COMPONENTS
  +------+-------+         ==============
  |              |
  | (insert here)|------>  Post-Run Analytics  ----> Token Analytics Service
  |              |         [usage recording]         [aggregation, trends]
  +------+-------+
         |
         v
  updateRuntimeState()
  costService.createEvent()
  publishLiveEvent()
```

### Why This Insertion Point

The heartbeat service's `executeRun()` function (lines ~1057-1550 of `heartbeat.ts`) is the single codepath for all agent invocations. It already:
1. Resolves the agent config, context snapshot, workspace, and session state
2. Merges adapter config with issue-level overrides
3. Resolves secrets into the config
4. Passes `config` and `context` to `adapter.execute()`
5. Processes the `AdapterExecutionResult` including `usage` (tokens), `costUsd`, `billingType`

Currently, the prompt template is stored in `config.promptTemplate` and rendered inside each adapter's `execute()` function via `renderTemplate()`. The context pipeline should operate on the `context` object and optionally the `config` before they reach the adapter, and collect telemetry from the `AdapterExecutionResult` after execution completes.

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Context Pipeline** | Ordered chain of processors that transform the `context` and `config` objects before adapter execution | heartbeatService (called from executeRun), Context Processors, Analytics Collector |
| **Context Processors** | Individual transformation units: prompt compression, history summarization, tool selection, template optimization | Context Pipeline (receives context + config, returns transformed versions) |
| **Token Budget Manager** | Tracks per-run token budgets, enforces limits, decides compression aggressiveness | Context Pipeline (consulted during processing), Agent Config (reads budget settings) |
| **Analytics Collector** | Captures pre-run and post-run metrics for each execution | Context Pipeline (pre-run), heartbeatService (post-run via AdapterExecutionResult), Token Analytics Service (writes to) |
| **Token Analytics Service** | Aggregation, trend analysis, efficiency scoring, anomaly detection on token usage data | Analytics Collector (receives per-run data), DB (reads/writes analytics tables), API routes (serves queries), Dashboard (UI consumption) |
| **Analytics Dashboard Components** | UI components for token usage visualization, efficiency trends, cost attribution | Token Analytics Service (via API), existing LiveUpdatesProvider (real-time updates) |

### Component Detail

#### Context Pipeline (`server/src/context-pipeline/`)

A new module that implements an ordered processor chain. Each processor receives the execution context and can transform it.

```typescript
// server/src/context-pipeline/types.ts
interface ContextPipelineInput {
  agent: AgentRow;
  config: Record<string, unknown>;
  context: Record<string, unknown>;
  runtime: AdapterRuntime;
  taskKey: string | null;
  runId: string;
}

interface ContextPipelineOutput {
  config: Record<string, unknown>;
  context: Record<string, unknown>;
  metrics: PipelineMetrics;  // token counts before/after, processors applied
}

interface ContextProcessor {
  name: string;
  enabled: (input: ContextPipelineInput) => boolean;
  process: (input: ContextPipelineInput) => Promise<ContextPipelineInput>;
}

interface PipelineMetrics {
  processorsApplied: string[];
  estimatedTokensBefore: number;
  estimatedTokensAfter: number;
  compressionRatio: number;
  processingTimeMs: number;
}
```

**Design principle:** Processors are pure functions over the context/config. They do not have side effects on the database. The pipeline itself is synchronous in ordering but each processor is async. Processors can be enabled/disabled per-agent via `agent.runtimeConfig.contextPipeline`.

#### Context Processors (initial set)

| Processor | What It Does | When Active |
|-----------|-------------|-------------|
| `PromptTemplateOptimizer` | Detects verbose prompt templates, suggests/applies compression | Always (can be no-op) |
| `HistorySummarizer` | When context includes conversation history or prior run summaries, compresses older entries | When context.history or context.priorRunSummaries exist |
| `ToolSelector` | Reduces the tool set description injected into prompts based on the current task type | When agent has 10+ available tools (future) |
| `ContextDeduplicator` | Removes redundant information across context keys (e.g., workspace info repeated in multiple places) | Always |
| `TokenBudgetEnforcer` | Final processor: estimates total token count and applies aggressive compression if over budget | When agent has a token budget configured |

#### Token Budget Manager

Lives within the context pipeline as a utility, not a separate service. Reads budget from `agent.runtimeConfig.tokenBudget` (new config field):

```typescript
interface TokenBudgetConfig {
  maxInputTokensPerRun?: number;    // hard cap
  targetInputTokensPerRun?: number; // soft target for optimization
  compressionStrategy?: "none" | "moderate" | "aggressive";
}
```

Uses a lightweight token estimator (character-based heuristic: ~4 chars per token for English). No need for a tokenizer library -- the estimate only needs to be directionally correct for budget decisions, not exact.

#### Analytics Collector

Captures telemetry at two points in each run:

1. **Pre-execution** (after context pipeline): estimated tokens, compression ratio, processors applied, prompt size
2. **Post-execution** (from AdapterExecutionResult): actual input/output/cached tokens, cost, model, billing type, duration

```typescript
// server/src/analytics/collector.ts
interface RunAnalyticsEvent {
  runId: string;
  agentId: string;
  companyId: string;
  // Pre-execution metrics
  estimatedInputTokens: number;
  compressionRatio: number;
  processorsApplied: string[];
  promptSizeChars: number;
  // Post-execution metrics (filled after run)
  actualInputTokens: number;
  actualOutputTokens: number;
  cachedInputTokens: number;
  costUsd: number;
  model: string;
  billingType: string;
  durationMs: number;
  // Derived
  estimationAccuracy: number; // actual / estimated ratio
  tokenEfficiencyScore: number; // cached / total input ratio
}
```

This data feeds into a new `token_analytics` table (or extends the existing `cost_events` table with additional columns).

#### Token Analytics Service (`server/src/services/token-analytics.ts`)

Follows the existing service factory pattern (`tokenAnalyticsService(db)`). Provides:

- Per-agent token efficiency trends (cached ratio, compression savings, cost per task)
- Per-project and per-model aggregations
- Anomaly detection: flag runs where actual tokens significantly exceed estimates
- Historical comparison: week-over-week and month-over-month efficiency changes

#### Analytics API Routes (`server/src/routes/token-analytics.ts`)

New route file following existing patterns. Endpoints:

- `GET /api/companies/:companyId/token-analytics/summary` -- overall efficiency metrics
- `GET /api/companies/:companyId/token-analytics/by-agent` -- per-agent breakdown
- `GET /api/companies/:companyId/token-analytics/by-model` -- per-model breakdown
- `GET /api/companies/:companyId/token-analytics/trends` -- time-series data
- `GET /api/companies/:companyId/token-analytics/runs/:runId` -- single run deep dive

## Data Flow

### Pre-Execution Flow (Context Optimization)

```
1. executeRun() loads agent, runtime, context snapshot, config
2. Secrets resolved, env vars injected (existing flow)
3. NEW: contextPipeline.process({ agent, config, context, runtime, taskKey, runId })
   a. ContextDeduplicator: scans context keys, removes redundancy
   b. PromptTemplateOptimizer: analyzes config.promptTemplate size
   c. HistorySummarizer: compresses context.history if present
   d. TokenBudgetEnforcer: estimates total, applies compression if over budget
   e. Returns { config, context, metrics }
4. NEW: analyticsCollector.recordPreExecution(runId, metrics)
5. adapter.execute({ runId, agent, runtime, config, context, onLog, ... })
```

### Post-Execution Flow (Analytics Collection)

```
1. adapter.execute() returns AdapterExecutionResult
2. EXISTING: updateRuntimeState() -- records usage in agent_runtime_state
3. EXISTING: costEvents insert -- records cost event
4. NEW: analyticsCollector.recordPostExecution(runId, {
     actualInputTokens: result.usage.inputTokens,
     actualOutputTokens: result.usage.outputTokens,
     cachedInputTokens: result.usage.cachedInputTokens,
     costUsd: result.costUsd,
     model: result.model,
     billingType: result.billingType,
     durationMs: finishedAt - startedAt,
   })
5. NEW: Emit LiveEvent "token-analytics.run.completed" for real-time UI updates
6. EXISTING: publishLiveEvent, setRunStatus, etc.
```

### Analytics Query Flow (Monitoring)

```
1. UI requests GET /api/companies/:companyId/token-analytics/summary
2. tokenAnalyticsService(db).summary(companyId, dateRange)
3. Aggregates from token_analytics table + cost_events
4. Returns efficiency metrics, trends, recommendations
5. UI renders in dashboard widget or dedicated analytics page
```

## Integration Points with Existing Architecture

### Minimal Changes to heartbeat.ts

The context pipeline is called as a single function in `executeRun()`, right after secrets resolution and before `adapter.execute()`. This is approximately 3-5 lines of new code in the existing function:

```typescript
// In executeRun(), after line ~1327 (browser env injection) and before line ~1344 (adapter resolution)
const pipelineResult = await contextPipeline.process({
  agent, config: resolvedConfig, context, runtime: runtimeForAdapter, taskKey, runId,
});
const optimizedConfig = pipelineResult.config;
const optimizedContext = pipelineResult.context;
// Use optimizedConfig and optimizedContext for adapter.execute()
```

Post-execution analytics recording goes after `updateRuntimeState()` (around line ~1483).

### No Changes to Adapter Interface

The `AdapterExecutionContext` interface remains unchanged. Adapters receive the same `config` and `context` objects -- they are just pre-optimized. The `AdapterExecutionResult` already returns `usage`, `costUsd`, `model`, and `billingType`, which is everything the analytics collector needs.

### Database Layer Extension

New table in `packages/db/src/schema/`:

```typescript
// packages/db/src/schema/run_analytics.ts
export const runAnalytics = pgTable("run_analytics", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").notNull().references(() => heartbeatRuns.id),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  agentId: uuid("agent_id").notNull().references(() => agents.id),
  // Pre-execution
  estimatedInputTokens: integer("estimated_input_tokens"),
  compressionRatio: real("compression_ratio"),
  processorsApplied: jsonb("processors_applied").$type<string[]>(),
  promptSizeChars: integer("prompt_size_chars"),
  // Post-execution
  actualInputTokens: integer("actual_input_tokens"),
  actualOutputTokens: integer("actual_output_tokens"),
  cachedInputTokens: integer("cached_input_tokens"),
  costUsd: real("cost_usd"),
  model: text("model"),
  billingType: text("billing_type"),
  durationMs: integer("duration_ms"),
  // Derived
  estimationAccuracy: real("estimation_accuracy"),
  tokenEfficiencyScore: real("token_efficiency_score"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

This is additive -- no existing table modifications needed.

### Shared Types Extension

New types in `packages/shared/src/types/`:

```typescript
// packages/shared/src/types/token-analytics.ts
export interface TokenAnalyticsSummary {
  totalRuns: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  avgCachedRatio: number;
  avgCompressionRatio: number;
  totalCostUsd: number;
  estimationAccuracy: number;
}
```

### UI Layer Extension

New page or dashboard section. Follows existing patterns:
- API module: `ui/src/api/token-analytics.ts`
- Page: `ui/src/pages/TokenAnalytics.tsx` (or integrated into existing Costs page)
- React Query hooks for data fetching
- LiveUpdatesProvider already handles cache invalidation via event types

## Patterns to Follow

### Pattern 1: Processor Chain (Context Pipeline)

**What:** Ordered list of context processors, each receiving and returning a modified `ContextPipelineInput`. Similar to Express middleware but for context transformation.

**When:** Every run execution, with processors conditionally enabled based on agent config.

**Example:**

```typescript
// server/src/context-pipeline/pipeline.ts
const defaultProcessors: ContextProcessor[] = [
  contextDeduplicator,
  promptTemplateOptimizer,
  historySummarizer,
  tokenBudgetEnforcer,
];

export async function processContext(
  input: ContextPipelineInput,
  processors?: ContextProcessor[],
): Promise<ContextPipelineOutput> {
  const chain = processors ?? defaultProcessors;
  const startTokenEstimate = estimateTokens(input.config, input.context);
  let current = input;
  const applied: string[] = [];
  const startMs = Date.now();

  for (const processor of chain) {
    if (processor.enabled(current)) {
      current = await processor.process(current);
      applied.push(processor.name);
    }
  }

  const endTokenEstimate = estimateTokens(current.config, current.context);
  return {
    config: current.config,
    context: current.context,
    metrics: {
      processorsApplied: applied,
      estimatedTokensBefore: startTokenEstimate,
      estimatedTokensAfter: endTokenEstimate,
      compressionRatio: startTokenEstimate > 0
        ? endTokenEstimate / startTokenEstimate
        : 1,
      processingTimeMs: Date.now() - startMs,
    },
  };
}
```

### Pattern 2: Service Factory (Analytics)

**What:** Follow the existing `xxxService(db)` pattern for the token analytics service.

**When:** Building any new service that needs database access.

**Example:**

```typescript
// server/src/services/token-analytics.ts
export function tokenAnalyticsService(db: Db) {
  return {
    recordRun: async (event: RunAnalyticsEvent) => { /* insert into run_analytics */ },
    summary: async (companyId: string, range?: DateRange) => { /* aggregate query */ },
    byAgent: async (companyId: string, range?: DateRange) => { /* group by agent */ },
    trends: async (companyId: string, interval: "day" | "week" | "month") => { /* time series */ },
    runDetail: async (runId: string) => { /* single run analytics */ },
  };
}
```

### Pattern 3: LiveEvent Extension for Real-Time Analytics

**What:** Publish analytics events through existing LiveEvent system for real-time UI updates.

**When:** After each run completes, emit a `token-analytics.run.completed` event.

**Example:**

```typescript
publishLiveEvent({
  companyId: agent.companyId,
  type: "token-analytics.run.completed",
  payload: {
    runId,
    agentId: agent.id,
    compressionRatio: metrics.compressionRatio,
    tokensSaved: metrics.estimatedTokensBefore - metrics.estimatedTokensAfter,
    actualInputTokens: result.usage?.inputTokens ?? 0,
    costUsd: result.costUsd ?? 0,
  },
});
```

Requires adding `"token-analytics.run.completed"` to the `LiveEventType` union in `packages/shared`.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Modifying the Adapter Interface

**What:** Adding token optimization parameters directly to `AdapterExecutionContext` or `ServerAdapterModule`.

**Why bad:** Breaks the adapter plugin contract. All existing adapters would need updating. External/upstream adapters would be incompatible. The context pipeline should be invisible to adapters -- they receive optimized context without knowing it was processed.

**Instead:** The context pipeline transforms `config` and `context` before they reach the adapter. The adapter interface stays untouched.

### Anti-Pattern 2: Per-Adapter Token Optimization

**What:** Implementing compression/optimization logic inside each adapter's `execute()` function.

**Why bad:** Code duplication across 8+ adapters. Inconsistent optimization behavior. Impossible to get cross-adapter analytics comparisons.

**Instead:** Centralize optimization in the context pipeline. Adapters remain focused on execution protocol.

### Anti-Pattern 3: Inline Analytics in heartbeat.ts

**What:** Adding complex analytics queries, aggregation logic, or trend calculation directly inside `heartbeatService`.

**Why bad:** The heartbeat service is already ~1600 lines. Adding analytics logic would make it unmaintainable. Analytics queries should not slow down the execution hot path.

**Instead:** The analytics collector records raw events asynchronously. The analytics service handles aggregation separately, queried only when the UI requests it.

### Anti-Pattern 4: External Tokenizer Dependencies

**What:** Adding tiktoken, @anthropic-ai/tokenizer, or similar libraries for exact token counting in the context pipeline.

**Why bad:** Adds large native dependencies to the server. Token counting is model-specific and changes with each model version. Exact counts are unnecessary for budget decisions.

**Instead:** Use character-based estimation (~4 chars/token for English text). Calibrate using actual vs. estimated data from the analytics table. The estimation accuracy metric in `run_analytics` provides a feedback loop.

### Anti-Pattern 5: Storing Analytics in Existing Tables

**What:** Adding many new columns to `heartbeat_runs` or `cost_events` for analytics data.

**Why bad:** Bloats existing tables that are queried frequently in the core execution loop. Makes upstream compatibility harder. Mixes operational data with analytical data.

**Instead:** Use a dedicated `run_analytics` table with a foreign key to `heartbeat_runs.id`. This is an additive schema change with no impact on existing queries.

## Scalability Considerations

| Concern | At 10 agents | At 100 agents | At 1,000 agents |
|---------|-------------|---------------|-----------------|
| Context pipeline latency | Negligible (<10ms) | Negligible (<10ms) | May need async processing if summarizer uses LLM calls |
| run_analytics table size | ~1K rows/month | ~10K rows/month | ~100K rows/month; add time-based partitioning |
| Analytics query performance | Direct queries fine | Add date-range indexes | Pre-aggregate into daily/weekly summary tables |
| Memory (pipeline) | No concern | No concern | Pool summarizer instances if LLM-based |
| LiveEvent throughput | No concern | No concern | Consider batching analytics events |

At Paperclip's current scale (personal/small team use), none of these are concerns. The architecture supports growth without requiring upfront over-engineering.

## Suggested Build Order

Build order reflects dependencies between components. Each phase produces a working, testable increment.

### Phase 1: Analytics Foundation (no behavior change, pure observation)

**Build:** `run_analytics` schema + migration, `analyticsCollector`, `tokenAnalyticsService`, analytics API routes.

**Why first:** This adds monitoring to the existing system without changing any execution behavior. Every run starts generating analytics data. This data reveals which agents/models consume the most tokens and where optimization effort should focus. It also provides the baseline measurements needed to validate that later optimization phases actually work.

**Dependencies:** None. Purely additive.

**Integration:** ~5 lines added to `executeRun()` post-execution path. Record actual token usage into `run_analytics` alongside existing `cost_events`.

### Phase 2: Context Pipeline Infrastructure (framework without processors)

**Build:** Pipeline types, pipeline runner, no-op processor chain, metrics collection, integration into `executeRun()`.

**Why second:** Establishes the pipeline architecture and the pre-execution integration point. With no-op processors, behavior is unchanged but the infrastructure is in place. The metrics system starts recording estimated vs. actual tokens, building the calibration dataset.

**Dependencies:** Phase 1 (analytics collector records pipeline metrics).

**Integration:** ~5-10 lines in `executeRun()` pre-execution path.

### Phase 3: Context Processors (actual optimization)

**Build:** Individual processors one at a time: `ContextDeduplicator` (simplest), `PromptTemplateOptimizer`, `HistorySummarizer`, `TokenBudgetEnforcer`.

**Why third:** Each processor can be built, tested, and deployed independently. Analytics from Phase 1 show the impact of each processor. Processors can be enabled/disabled per-agent for gradual rollout.

**Dependencies:** Phase 2 (pipeline infrastructure).

### Phase 4: Analytics UI

**Build:** Token analytics dashboard components, efficiency visualizations, per-agent/per-model breakdowns, trend charts.

**Why fourth:** By this point there is rich analytics data from Phases 1-3. The UI makes the data actionable -- identifying which agents need attention, which processors are most effective, and whether token budgets are being respected.

**Dependencies:** Phase 1 (analytics API), Phase 3 (meaningful optimization data to display).

### Phase 5: Advanced Optimization (optional, data-driven)

**Build:** Based on analytics data from earlier phases: model-aware token estimation, LLM-based summarization for long histories, adaptive compression strategies, token budget auto-tuning.

**Why last:** These are optimization refinements that should be guided by real usage data, not speculation. The analytics foundation from Phase 1 tells you exactly where the biggest savings opportunities are.

**Dependencies:** Phases 1-4 (needs real data and the pipeline infrastructure).

## Sources

- Paperclip codebase analysis (heartbeat.ts, adapter types, cost service, activity log, runtime state schema, adapter registry)
- [JetBrains Research: Efficient Context Management for LLM-Powered Agents](https://blog.jetbrains.com/research/2025/12/efficient-context-management/) (context pipeline architecture)
- [Google Developers Blog: Architecting Efficient Context-Aware Multi-Agent Framework](https://developers.googleblog.com/architecting-efficient-context-aware-multi-agent-framework-for-production/) (context processor patterns)
- [Microsoft Azure: AI Agent Design Patterns](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns) (orchestration patterns)
- [ACON: Optimizing Context Compression for Long-Horizon LLM Agents](https://arxiv.org/html/2510.00615v1) (compression techniques research)
- [LangChain 1.0 Middleware for Production Agents](https://codecut.ai/langchain-1-0-middleware-production-agents/) (middleware pipeline pattern)
- [8 Middleware Layers Between Your Agent and Production](https://medium.com/@kumaran.isk/8-middleware-layers-between-your-agent-and-production-92c7880b4d08) (middleware architecture)
- [Beyond Black-Box Benchmarking: Observability of Agentic Systems](https://arxiv.org/html/2503.06745v1) (agent observability architecture)
- [Redis: LLM Token Optimization](https://redis.io/blog/llm-token-optimization-speed-up-apps/) (token optimization strategies)
- [SitePoint: Token Optimization via Context Compression](https://www.sitepoint.com/optimizing-token-usage-context-compression-techniques/) (compression techniques)

---

*Architecture research: 2026-03-09*
