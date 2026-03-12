---
phase: 03-observability-monitoring-ux
plan: 02
subsystem: ui
tags: [react, activity-feed, filtering, url-params, severity, drizzle, express]

# Dependency graph
requires:
  - phase: 01-real-time-monitoring
    provides: "Activity logging infrastructure and WebSocket LiveUpdatesProvider"
provides:
  - "Multi-filter activity bar with Agent, Project, Type, Severity dropdowns"
  - "Server-side activity filtering by project (via issue join) and severity (via action pattern)"
  - "deriveSeverity() utility for action-to-severity mapping"
  - "URL query param persistence for activity filters"
  - "useActivityFilters() hook for reading filter state from URL"
affects: [04-notifications-agent-capabilities]

# Tech tracking
tech-stack:
  added: []
  patterns: [url-param-filter-sync, server-side-severity-filtering, severity-derivation]

key-files:
  created:
    - ui/src/lib/severity.ts
    - ui/src/lib/severity.test.ts
    - ui/src/components/ActivityFilterBar.tsx
  modified:
    - server/src/services/activity.ts
    - server/src/routes/activity.ts
    - ui/src/api/activity.ts
    - ui/src/lib/queryKeys.ts
    - ui/src/pages/Activity.tsx
    - ui/src/pages/DesignGuide.tsx

key-decisions:
  - "Severity derived client-side and server-side from action strings using ILIKE pattern matching (no schema change)"
  - "URL params use replace mode to avoid polluting browser history"
  - "Activity list limited to 200 rows server-side for performance"
  - "Project filtering works via issue join (activity_log -> issues -> projectId)"

patterns-established:
  - "URL param filter sync: useSearchParams + setSearchParams({ replace: true }) for filter persistence"
  - "Server-side ILIKE pattern matching for derived severity filtering"
  - "FilterBar chip pattern: read URL params -> build FilterValue[] -> render removable chips"

requirements-completed: [MNTR-02]

# Metrics
duration: 4min
completed: 2026-03-12
---

# Phase 3 Plan 2: Activity Feed Filtering Summary

**Multi-filter activity bar with Agent/Project/Type/Severity dropdowns, URL query param persistence, and server-side filtering via action pattern matching**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-12T02:07:29Z
- **Completed:** 2026-03-12T02:11:02Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Severity derivation utility mapping action strings to info/warning/error with 15 passing tests
- Backend activity service extended with project filtering (via issue join) and severity filtering (via ILIKE patterns)
- Horizontal multi-filter bar component with 4 dropdowns (Agent, Project, Event Type, Severity) and active filter chips
- Activity page rewritten to use server-side filtering with URL param persistence
- Severity dots (green/yellow/red) color-code each activity row
- WebSocket real-time updates continue working via React Query prefix invalidation

## Task Commits

Each task was committed atomically:

1. **Task 1: Severity derivation (RED)** - `1822f33` (test)
2. **Task 1: Severity derivation + backend + API (GREEN)** - `3769d60` (feat)
3. **Task 2: ActivityFilterBar and Activity page** - `5aabb34` (feat)

_Note: Task 1 used TDD with RED -> GREEN commits_

## Files Created/Modified
- `ui/src/lib/severity.ts` - deriveSeverity() function and SEVERITY_LEVELS constant
- `ui/src/lib/severity.test.ts` - 15 unit tests for severity derivation
- `ui/src/components/ActivityFilterBar.tsx` - Multi-filter bar component with useActivityFilters hook
- `server/src/services/activity.ts` - Extended ActivityFilters with projectId and severity support
- `server/src/routes/activity.ts` - Route accepts projectId and severity query params
- `ui/src/api/activity.ts` - API client passes filter params as query string
- `ui/src/lib/queryKeys.ts` - Activity query key includes filter state for cache invalidation
- `ui/src/pages/Activity.tsx` - Rewritten with multi-filter bar, server-side filtering, severity dots
- `ui/src/pages/DesignGuide.tsx` - Added Activity Filter Bar section with mock data

## Decisions Made
- Severity derived from action string patterns (contains "failed"/"error" -> error, "budget"/"retry"/"slow" -> warning, else info) rather than adding a severity column to the schema
- URL params use `{ replace: true }` to avoid polluting browser history when toggling filters
- Activity list query limited to 200 rows server-side to prevent loading unbounded event data
- Project filtering implemented via existing issue join (activity events for issues in a given project)
- WebSocket invalidation works automatically because React Query prefix matches `["activity", companyId]` against `["activity", companyId, filters]`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `vitest -x` flag not available in vitest v3.2.4 (uses `--bail 1` instead) - used `--environment node` for pure utility tests since jsdom not installed
- Noted but inconsequential: vitest config specifies jsdom but the dependency is not installed; pure utility tests run fine with node environment

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Activity feed filtering complete with all 4 dimensions (agent, project, type, severity)
- Filter state shareable via URL and persists across navigation
- Ready for Phase 4 notification features that may link to filtered activity views

## Self-Check: PASSED

All 10 files verified present. All 3 commits verified in git history.

---
*Phase: 03-observability-monitoring-ux*
*Completed: 2026-03-12*
