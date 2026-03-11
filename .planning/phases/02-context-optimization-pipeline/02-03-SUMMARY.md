---
phase: 02-context-optimization-pipeline
plan: 03
subsystem: api, ui
tags: [context-pipeline, budget-enforcement, compaction, usage-tracking, budget-bar, live-updates]

# Dependency graph
requires:
  - phase: 02-context-optimization-pipeline
    plan: 01
    provides: "runContextPipeline, defaultProcessors, PipelineContext types"
  - phase: 02-context-optimization-pipeline
    plan: 02
    provides: "resolveBudget, BudgetConfig, usage tracker budget/onBudgetWarning support"
  - phase: 01-token-analytics-foundation
    provides: "ContextUtilizationBar, TokenBreakdown, live usage events, UsageJsonExtended"
provides:
  - "End-to-end context pipeline integration in heartbeat execution"
  - "Issue label fetching for task-type resolution"
  - "Budget resolution from three-tier hierarchy wired into usage tracker"
  - "Wind-down warning at 90% threshold logged to agent stderr"
  - "CLAUDE_AUTOCOMPACT_PCT_OVERRIDE env var injection in Claude adapter"
  - "BudgetBar UI component with green/yellow/red thresholds"
  - "Live budget display via WebSocket usage events"
  - "Compression ratio and task type stored in usageJson analytics"
  - "Budget bar in run detail and live counter"
  - "Compression ratio metric card on Costs page"
affects: [03-phase-analytics, ui-budget-display, operator-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns: [pipeline-integration-in-heartbeat, budget-aware-usage-tracker, live-budget-events]

key-files:
  created:
    - ui/src/components/BudgetBar.tsx
  modified:
    - server/src/services/heartbeat.ts
    - packages/adapters/claude-local/src/server/execute.ts
    - packages/shared/src/types/usage.ts
    - ui/src/context/LiveUpdatesProvider.tsx
    - ui/src/pages/AgentDetail.tsx
    - ui/src/pages/Costs.tsx
    - ui/src/pages/DesignGuide.tsx

key-decisions:
  - "Budget resolved before usageTracker creation so budget config can be passed to tracker"
  - "onLog and usageTracker use let/closure pattern to resolve circular dependency"
  - "Pipeline runs synchronously before adapter.execute() on every run"
  - "Compression ratio metric on Costs page uses safe cast since aggregate API deferred to Phase 3"
  - "BudgetBar thresholds: green below 80%, yellow 80-95%, red above 95% per CONTEXT.md"

patterns-established:
  - "Pipeline integration pattern: fetch labels + issue -> build PipelineContext -> runContextPipeline -> use optimizedContext"
  - "Budget-aware live events: usage events include budgetMaxTokens and budgetSource for UI"
  - "Progressive enhancement: BudgetBar shows progress bar with budget, text-only without"

requirements-completed: [TOPT-01, TOPT-02, TOPT-03, TOPT-04, TOPT-05]

# Metrics
duration: 7min
completed: 2026-03-11
---

# Phase 2 Plan 3: Heartbeat Pipeline Integration Summary

**End-to-end context pipeline wired into heartbeat with budget enforcement, BudgetBar UI component with live updates, and CLAUDE_AUTOCOMPACT_PCT_OVERRIDE injection**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-11T18:30:09Z
- **Completed:** 2026-03-11T18:38:00Z
- **Tasks:** 3 (2 auto + 1 human verification checkpoint, approved)
- **Files modified:** 8

## Accomplishments
- Context pipeline (4 processors) runs on every agent execution, transforming context before adapter invocation
- Issue labels fetched from DB and passed to pipeline for task-type resolution
- Issue data (title, description, comments) fetched for structured brief serialization
- Budget resolved from three-tier hierarchy (run > agent > project) and passed to usage tracker
- Wind-down warning fires at 90% threshold and logs to agent stderr as [paperclip] message
- Pipeline metrics (compressionRatio, taskType) and budgetInfo stored in usageJson for analytics
- CLAUDE_AUTOCOMPACT_PCT_OVERRIDE injected into Claude adapter env when autoCompactPct configured
- BudgetBar component with green/yellow/red thresholds and no-budget text-only fallback
- Live usage events carry budget info for real-time BudgetBar updates during active runs
- Task type badge and compression ratio displayed in run detail Token Analysis section
- Compression ratio metric card added to Costs page summary
- DesignGuide updated with BudgetBar examples showing all 5 states

## Task Commits

Each task was committed atomically:

1. **Task 1: Heartbeat pipeline integration, label fetching, budget wiring, and compaction env var** - `83f5f9b` (feat)
2. **Task 2: Budget bar UI component, live budget display, and compression metrics** - `8031b85` (feat)
3. **Task 3: Verify end-to-end context optimization pipeline visually** - checkpoint:human-verify (approved)
   - BudgetBar renders correctly in all 5 states (no budget, green 30%, yellow 82%, red 96%, full red 100%)
   - Context Utilization Bar and Token Breakdown display correctly
   - Costs page renders without errors
   - Agent detail page shows token metrics, no crashes
   - Dashboard has no regressions

## Files Created/Modified
- `server/src/services/heartbeat.ts` - Pipeline integration, label fetching, budget resolution, wind-down handling, usageJson extension
- `packages/adapters/claude-local/src/server/execute.ts` - CLAUDE_AUTOCOMPACT_PCT_OVERRIDE env var injection
- `packages/shared/src/types/usage.ts` - Added compressionRatio and taskType to UsageJsonExtended
- `ui/src/components/BudgetBar.tsx` - Budget progress bar component with green/yellow/red thresholds
- `ui/src/context/LiveUpdatesProvider.tsx` - Extended live usage cache with budgetMaxTokens and budgetSource
- `ui/src/pages/AgentDetail.tsx` - BudgetBar in run detail and live counter, task type badge, compression ratio
- `ui/src/pages/Costs.tsx` - Compression ratio metric card, cache pricing tooltip
- `ui/src/pages/DesignGuide.tsx` - BudgetBar section with all 5 states

## Decisions Made
- Budget resolved before usageTracker creation so budget config can be passed to tracker at construction time
- Used let/closure pattern for circular reference between onLog and usageTracker (onLog calls processChunk, onBudgetWarning calls onLog)
- Pipeline runs synchronously before adapter.execute() on every run -- no async processors needed currently
- Compression ratio metric on Costs page uses safe cast since aggregate API is deferred to Phase 3
- BudgetBar thresholds set at 80%/95% per CONTEXT.md decision (different from ContextUtilizationBar's 60%/85%)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed circular reference between onLog and usageTracker**
- **Found during:** Task 1 (heartbeat integration)
- **Issue:** Plan specified adding budget to usageTracker creation, but onLog (defined after tracker) references usageTracker.processChunk, and onBudgetWarning needs to call onLog -- circular const reference
- **Fix:** Changed usageTracker to `let` variable, moved onLog definition before tracker assignment
- **Files modified:** server/src/services/heartbeat.ts
- **Verification:** All 324 server tests pass
- **Committed in:** 83f5f9b (Task 1 commit)

**2. [Rule 1 - Bug] Fixed TypeScript type errors for UsageJsonExtended fields**
- **Found during:** Task 2 (BudgetBar UI)
- **Issue:** compressionRatio and taskType not declared on UsageJsonExtended type, and CostSummary lacks avgCompressionRatio
- **Fix:** Added compressionRatio and taskType to UsageJsonExtended; used safe cast for Costs page compression ratio display
- **Files modified:** packages/shared/src/types/usage.ts, ui/src/pages/Costs.tsx
- **Verification:** UI TypeScript compiles cleanly
- **Committed in:** 8031b85 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for correct compilation. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 2 (Context Optimization Pipeline) is complete
- All 5 TOPT requirements addressed:
  - TOPT-01: Context serializer produces structured briefs with compression ratio tracking
  - TOPT-02: Budget enforcement with three-tier hierarchy, 90% wind-down, UI bar
  - TOPT-03: Task-type resolution from labels with auto-detect fallback
  - TOPT-04: Deduplication processor + CLAUDE_AUTOCOMPACT_PCT_OVERRIDE for compaction
  - TOPT-05: Prompt reorderer documents 4-layer structure, cache hit rates already tracked
- Ready for Phase 3 (analytics dashboards) or Phase 4 (notifications/agent capabilities)
- 324 server tests pass, UI compiles cleanly

## Self-Check: PASSED

- All 8 created/modified files exist on disk
- All 2 task commits verified in git history (83f5f9b, 8031b85)
- Full server test suite: 324 tests pass (47 test files), 0 failures
- UI TypeScript compilation: clean, no errors

---
*Phase: 02-context-optimization-pipeline*
*Completed: 2026-03-11*
