# Phase 3: Observability & Monitoring UX - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Operators can deeply inspect agent execution and understand system behavior through structured traces, filtered activity feeds, and interactive analytics charts. This is a UI/visualization phase — no new backend data collection (Phase 1+2 already track all needed data).

Requirements: MNTR-01, MNTR-02, MNTR-03

</domain>

<decisions>
## Implementation Decisions

### Trace Visualization (MNTR-01)
- Nested collapsible tree format (like Langfuse/Jaeger), not timeline or waterfall
- Each node shows at a glance: type icon + name + duration + token count, color-coded by type (prompt, tool call, response, decision)
- Expanded node shows full content with syntax highlighting: prompts as formatted text, tool calls as highlighted JSON (arguments + response), model responses as full text
- Long content truncated with "show more" toggle
- Trace view lives as a new "Trace" tab in the run detail panel on the agent page (alongside existing run info and Token Analysis)
- Timing shown as duration per node + cumulative

### Activity Feed Filtering (MNTR-02)
- Horizontal filter bar above the feed: Agent, Project, Event Type, Severity dropdowns/chips (like GitHub Issues filter bar)
- Replace existing single dropdown with multi-filter bar
- Filter state persisted via URL query params (?agent=ceo&type=error) — shareable, survives refresh, back/forward works
- Real-time updates via WebSocket: new events appear at top, "X new events" indicator when scrolled down (reuse LiveUpdatesProvider pattern)
- Three severity levels: info, warning, error
  - Info: normal events (run started, run completed, issue created)
  - Warning: budget approaching, retries, slow runs
  - Error: run failures, adapter errors, webhook failures

### Analytics Dashboard (MNTR-03)
- Extend existing Costs page with a new "Analytics" or "Charts" tab (don't create a separate page)
- Four charts covering all MNTR-03 criteria:
  1. Token usage over time (line chart) — daily/weekly token consumption trend
  2. Cost per agent (bar chart) — comparison across agents
  3. Cost per project (bar chart) — comparison across projects
  4. Context composition breakdown (stacked bar or donut) — system prompt, issue context, tools, history proportions
- Time range: preset buttons (7d, 30d, 90d) + custom date range picker, default to 30d
- Use Recharts library (add dependency) — composable, responsive, good React integration
- Charts responsive to container width

### Claude's Discretion
- Trace data extraction from existing run logs/usageJson — how to parse execution steps into trace nodes
- Chart color palette and exact visual styling
- Activity feed pagination strategy (infinite scroll vs load more)
- How to aggregate cost data for chart time series queries
- Date picker component choice (existing UI library or new)

</decisions>

<specifics>
## Specific Ideas

- Trace should feel like Langfuse trace view — nested, expandable, with timing bars
- Activity filter bar similar to GitHub Issues filter UX — dropdowns that show counts
- Charts tab on Costs page keeps all financial/token data in one place
- Existing ActivityCharts.tsx has custom chart components (bar charts, legends) that may need replacing or wrapping with Recharts
- LiveUpdatesProvider already handles WebSocket events — extend for activity feed real-time updates

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ui/src/pages/Activity.tsx`: Existing activity page with single filter dropdown — extend with multi-filter bar
- `ui/src/components/ActivityRow.tsx`: Activity row component — keep for rendering individual events
- `ui/src/components/ActivityCharts.tsx`: Custom chart components (ChartCard, ChartLegend, DateLabels) — may wrap or replace with Recharts
- `ui/src/pages/Costs.tsx`: Costs page with tabs (summary, by-agent, by-project) — add Analytics tab
- `ui/src/components/TokenBreakdown.tsx`: Token breakdown display — reuse in trace node detail
- `ui/src/components/ContextUtilizationBar.tsx`: Progress bar — reuse in trace summary
- `ui/src/context/LiveUpdatesProvider.tsx`: WebSocket handler — extend for activity events
- `ui/src/pages/AgentDetail.tsx`: Run detail panel — add Trace tab

### Established Patterns
- Tab-based page layout (Costs page already uses tabs)
- React Query for data fetching with queryKeys
- WebSocket-to-QueryCache bridge via LiveUpdatesProvider
- Card-based metric display on Costs page

### Integration Points
- `ui/src/pages/AgentDetail.tsx`: Run detail panel needs Trace tab
- `ui/src/pages/Costs.tsx`: Add Analytics/Charts tab
- `ui/src/pages/Activity.tsx`: Replace single filter with multi-filter bar
- `ui/src/api/costs.ts`: May need new endpoints for time-series data
- `server/src/services/costs.ts`: Backend aggregation for chart data
- `packages/db/src/schema/activity_log.ts`: Activity log schema — may need severity field

</code_context>

<deferred>
## Deferred Ideas

- Historical run comparison (side-by-side diff) — v2 MNTR-04
- Agent timeline view (Gantt chart of activity over time) — v2 MNTR-05
- Run replay / time-travel debugging — v2 MNTR-06

</deferred>

---

*Phase: 03-observability-monitoring-ux*
*Context gathered: 2026-03-11*
