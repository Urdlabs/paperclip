---
phase: 03-observability-monitoring-ux
plan: 03
subsystem: ui
tags: [recharts, charts, analytics, react-query, css-variables, donut-chart, line-chart, bar-chart]

# Dependency graph
requires:
  - phase: 01-token-tracking-cost-visibility
    provides: "costEvents table, cost API endpoints (summary, by-agent, by-project), CSS chart variables"
  - phase: 02-context-optimization-pipeline
    provides: "heartbeatRuns.usageJson breakdown field with context composition data"
provides:
  - "Recharts + shadcn/ui chart wrappers (ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent)"
  - "Time-series aggregation endpoint (GET /costs/time-series) with day/week bucketing"
  - "Context composition endpoint (GET /costs/context-composition)"
  - "AnalyticsCharts component with 4 interactive charts"
  - "Analytics tab on Costs page"
  - "Chart utility functions (formatChartDate, formatTokenCount, formatCostCents)"
affects: []

# Tech tracking
tech-stack:
  added: [recharts]
  patterns: [ChartContainer wrapper for Recharts theme integration, ChartConfig type for chart color/label mapping]

key-files:
  created:
    - ui/src/components/ui/chart.tsx
    - ui/src/lib/chart-utils.ts
    - ui/src/lib/chart-utils.test.ts
    - ui/src/components/AnalyticsCharts.tsx
  modified:
    - server/src/services/costs.ts
    - server/src/routes/costs.ts
    - ui/src/api/costs.ts
    - ui/src/lib/queryKeys.ts
    - ui/src/pages/Costs.tsx
    - ui/src/pages/DesignGuide.tsx
    - ui/package.json

key-decisions:
  - "Used inline chart wrappers instead of shadcn CLI (CLI not available, manual creation matches shadcn/ui pattern)"
  - "Costs page uses simple tab navigation instead of PageTabBar to keep minimal changes to existing page structure"
  - "Auto-switch date preset to 30d when entering analytics tab (per CONTEXT.md default)"
  - "Summary tab query disabled when analytics tab is active to avoid unnecessary API calls"

patterns-established:
  - "ChartConfig pattern: config objects map data keys to labels and CSS variable colors"
  - "Chart wrapper pattern: ChartContainer provides context, ChartTooltipContent/ChartLegendContent read from it"

requirements-completed: [MNTR-03]

# Metrics
duration: 7min
completed: 2026-03-11
---

# Phase 3 Plan 3: Analytics Dashboard Summary

**Recharts-powered analytics dashboard with 4 interactive charts (token trend, cost per agent/project, context composition donut) integrated as a new tab on the Costs page**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-12T02:07:09Z
- **Completed:** 2026-03-12T02:14:18Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Installed Recharts and created shadcn/ui-compatible chart wrapper components
- Built backend time-series and context-composition aggregation endpoints
- Created AnalyticsCharts component with 4 responsive charts using themed CSS variables
- Integrated Analytics tab on Costs page with shared date range selector
- Added chart demo section to DesignGuide with mock data
- All 37 tests pass (9 new chart-utils tests + 28 existing)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Recharts, add shadcn chart component, create backend time-series endpoint, and chart utilities** - `4e69a25` (feat)
2. **Task 2: AnalyticsCharts component and Costs page tab integration** - `444ea42` (feat)

## Files Created/Modified
- `ui/src/components/ui/chart.tsx` - shadcn/ui chart wrapper components (ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent)
- `ui/src/lib/chart-utils.ts` - Utility functions for formatting chart dates, token counts, and cost cents
- `ui/src/lib/chart-utils.test.ts` - 9 tests for chart utility functions
- `ui/src/components/AnalyticsCharts.tsx` - Analytics tab content with 4 charts (line, bar x2, donut)
- `server/src/services/costs.ts` - Added timeSeries (date_trunc bucketing) and contextComposition (breakdown aggregation) methods
- `server/src/routes/costs.ts` - Added GET /costs/time-series and GET /costs/context-composition routes
- `ui/src/api/costs.ts` - Added timeSeries and contextComposition API client methods + TypeScript interfaces
- `ui/src/lib/queryKeys.ts` - Added costsTimeSeries and costsContextComposition query keys
- `ui/src/pages/Costs.tsx` - Added Analytics tab with tab navigation, auto-switches to 30d date preset
- `ui/src/pages/DesignGuide.tsx` - Added Analytics Charts section with 3 demo charts (line, bar, donut)
- `ui/package.json` - Added recharts dependency

## Decisions Made
- Created chart.tsx manually instead of using shadcn CLI -- the CLI was not readily available, and manual creation ensures the exact exports needed (ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent) match the shadcn/ui pattern
- Used simple tab navigation (border-b underline style) for the Costs page rather than integrating with PageTabBar -- the existing page uses inline rendering and this keeps the change footprint small
- Summary tab data fetching is disabled when analytics tab is active (React Query `enabled` flag) to avoid unnecessary API calls
- Pie chart labels show inline percentage (not using separate label lines) since the donut style makes label lines visually crowded

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript type compatibility for Recharts Pie label prop**
- **Found during:** Task 2 (AnalyticsCharts and DesignGuide)
- **Issue:** Recharts PieLabelRenderProps has `name?: string` and `percent?: number` (both optional), causing type errors with the label callback
- **Fix:** Updated label function parameter types to use optional properties with fallback defaults
- **Files modified:** ui/src/components/AnalyticsCharts.tsx, ui/src/pages/DesignGuide.tsx
- **Verification:** UI typecheck passes clean
- **Committed in:** 444ea42 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Minor type compatibility fix. No scope creep.

## Issues Encountered
- The vitest `-x` flag (bail on first failure) is not supported in vitest v3.2.4 -- used plain `vitest run` instead. Not blocking.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 3 analytics dashboard complete -- all MNTR-03 requirements satisfied
- Charts use existing API data + 2 new endpoints, all fully typed end-to-end
- ChartContainer/ChartConfig pattern available for any future chart needs

## Self-Check: PASSED

All 11 files verified present. Both task commits verified in git log (4e69a25, 444ea42).

---
*Phase: 03-observability-monitoring-ux*
*Completed: 2026-03-11*
