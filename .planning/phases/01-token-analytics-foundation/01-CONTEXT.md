# Phase 1: Token Analytics Foundation - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Instrument token consumption per run with cost attribution and real-time visibility. Operators can see exactly where every token goes -- per run, per agent, per project -- with live updates during execution. Requirements: TOKN-01, TOKN-02, TOKN-03, TOKN-04.

</domain>

<decisions>
## Implementation Decisions

### Token breakdown categories
- Estimate tokens for each prompt component using char heuristic (~4 chars/token): system prompt, skills/tools definitions, issue context, file content, conversation history
- Initial prompt components only -- do not parse individual tool calls during execution (Phase 1 scope)
- Store breakdown at run time in DB, not computed on-demand
- Calibrate estimation accuracy over time by comparing estimated vs actual totals

### Dashboard & visualization
- Extend existing Costs page with token analytics data -- do not create a separate page
- Tables only for Phase 1 -- charts and visual trends deferred to Phase 3 (MNTR-03)
- Add token data to summary tab: total tokens, cache hit rate, avg tokens/run
- Add cached tokens and efficiency columns to by-agent and by-project tables

### Per-run token detail
- Token breakdown visible in run detail panel (tab alongside transcript)
- Context window utilization bar integrated into run detail: "Context: 68% used (17K / 25K tokens)"
- Stacked breakdown showing each prompt component with token count and percentage

### Real-time token counter
- Parse Claude adapter stdout for JSON events containing usage data during run
- Emit new `heartbeat.run.usage` live event type via WebSocket
- Show compact token counter on agent card when running: "Tokens: 12.4K  $0.02"
- Show updating breakdown in run detail panel during active runs
- Other adapters (Codex, Cursor, etc.) show tokens only at completion -- Claude gets live updates

### Data model
- Add `cachedInputTokens` (integer, default 0) column to `cost_events` table -- enables SQL aggregation of cache hit rates
- Extend `heartbeat_runs.usageJson` JSONB with `breakdown` object: `{systemPrompt, skillsTools, issueContext, fileContent, history}` (estimated token counts)
- Store `contextWindowSize` in usageJson -- looked up from static model context limits map at run time
- No new tables needed -- extend existing schema

### Claude's Discretion
- Exact prompt component parsing logic (where to split system prompt vs skills vs context)
- Static model context window size map (which models, what limits)
- Token counter update frequency / debouncing on the UI side
- How to handle non-Claude adapters that don't stream usage data (show "N/A" or "completion only")

</decisions>

<specifics>
## Specific Ideas

- Run detail mockup: context window utilization bar at top, then stacked component breakdown with percentages, then input/output/cached totals with cost
- Agent card shows compact "Tokens: 12.4K  $0.02" with refresh indicator when running
- Cache hit rate is a key metric to surface prominently -- it validates Phase 2 prompt caching work
- The char heuristic (~4 chars/token) is intentionally approximate -- the goal is percentage breakdowns, not exact counts

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `cost_events` table (packages/db/src/schema/cost_events.ts): Already tracks inputTokens, outputTokens, costCents per run. Add cachedInputTokens column.
- `agent_runtime_state` table: Already has totalCachedInputTokens accumulator -- pattern exists for the new column
- `heartbeat_runs.usageJson` (JSONB): Already stores per-run inputTokens, outputTokens, cachedInputTokens, costUsd, billingType. Extend with breakdown and contextWindowSize.
- Claude adapter parse.ts (packages/adapters/claude-local/src/server/parse.ts): Already extracts cache_read_input_tokens from Claude output. Pattern for parsing usage events during streaming.
- Costs page (ui/src/pages/Costs.tsx): Existing tabs (Summary, By Agent, By Project) with date range filters. Extend with token data.
- costsApi (ui/src/api/costs.ts): Existing API client for summary, byAgent, byProject endpoints. Extend response types.
- Cost service (server/src/services/costs.ts): Existing aggregation queries. Extend with cached token aggregation.

### Established Patterns
- Service factory pattern: `costService(db)` returns methods -- add new analytics methods here
- Live event publishing: `publishLiveEvent()` in live-events.ts -- add new "heartbeat.run.usage" type
- LIVE_EVENT_TYPES const array in packages/shared/src/constants.ts -- extend with new type
- UsageSummary interface in adapter-utils types.ts -- already has cachedInputTokens optional field
- UI query cache invalidation: LiveUpdatesProvider invalidates React Query on live events -- extend for usage events

### Integration Points
- heartbeat.ts executeRun(): Token estimation happens here before adapter.execute() -- compute breakdown from prompt components
- heartbeat.ts after adapter result: Store breakdown in usageJson, record cachedInputTokens in cost_events
- Adapter log streaming: Parse Claude JSON events during onLog callback for real-time usage extraction
- WebSocket live-events-ws.ts: Already dispatches events to connected clients -- new event type flows through automatically

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 01-token-analytics-foundation*
*Context gathered: 2026-03-09*
