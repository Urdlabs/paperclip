---
phase: 01-token-analytics-foundation
plan: 01
subsystem: database, api, server
tags: [drizzle, token-estimation, cost-analytics, cached-tokens, context-window]

# Dependency graph
requires: []
provides:
  - cachedInputTokens column on cost_events table with migration
  - model-context-limits map with getContextWindowSize function
  - TokenBreakdown and UsageJsonExtended shared types
  - Token estimation service (estimateTokens, estimatePromptBreakdown, computeContextUtilization)
  - Extended CostSummary with totalTokens, cacheHitRate, avgTokensPerRun
  - Extended CostByAgent and CostByProject with cachedInputTokens
  - Heartbeat integration storing breakdown and contextWindowSize in usageJson
affects: [01-02, 01-03, 02-prompt-optimization]

# Tech tracking
tech-stack:
  added: []
  patterns: [token estimation via ~4 chars/token heuristic, cost service token aggregation SQL]

key-files:
  created:
    - packages/shared/src/model-context-limits.ts
    - packages/shared/src/types/usage.ts
    - server/src/services/token-estimation.ts
    - packages/db/src/migrations/0029_common_sheva_callister.sql
    - server/src/__tests__/token-estimation.test.ts
    - server/src/__tests__/model-context-limits.test.ts
    - server/src/__tests__/cost-token-analytics.test.ts
  modified:
    - packages/db/src/schema/cost_events.ts
    - packages/shared/src/types/cost.ts
    - packages/shared/src/types/index.ts
    - packages/shared/src/index.ts
    - server/src/services/heartbeat.ts
    - server/src/services/costs.ts
    - server/src/services/index.ts

key-decisions:
  - "All Claude models mapped to 200K context window with DEFAULT_CONTEXT_LIMIT fallback for unknown models"
  - "Token estimation uses ~4 chars/token heuristic as specified in context decisions"
  - "fileContent and history breakdown fields set to 0 (unknown pre-execution) per research open questions"

patterns-established:
  - "Token estimation service pattern: extract estimation logic into separate module, import from heartbeat"
  - "Cost service token aggregation: SQL SUM with coalesce for cachedInputTokens alongside existing cost queries"

requirements-completed: [TOKN-01, TOKN-02, TOKN-03]

# Metrics
duration: 7min
completed: 2026-03-10
---

# Phase 1 Plan 01: Token Analytics Data Foundation Summary

**DB schema extension with cachedInputTokens, shared types for token breakdown and model context limits, token estimation service, cost service extension with cache/token aggregation, and heartbeat integration storing breakdown in usageJson**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-10T15:18:52Z
- **Completed:** 2026-03-10T15:25:53Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Added cachedInputTokens column to cost_events with Drizzle migration 0029
- Created token estimation service with estimateTokens, estimatePromptBreakdown, and computeContextUtilization
- Created model context limits map covering all Claude models with 200K context windows
- Extended cost service summary with totalTokens, cacheHitRate, avgTokensPerRun aggregation
- Extended cost service byAgent and byProject with cachedInputTokens
- Integrated token estimation into heartbeat: breakdown and contextWindowSize stored in usageJson
- 36 new tests across 3 test files, all passing (217 total server tests green)

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema, shared types, and token estimation service with tests**
   - `f411ee0` (test) - TDD RED: failing tests for token estimation and model context limits
   - `7f62873` (feat) - TDD GREEN: implementation making all 31 tests pass

2. **Task 2: Heartbeat integration and cost service extension** - `9122ab2` (feat)

## Files Created/Modified
- `packages/db/src/schema/cost_events.ts` - Added cachedInputTokens column
- `packages/db/src/migrations/0029_common_sheva_callister.sql` - Migration adding cached_input_tokens column
- `packages/shared/src/model-context-limits.ts` - Static model context window size map
- `packages/shared/src/types/usage.ts` - TokenBreakdown and UsageJsonExtended interfaces
- `packages/shared/src/types/cost.ts` - Extended CostSummary and CostByAgent types
- `packages/shared/src/types/index.ts` - Re-exports for new usage types
- `packages/shared/src/index.ts` - Re-exports for model context limits and usage types
- `server/src/services/token-estimation.ts` - Token estimation logic
- `server/src/services/costs.ts` - Extended cost aggregation with token analytics
- `server/src/services/heartbeat.ts` - Token estimation integration and cachedInputTokens in cost_events
- `server/src/services/index.ts` - Re-export token estimation service
- `server/src/__tests__/token-estimation.test.ts` - Unit tests for token estimation
- `server/src/__tests__/model-context-limits.test.ts` - Unit tests for model context limits
- `server/src/__tests__/cost-token-analytics.test.ts` - Unit tests for extended cost service

## Decisions Made
- All Claude models mapped to 200K context window with DEFAULT_CONTEXT_LIMIT fallback for unknown models
- Token estimation uses ~4 chars/token heuristic as specified in context decisions
- fileContent and history breakdown fields set to 0 (unknown pre-execution) per research open questions
- Token estimation extracted to separate service module to avoid further bloating heartbeat.ts monolith

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Data foundation complete for Plans 02 (live event types, real-time streaming) and 03 (UI components)
- All shared types and server extensions ready for UI consumption
- Migration ready to apply on next database deployment

## Self-Check: PASSED

All 9 created files verified on disk. All 3 task commits verified in git history.

---
*Phase: 01-token-analytics-foundation*
*Completed: 2026-03-10*
