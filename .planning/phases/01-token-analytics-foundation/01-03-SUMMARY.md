---
phase: 01-token-analytics-foundation
plan: 03
subsystem: ui
tags: [react, token-analytics, costs-page, live-counter, websocket, design-guide]

# Dependency graph
requires: [01-01, 01-02]
provides:
  - Extended Costs page with token metrics (summary, by-agent, by-project)
  - TokenBreakdown reusable component
  - ContextUtilizationBar reusable component
  - Live token counter on agent card during active runs
  - Token Analysis section in run detail panel
  - WebSocket heartbeat.run.usage handler in LiveUpdatesProvider
  - Design guide sections for new token components
affects: [02-context-optimization-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns: [query-cache-as-live-state, websocket-to-react-query-bridge]

key-files:
  created:
    - ui/src/components/TokenBreakdown.tsx
    - ui/src/components/ContextUtilizationBar.tsx
  modified:
    - ui/src/api/costs.ts
    - ui/src/pages/Costs.tsx
    - ui/src/pages/AgentDetail.tsx
    - ui/src/pages/DesignGuide.tsx
    - ui/src/context/LiveUpdatesProvider.tsx
    - ui/src/lib/queryKeys.ts

key-decisions:
  - "Live usage data stored in React Query cache via setQueryData, not via query refetch, to avoid refetch storms"
  - "Token analysis is a section in run detail, not a separate tab"
  - "Color-coded context utilization: green <60%, yellow 60-85%, red >85%"

patterns-established:
  - "WebSocket-to-QueryCache bridge: LiveUpdatesProvider setQueryData for real-time UI state without refetching"
  - "Reusable token visualization components: TokenBreakdown and ContextUtilizationBar"

requirements-completed: [TOKN-01, TOKN-02, TOKN-03, TOKN-04]

# Metrics
duration: ~5min
completed: 2026-03-10
---

# Phase 1 Plan 03: Token Analytics UI Summary

**Extended Costs page with token metrics, reusable token breakdown and context utilization components, live token counter during active runs, and WebSocket usage event handling**

## Performance

- **Duration:** ~5 min
- **Completed:** 2026-03-10
- **Tasks:** 2 (code) + 1 (visual verification pending)
- **Files modified:** 8

## Accomplishments
- Extended Costs page summary tab with Total Tokens, Cache Hit Rate, Avg Tokens/Run metric cards
- Added Cached Tokens and Cache Efficiency columns to Costs by-agent and by-project tables
- Created TokenBreakdown component showing prompt component breakdown with percentages and bars
- Created ContextUtilizationBar with color-coded thresholds (green/yellow/red)
- Added Token Analysis section to RunDetail with context utilization bar and token breakdown
- Added live token counter on agent card during active Claude runs
- Implemented heartbeat.run.usage WebSocket handler in LiveUpdatesProvider using query cache
- Added liveUsage query key to queryKeys
- Updated DesignGuide with sections for both new components

## Task Commits

Each task was committed atomically:

1. **Task 1: Costs page, token components, design guide** - `0d88070` (feat)
2. **Task 2: Run detail, live counter, WebSocket integration** - `3958c7c` (feat)

## Files Created/Modified
- `ui/src/components/TokenBreakdown.tsx` - Reusable token breakdown display component
- `ui/src/components/ContextUtilizationBar.tsx` - Context window utilization progress bar
- `ui/src/api/costs.ts` - Added cachedInputTokens to CostByProject interface
- `ui/src/pages/Costs.tsx` - Extended all three tabs with token analytics data
- `ui/src/pages/AgentDetail.tsx` - Token Analysis section in RunDetail, live counter on agent card
- `ui/src/pages/DesignGuide.tsx` - Design guide sections for TokenBreakdown and ContextUtilizationBar
- `ui/src/context/LiveUpdatesProvider.tsx` - heartbeat.run.usage WebSocket handler
- `ui/src/lib/queryKeys.ts` - Added liveUsage query key

## Decisions Made
- Live usage stored in React Query cache via setQueryData to avoid refetch storms
- Token analysis is a section in run detail (not a separate tab) for quick visibility
- Context utilization uses traffic-light colors: green <60%, yellow 60-85%, red >85%

## Deviations from Plan

None - plan executed as written.

## Issues Encountered
None

## User Setup Required

None - UI changes are purely frontend.

## Next Phase Readiness
- Phase 1 Token Analytics Foundation is complete
- All TOKN-01 through TOKN-04 requirements have UI representation
- Token data pipeline is end-to-end: estimation → storage → streaming → display

## Self-Check: PASSED

All 8 files verified. Both commits verified in git log. Server build clean. UI build clean. 252 tests pass.

---
*Phase: 01-token-analytics-foundation*
*Completed: 2026-03-10*
