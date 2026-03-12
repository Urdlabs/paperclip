# Phase 3: Observability & Monitoring UX - Research

**Researched:** 2026-03-11
**Domain:** React UI visualization -- trace trees, filtered feeds, charting
**Confidence:** HIGH

## Summary

Phase 3 is a **pure frontend/UI phase** with minimal backend changes. The existing data infrastructure from Phase 1 (token analytics) and Phase 2 (context optimization) already collects all the raw data needed. The three requirements (MNTR-01, MNTR-02, MNTR-03) map to three distinct UI features: a trace tree view, a multi-filter activity feed, and an analytics charts tab.

The codebase is React 19 + TypeScript + Vite + Tailwind v4 + shadcn/ui + React Query. The project already has chart CSS variables (`--chart-1` through `--chart-5`), a Collapsible component for tree nodes, a FilterBar component, and a PageTabBar component. Run log data is already parsed into structured `TranscriptEntry` objects (assistant, thinking, tool_call, tool_result, init, result, etc.) which map directly to trace nodes. The main new dependency is Recharts (user decision), which integrates cleanly via shadcn/ui's chart wrapper components.

**Primary recommendation:** Build three independent feature areas (trace view, activity filters, analytics charts) that can be implemented in parallel. Use shadcn/ui chart components (which wrap Recharts) for the analytics tab. The trace view should transform existing TranscriptEntry data into a nested tree structure. Activity filtering needs a new backend endpoint to support project-based filtering and severity derivation, plus URL query param sync on the frontend.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Trace Visualization (MNTR-01):** Nested collapsible tree format (like Langfuse/Jaeger), not timeline or waterfall. Each node shows type icon + name + duration + token count, color-coded by type. Expanded node shows full content with syntax highlighting. Trace tab added to run detail panel on agent page. Timing as duration per node + cumulative.
- **Activity Feed Filtering (MNTR-02):** Horizontal filter bar above feed with Agent, Project, Event Type, Severity dropdowns/chips (GitHub Issues style). Filter state persisted via URL query params. Real-time updates via WebSocket reusing LiveUpdatesProvider pattern. Three severity levels: info, warning, error (with defined classifications).
- **Analytics Dashboard (MNTR-03):** Extend existing Costs page with new Analytics/Charts tab (not separate page). Four charts: token usage over time (line), cost per agent (bar), cost per project (bar), context composition breakdown (stacked bar or donut). Time range presets (7d, 30d, 90d) + custom date picker, default 30d. Use Recharts library. Charts responsive.

### Claude's Discretion
- Trace data extraction from existing run logs/usageJson -- how to parse execution steps into trace nodes
- Chart color palette and exact visual styling
- Activity feed pagination strategy (infinite scroll vs load more)
- How to aggregate cost data for chart time series queries
- Date picker component choice (existing UI library or new)

### Deferred Ideas (OUT OF SCOPE)
- Historical run comparison (side-by-side diff) -- v2 MNTR-04
- Agent timeline view (Gantt chart of activity over time) -- v2 MNTR-05
- Run replay / time-travel debugging -- v2 MNTR-06
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MNTR-01 | Trace visualization shows structured execution path (prompt, tool calls, responses, decisions) with timing and nesting, similar to Langfuse traces | TranscriptEntry types already model all node types. Run log parsing infrastructure exists (buildTranscript + adapter-specific parsers). Collapsible component available for tree UI. |
| MNTR-02 | Filtered activity feeds allow filtering by agent, project, event type, and severity on the activity page | Backend activity API already supports agentId and entityType filtering. Needs: project filter param, severity derivation from action strings, URL query param sync. FilterBar component exists. |
| MNTR-03 | Token analytics dashboard with charts for token usage trends, cost per agent, cost per project, and context composition breakdown | Cost events table has all needed data (tokens, cost, agent, project, timestamps). Needs: time-series aggregation endpoint. Recharts via shadcn/ui chart components for visualization. Chart CSS variables already defined. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | ^3.x | Charting library for analytics dashboard | User decision. shadcn/ui builds chart components on top of Recharts. Composable, React-native, SVG-based. |
| @tanstack/react-query | ^5.90 | Data fetching + cache | Already in project. All API calls use React Query patterns. |
| radix-ui | ^1.4 | Collapsible primitives for trace tree | Already in project. Collapsible component already exists. |
| react-router-dom | ^7.1 | URL query param sync for filters | Already in project. `useSearchParams` hook available. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | ^0.574 | Icons for trace node types, filter UI | Already in project. Use for prompt/tool/response/decision type icons. |
| class-variance-authority | ^0.7 | Component variants for trace node type styling | Already in project. Use for trace node color-coding by type. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recharts | Custom SVG charts (existing ActivityCharts.tsx pattern) | Existing custom charts work for simple bar charts but lack interactivity (tooltips, legends, responsive). Recharts adds proper charting with minimal code. User explicitly chose Recharts. |
| Recharts | Nivo/Visx | Recharts is simpler, has shadcn/ui integration. User chose it. |

**Installation:**
```bash
cd ui && pnpm add recharts
```

Then add shadcn/ui chart component:
```bash
cd ui && pnpm dlx shadcn@latest add chart
```

This installs the `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent` wrappers.

## Architecture Patterns

### New Component Structure
```
ui/src/
  components/
    TraceView.tsx            # Trace tree visualization (MNTR-01)
    TraceNode.tsx            # Individual tree node (collapsible)
    ActivityFilterBar.tsx    # Multi-filter horizontal bar (MNTR-02)
    AnalyticsCharts.tsx      # Charts tab content (MNTR-03)
  api/
    costs.ts                 # Extend with timeSeries endpoint
    activity.ts              # Extend with project/severity filter params
  pages/
    AgentDetail.tsx           # Add Trace tab to RunDetail
    Activity.tsx              # Replace single Select with multi-filter bar
    Costs.tsx                 # Add Analytics tab
```

### Pattern 1: Trace Tree from TranscriptEntry

**What:** Transform flat `TranscriptEntry[]` into nested trace tree nodes
**When to use:** RunDetail component when displaying trace tab

The existing `buildTranscript()` function already parses run logs into a flat array of `TranscriptEntry` objects. The trace view needs to nest these into a tree by grouping tool_call + tool_result pairs and identifying conversation turns (assistant response -> tool calls -> results -> next response).

```typescript
// Trace node model derived from TranscriptEntry[]
interface TraceNode {
  id: string;
  type: "prompt" | "tool_call" | "response" | "thinking" | "result";
  label: string;              // Human-readable name
  startTime: string;          // ISO timestamp
  endTime?: string;           // ISO timestamp (for duration calc)
  durationMs?: number;
  tokenCount?: number;
  children: TraceNode[];      // Nested nodes
  content: TranscriptEntry;   // Original entry for expanded view
}
```

**Nesting strategy:**
1. Group entries into "turns" -- each assistant message starts a new turn
2. Within a turn, tool_call entries become children of the assistant node
3. tool_result entries attach to their matching tool_call (via position/adjacency since toolUseId links them)
4. `init` and `result` entries are top-level nodes (session start, session end)
5. `thinking` entries nest under the preceding assistant turn

### Pattern 2: URL Query Param Filter Sync

**What:** Persist filter state in URL search params for shareable/refreshable filters
**When to use:** Activity page filters

```typescript
import { useSearchParams } from "@/lib/router";

function useActivityFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = {
    agent: searchParams.get("agent") ?? undefined,
    project: searchParams.get("project") ?? undefined,
    type: searchParams.get("type") ?? undefined,
    severity: searchParams.get("severity") ?? undefined,
  };

  const setFilter = (key: string, value: string | undefined) => {
    setSearchParams(prev => {
      if (value) prev.set(key, value);
      else prev.delete(key);
      return prev;
    }, { replace: true });
  };

  return { filters, setFilter };
}
```

### Pattern 3: Time-Series API for Charts

**What:** Backend aggregation endpoint that groups cost data by date bucket
**When to use:** Analytics charts tab

```typescript
// New endpoint: GET /companies/:companyId/costs/time-series
// Query params: from, to, bucket (day|week), groupBy (agent|project|none)
// Response: { date: string; totalTokens: number; costCents: number; ... }[]

// In costs service:
timeSeries: async (companyId: string, range: CostDateRange, bucket: "day" | "week") => {
  // SQL: GROUP BY date_trunc(bucket, occurred_at)
  // ORDER BY date ASC
}
```

### Pattern 4: shadcn/ui Chart Integration

**What:** Use ChartContainer + Recharts for themed, accessible charts
**When to use:** All four analytics charts

```typescript
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";

const chartConfig = {
  tokens: { label: "Tokens", color: "var(--chart-1)" },
  cost: { label: "Cost", color: "var(--chart-2)" },
};

// ChartContainer handles ResponsiveContainer, theming, and CSS variable injection
<ChartContainer config={chartConfig} className="h-[300px] w-full">
  <LineChart data={timeSeriesData}>
    <CartesianGrid vertical={false} strokeDasharray="3 3" />
    <XAxis dataKey="date" />
    <YAxis />
    <ChartTooltip content={<ChartTooltipContent />} />
    <Line type="monotone" dataKey="tokens" stroke="var(--color-tokens)" />
  </LineChart>
</ChartContainer>
```

### Anti-Patterns to Avoid
- **Building custom SVG charts instead of using Recharts:** The existing ActivityCharts.tsx has custom bar charts. For simple agent-page charts these are fine, but the analytics dashboard needs tooltips, legends, and responsive behavior -- use Recharts.
- **Storing filter state in React state instead of URL params:** User explicitly requires URL param persistence for shareability and back/forward navigation.
- **Fetching all events client-side and filtering there:** Activity feeds can be large. Filter on the backend; send only matching events.
- **Creating a new page for analytics:** User explicitly wants a new tab on the existing Costs page.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Responsive interactive charts | Custom SVG with manual tooltip/legend | Recharts + shadcn/ui ChartContainer | Tooltips, legends, responsive resize, accessibility, dark theme |
| Collapsible tree nodes | Custom expand/collapse with state | Radix Collapsible (already in project) | Accessible keyboard navigation, animation, proper ARIA |
| URL query param sync | Manual window.history manipulation | react-router-dom useSearchParams | Integrates with React Router, handles encoding, works with back/forward |
| Date range picker | Custom calendar component | HTML native `<input type="date">` (existing pattern in Costs.tsx) | Costs page already uses native date inputs for custom range. Keep consistent. |
| Syntax highlighting for JSON | Custom tokenizer | Simple `<pre>` with `font-mono` + JSON.stringify pretty-print | Good enough for trace content. The project uses mono-spaced code blocks elsewhere (log viewer). |

**Key insight:** This phase is entirely about UI composition. Every data source already exists. The work is transforming and visualizing existing data, not building new collection infrastructure.

## Common Pitfalls

### Pitfall 1: Missing backend filter support
**What goes wrong:** The frontend attempts to filter by project or severity, but the backend activity API only supports agentId and entityType filters currently.
**Why it happens:** The activity_log table has no `severity` column and no `projectId` column. The `entityType` filter works, but project filtering requires a join through issues.
**How to avoid:**
- Severity: Derive from the `action` field using a deterministic mapping (e.g., `.failed` actions = error, `budget_` actions = warning, everything else = info). Do this server-side.
- Project: Add projectId filter to the activity service by joining activity_log -> issues -> issues.projectId.
- Alternatively, derive severity client-side from the action field to avoid schema migration.
**Warning signs:** Filter dropdowns that do nothing or return wrong results.

### Pitfall 2: Trace data not available for all run types
**What goes wrong:** The trace view shows empty for some runs because different adapters produce different log formats, or logs were not persisted.
**Why it happens:** Not all runs have logRef (log stored to disk). Runs may have only stdoutExcerpt or stderrExcerpt. Different adapters (claude_local, codex_local, opencode_local) parse stdout differently.
**How to avoid:**
- Always check for log availability first (run.logRef exists)
- Fall back to stdoutExcerpt when full logs are unavailable
- Show "No trace data available" gracefully when neither exists
- The existing `buildTranscript` + adapter-specific parsers already handle this -- reuse the same infrastructure
**Warning signs:** Blank trace panels, runtime errors from null data.

### Pitfall 3: Recharts bundle size
**What goes wrong:** Recharts adds significant bundle size (~200KB gzipped) since it depends on D3 submodules.
**Why it happens:** Recharts imports multiple D3 modules internally.
**How to avoid:**
- Import only the specific chart components needed (LineChart, BarChart, PieChart, not `import * from 'recharts'`)
- This is a trade-off the user accepted by choosing Recharts
- Vite tree-shakes unused exports
**Warning signs:** Build size increasing significantly; monitor with `vite build --report`.

### Pitfall 4: Time-series query performance
**What goes wrong:** Chart queries for 90-day ranges with per-day bucketing are slow.
**Why it happens:** cost_events table scan without date-bucketed index.
**How to avoid:**
- The `cost_events_company_occurred_idx` index on (companyId, occurredAt) already exists -- it covers range queries well
- Use `date_trunc('day', occurred_at)` for grouping, which the index supports
- Limit maximum range or aggregate to weekly buckets for long ranges
**Warning signs:** Slow chart loading, query timeouts.

### Pitfall 5: Filter state lost on navigation
**What goes wrong:** User applies filters on Activity page, navigates to an issue detail, presses back, and filters are gone.
**Why it happens:** React state is lost on unmount if not persisted.
**How to avoid:** URL query params (the chosen approach) naturally survive navigation. React Router's `useSearchParams` preserves params through history. Make sure to use `{ replace: true }` when updating filter params to avoid polluting browser history.
**Warning signs:** Filters resetting on back/forward navigation.

### Pitfall 6: Collapsible tree performance with large traces
**What goes wrong:** Very long runs (100+ tool calls) make the trace tree sluggish.
**Why it happens:** Rendering all nodes expanded with full content is expensive.
**How to avoid:**
- Start with all nodes collapsed except top-level turns
- Only render expanded content when node is open (Radix Collapsible handles this -- content is not mounted when closed)
- Long content (prompts, tool outputs) truncated with "show more" toggle
- Consider virtualizing the list if traces exceed ~200 nodes (unlikely in practice)
**Warning signs:** Lag when expanding nodes, slow initial render of trace tab.

## Code Examples

### Example 1: Trace Node Component
```typescript
// Source: Derived from existing Collapsible component + TranscriptEntry types
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ChevronRight, MessageSquare, Wrench, Brain, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const NODE_TYPE_CONFIG = {
  prompt:    { icon: MessageSquare, color: "text-blue-400",   bg: "bg-blue-400/10" },
  tool_call: { icon: Wrench,        color: "text-amber-400",  bg: "bg-amber-400/10" },
  response:  { icon: Zap,           color: "text-green-400",  bg: "bg-green-400/10" },
  thinking:  { icon: Brain,         color: "text-purple-400", bg: "bg-purple-400/10" },
  result:    { icon: Zap,           color: "text-emerald-400", bg: "bg-emerald-400/10" },
};

function TraceNodeRow({ node, depth }: { node: TraceNode; depth: number }) {
  const config = NODE_TYPE_CONFIG[node.type] ?? NODE_TYPE_CONFIG.response;
  const Icon = config.icon;
  const hasChildren = node.children.length > 0;

  return (
    <Collapsible>
      <CollapsibleTrigger className="flex items-center gap-2 w-full px-2 py-1.5 hover:bg-accent/50 text-left">
        <div style={{ paddingLeft: `${depth * 16}px` }} className="flex items-center gap-2 flex-1 min-w-0">
          {hasChildren && <ChevronRight className="h-3 w-3 shrink-0 transition-transform data-[state=open]:rotate-90" />}
          {!hasChildren && <span className="w-3" />}
          <span className={cn("p-0.5 rounded", config.bg)}>
            <Icon className={cn("h-3.5 w-3.5", config.color)} />
          </span>
          <span className="text-sm truncate">{node.label}</span>
          {node.durationMs != null && (
            <span className="text-xs font-mono text-muted-foreground ml-auto shrink-0">
              {node.durationMs}ms
            </span>
          )}
          {node.tokenCount != null && (
            <span className="text-xs font-mono text-muted-foreground shrink-0">
              {node.tokenCount} tok
            </span>
          )}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {/* Full content with syntax highlighting */}
        <div className="pl-8 pr-2 py-2 border-l border-border ml-4">
          <pre className="text-xs font-mono whitespace-pre-wrap text-muted-foreground max-h-60 overflow-y-auto">
            {typeof node.content === "string" ? node.content : JSON.stringify(node.content, null, 2)}
          </pre>
        </div>
        {node.children.map(child => (
          <TraceNodeRow key={child.id} node={child} depth={depth + 1} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
```

### Example 2: Activity Filter Bar with URL Sync
```typescript
// Source: Existing FilterBar component pattern + useSearchParams
import { useSearchParams } from "@/lib/router";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterBar, type FilterValue } from "@/components/FilterBar";

function ActivityFilters({ agents, projects, eventTypes }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();

  const updateParam = (key: string, value: string | undefined) => {
    setSearchParams(prev => {
      if (value && value !== "all") prev.set(key, value);
      else prev.delete(key);
      return prev;
    }, { replace: true });
  };

  // Build active filter chips from URL params
  const activeFilters: FilterValue[] = [];
  const agentId = searchParams.get("agent");
  if (agentId) activeFilters.push({ key: "agent", label: "Agent", value: agents.find(a => a.id === agentId)?.name ?? agentId });
  // ... similar for project, type, severity

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={searchParams.get("agent") ?? "all"} onValueChange={v => updateParam("agent", v)}>
          <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Agent" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All agents</SelectItem>
            {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {/* Similar Selects for project, type, severity */}
      </div>
      <FilterBar filters={activeFilters} onRemove={key => updateParam(key, undefined)} onClear={() => setSearchParams({}, { replace: true })} />
    </div>
  );
}
```

### Example 3: Line Chart with shadcn/ui ChartContainer
```typescript
// Source: shadcn/ui chart docs + Recharts API
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import type { ChartConfig } from "@/components/ui/chart";

const chartConfig: ChartConfig = {
  tokens: { label: "Total Tokens", color: "var(--chart-1)" },
};

function TokenUsageChart({ data }: { data: { date: string; tokens: number }[] }) {
  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <LineChart data={data} accessibilityLayer>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8}
          tickFormatter={(value: string) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })} />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line type="monotone" dataKey="tokens" stroke="var(--color-tokens)" strokeWidth={2} dot={false} />
      </LineChart>
    </ChartContainer>
  );
}
```

### Example 4: Time-Series Backend Query
```typescript
// Source: Derived from existing costs.ts service patterns
timeSeries: async (companyId: string, range: CostDateRange, bucket: "day" | "week" = "day") => {
  const conditions: ReturnType<typeof eq>[] = [eq(costEvents.companyId, companyId)];
  if (range.from) conditions.push(gte(costEvents.occurredAt, range.from));
  if (range.to) conditions.push(lte(costEvents.occurredAt, range.to));

  const dateBucket = sql`date_trunc(${sql.raw(`'${bucket}'`)}, ${costEvents.occurredAt})`;

  return db
    .select({
      date: dateBucket,
      totalTokens: sql<number>`coalesce(sum(${costEvents.inputTokens} + ${costEvents.outputTokens}), 0)::int`,
      costCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
      inputTokens: sql<number>`coalesce(sum(${costEvents.inputTokens}), 0)::int`,
      outputTokens: sql<number>`coalesce(sum(${costEvents.outputTokens}), 0)::int`,
      cachedInputTokens: sql<number>`coalesce(sum(${costEvents.cachedInputTokens}), 0)::int`,
    })
    .from(costEvents)
    .where(and(...conditions))
    .groupBy(dateBucket)
    .orderBy(dateBucket);
},
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom SVG bar charts (ActivityCharts.tsx) | Recharts + shadcn/ui ChartContainer | Phase 3 (this phase) | Existing agent detail charts stay custom; new analytics dashboard uses Recharts |
| Single entityType filter dropdown (Activity.tsx) | Multi-filter bar with URL param sync | Phase 3 (this phase) | Replaces existing simple filter with full agent/project/type/severity filtering |
| Run detail shows flat log + Token Analysis | Run detail gains Trace tab with nested tree | Phase 3 (this phase) | Adds structured execution path visualization alongside existing raw log |

**Deprecated/outdated:**
- The existing single `Select` filter on the Activity page will be replaced by the multi-filter bar
- The custom chart components in ActivityCharts.tsx (ChartCard, DateLabels, ChartLegend) remain for agent detail page but are NOT used for the analytics dashboard (which uses Recharts)

## Discretion Recommendations

### Trace data extraction strategy
**Recommendation:** Reuse existing `buildTranscript()` infrastructure. The transcript is already built from run logs and parsed by adapter-specific parsers. The trace view adds a second rendering mode over the same data -- transform `TranscriptEntry[]` into a tree structure client-side. No new backend data collection needed.

The tree transformation groups entries into conversational turns:
1. `init` entry = root node
2. Each `assistant` entry starts a new branch
3. `tool_call` entries nest under the preceding assistant node
4. `tool_result` entries attach to the preceding tool_call
5. `thinking` entries nest under the containing assistant turn
6. `result` entry = terminal node with final metrics

Timing comes from the `ts` field on each TranscriptEntry. Duration is calculated as difference between consecutive entries' timestamps.

### Chart color palette
**Recommendation:** Use the existing `--chart-1` through `--chart-5` CSS variables. These are already defined in both light and dark themes in `ui/src/index.css`. This ensures charts are consistent with the design system and automatically support theme switching.

### Activity feed pagination
**Recommendation:** "Load more" button over infinite scroll. Reasons:
1. The existing activity page loads all events (no pagination yet) -- adding a "load more" button is incremental
2. Infinite scroll adds complexity with the filter bar (scroll position resets when filters change)
3. "Load more" is predictable and works well with WebSocket "X new events" indicator
4. Implementation: Start with limit=50, "Load more" appends next 50

### Cost data aggregation for time-series
**Recommendation:** Add a single new backend endpoint: `GET /companies/:companyId/costs/time-series` with query params `from`, `to`, `bucket` (day/week), and optional `groupBy` (agent/project/none). This endpoint uses `date_trunc()` SQL aggregation over the existing `cost_events` table. The `cost_events_company_occurred_idx` index already covers this query pattern efficiently.

### Date picker component
**Recommendation:** Reuse the existing native `<input type="date">` pattern from Costs.tsx. The Costs page already has a custom date range picker with HTML date inputs that works well. Keep consistency by using the same pattern for the analytics tab. Since both are on the Costs page (analytics is a new tab), they can share the same date range state.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | `ui/vitest.config.ts` |
| Quick run command | `cd ui && pnpm vitest run --reporter verbose` |
| Full suite command | `cd ui && pnpm vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MNTR-01 | TranscriptEntry[] to tree transformation | unit | `cd ui && pnpm vitest run src/lib/trace-utils.test.ts -x` | No -- Wave 0 |
| MNTR-01 | Trace node grouping (tool_call nesting, turn boundaries) | unit | `cd ui && pnpm vitest run src/lib/trace-utils.test.ts -x` | No -- Wave 0 |
| MNTR-02 | Severity derivation from action strings | unit | `cd ui && pnpm vitest run src/lib/severity.test.ts -x` | No -- Wave 0 |
| MNTR-02 | URL filter param round-trip | unit | `cd ui && pnpm vitest run src/hooks/useActivityFilters.test.ts -x` | No -- Wave 0 |
| MNTR-03 | Time-series data transformation for charts | unit | `cd ui && pnpm vitest run src/lib/chart-utils.test.ts -x` | No -- Wave 0 |
| MNTR-03 | Chart rendering with mock data | manual-only | Visual verification in browser | N/A |

### Sampling Rate
- **Per task commit:** `cd ui && pnpm vitest run --reporter verbose`
- **Per wave merge:** `cd ui && pnpm vitest run && cd .. && pnpm --filter @paperclipai/ui typecheck`
- **Phase gate:** Full suite green + typecheck clean before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `ui/src/lib/trace-utils.test.ts` -- covers MNTR-01 tree transformation logic
- [ ] `ui/src/lib/severity.test.ts` -- covers MNTR-02 severity derivation
- [ ] `ui/src/lib/chart-utils.test.ts` -- covers MNTR-03 data transformation

## Open Questions

1. **Context composition data for the breakdown chart**
   - What we know: UsageJsonExtended.breakdown has { systemPrompt, skillsTools, issueContext, fileContent, history } per run. The costs time-series endpoint aggregates cost_events.
   - What's unclear: Whether to aggregate composition data from usageJson across runs (requires summing JSONB fields from heartbeat_runs) or just show per-run composition.
   - Recommendation: Show aggregate composition as a donut/stacked bar for the selected time range. Query heartbeat_runs.usageJson->'breakdown' fields summed across runs in the date range. This is a separate query from cost_events.

2. **Activity feed real-time "X new events" indicator**
   - What we know: LiveUpdatesProvider already handles WebSocket events and invalidates activity queries. The activity query cache refreshes on new events.
   - What's unclear: The exact mechanism for showing "X new events" when user has scrolled down.
   - Recommendation: Track the count of events received via WebSocket since last scroll-to-top. Show a sticky banner "N new events" that scrolls to top and refreshes when clicked. The LiveUpdatesProvider already fires query invalidation; the UI just needs to detect when new data arrives while scrolled.

## Sources

### Primary (HIGH confidence)
- Project codebase: `ui/src/pages/Activity.tsx`, `ui/src/pages/Costs.tsx`, `ui/src/pages/AgentDetail.tsx` -- current implementation reviewed
- Project codebase: `packages/shared/src/types/usage.ts`, `packages/shared/src/types/heartbeat.ts`, `packages/shared/src/types/activity.ts` -- type definitions
- Project codebase: `packages/adapter-utils/src/types.ts` -- TranscriptEntry type (trace data model)
- Project codebase: `packages/adapters/claude-local/src/ui/parse-stdout.ts` -- Claude adapter stdout parser
- Project codebase: `server/src/services/costs.ts`, `server/src/services/activity.ts` -- backend query patterns
- Project codebase: `packages/db/src/schema/activity_log.ts`, `packages/db/src/schema/cost_events.ts` -- database schema
- Project codebase: `ui/src/context/LiveUpdatesProvider.tsx` -- WebSocket event handling
- [shadcn/ui Chart docs](https://ui.shadcn.com/docs/components/radix/chart) -- ChartContainer, Recharts integration
- [Recharts GitHub](https://github.com/recharts/recharts) -- v3.8.0 latest, actively maintained

### Secondary (MEDIUM confidence)
- [Recharts official examples](https://recharts.github.io/en-US/examples/) -- chart type patterns
- [Recharts ResponsiveContainer API](https://recharts.github.io/en-US/api/ResponsiveContainer/) -- responsive layout

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Recharts is user-decided, shadcn/ui integration verified via official docs, all other libs already in project
- Architecture: HIGH -- All data sources verified in codebase, TranscriptEntry types confirmed, existing patterns well understood
- Pitfalls: HIGH -- Based on direct codebase inspection (verified missing severity column, verified filter API limitations)

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable -- no fast-moving dependencies)
