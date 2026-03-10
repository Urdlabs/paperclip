---
phase: 01-token-analytics-foundation
plan: 02
subsystem: api
tags: [websocket, live-events, streaming, claude, token-usage, debounce]

# Dependency graph
requires: []
provides:
  - Claude stdout usage parsing (parseClaudeUsageFromChunk)
  - Debounced usage tracker (createUsageTracker) with configurable interval
  - "heartbeat.run.usage" live event type for real-time token streaming
  - Heartbeat integration for Claude and non-Claude adapters
affects: [ui-live-counter, agent-card-tokens, run-detail-usage]

# Tech tracking
tech-stack:
  added: []
  patterns: [debounced-event-emission, monotonic-accumulator, stream-json-parsing]

key-files:
  created:
    - server/src/services/claude-usage-streaming.ts
    - server/src/__tests__/claude-usage-streaming.test.ts
  modified:
    - packages/shared/src/constants.ts
    - server/src/services/index.ts
    - server/src/services/heartbeat.ts

key-decisions:
  - "Timestamp-based debouncing instead of timer-based to avoid cleanup complexity"
  - "First emission is always immediate (no initial delay) for responsive UX"
  - "Monotonic accumulation (take max) handles out-of-order or duplicate events"

patterns-established:
  - "Stream parser: parseClaudeUsageFromChunk splits multi-line chunks and extracts usage from three JSON locations"
  - "Usage tracker: createUsageTracker wraps parsing + debounce + monotonic accumulation in a single factory"

requirements-completed: [TOKN-04]

# Metrics
duration: 3min
completed: 2026-03-10
---

# Phase 1 Plan 2: Real-Time Token Usage Streaming Summary

**Claude stdout stream-json parser with 2s debounced WebSocket usage events via heartbeat.run.usage live event type**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-10T15:18:47Z
- **Completed:** 2026-03-10T15:22:12Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created parseClaudeUsageFromChunk that extracts input/output/cached tokens from three JSON locations (event.usage, event.message.usage, event.result.usage)
- Built createUsageTracker with configurable debounce interval (default 2s), monotonic accumulation, and flush support
- Added "heartbeat.run.usage" to LIVE_EVENT_TYPES shared constant
- Integrated tracker into heartbeat.ts onLog callback for claude_local adapters
- Added single completion usage event for non-Claude adapters
- 14 unit tests covering parsing, debouncing, accumulation, and edge cases

## Task Commits

Each task was committed atomically:

1. **Task 1: Claude usage stream parser (RED)** - `540c10b` (test)
2. **Task 1: Claude usage stream parser (GREEN)** - `dd6ec6f` (feat)
3. **Task 2: Integrate usage tracker into heartbeat onLog** - `dd3e0a0` (feat)

## Files Created/Modified
- `server/src/services/claude-usage-streaming.ts` - Claude stdout usage parsing and debounced emission module
- `server/src/__tests__/claude-usage-streaming.test.ts` - 14 unit tests for parsing and tracker behavior
- `packages/shared/src/constants.ts` - Added "heartbeat.run.usage" to LIVE_EVENT_TYPES array
- `server/src/services/index.ts` - Re-exported createUsageTracker
- `server/src/services/heartbeat.ts` - Tracker creation, onLog integration, flush after execution, non-Claude final emit

## Decisions Made
- Used timestamp-based debouncing (checking elapsed time on each processChunk call) rather than setInterval/setTimeout timers -- avoids cleanup complexity and works naturally with fake timers in tests
- First emission is always immediate (no initial delay) so operators see tokens appear as soon as Claude starts streaming
- Monotonic accumulation (takes max of current vs parsed) handles cases where Claude may report lower intermediate values or duplicate events

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Vitest 3.2.4 does not support the `-x` flag; switched to `--bail 1` (trivial, no impact)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- heartbeat.run.usage live event is available for UI consumption
- UI components can subscribe to this event type via LiveUpdatesProvider for real-time token counters
- Non-Claude adapters emit a single usage event at completion for consistent UI behavior

## Self-Check: PASSED

All 5 files verified present. All 3 commits verified in git log.

---
*Phase: 01-token-analytics-foundation*
*Completed: 2026-03-10*
