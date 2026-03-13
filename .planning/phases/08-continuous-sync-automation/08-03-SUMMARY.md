---
phase: 08-continuous-sync-automation
plan: 03
subsystem: infra
tags: [github-actions, effort-estimation, upstream-sync, heuristics]

# Dependency graph
requires:
  - phase: 08-continuous-sync-automation
    provides: upstream sync workflow with area-grouped PR/issue bodies
provides:
  - effort estimation per area section in sync PR body
  - effort estimation per area section in conflict issue body
  - classify_effort() heuristic (file count + migration type)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "classify_effort() duplicated per GHA step (same pattern as classify_area())"
    - "Blockquote format for metadata lines in PR/issue bodies"

key-files:
  created: []
  modified:
    - .github/workflows/upstream-sync.yml

key-decisions:
  - "Effort heuristic uses file count + migration presence (simple/moderate/complex)"
  - "Conflict issue computes file count from area_files content via grep rather than a separate counter"

patterns-established:
  - "Effort estimation blockquote after area headers: > Estimated effort: N files (level)"

requirements-completed: [SYNC-03]

# Metrics
duration: 2min
completed: 2026-03-13
---

# Phase 8 Plan 3: Effort Estimation Summary

**Per-area effort estimation (simple/moderate/complex) added to sync PR and conflict issue bodies using file count and migration type heuristics**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-13T16:12:26Z
- **Completed:** 2026-03-13T16:14:01Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added `classify_effort()` function to both PR and issue steps with tiered heuristic (1-2 files = simple, 3-5 = moderate, 6+ = complex)
- Migration files (`*/migrations/*`) automatically bump effort to at least moderate
- Effort line rendered as blockquote per area section in both sync PR and conflict issue bodies
- SYNC-03 gap closed: area categorization AND estimated resolution effort both present

## Task Commits

Each task was committed atomically:

1. **Task 1: Add effort estimation to sync PR and conflict issue bodies** - `4c652d9` (feat)

## Files Created/Modified
- `.github/workflows/upstream-sync.yml` - Added classify_effort() function and effort estimation lines in both "Create sync PR" and "Create conflict issue" steps

## Decisions Made
- Effort heuristic uses file count thresholds (1-2/3-5/6+) plus migration file type override -- keeps it simple and deterministic without needing language-specific analysis
- Conflict issue step computes file count from area_files content via `grep -c '^- '` rather than maintaining a separate counter, since the file list is already built

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 8 gap closure complete: all SYNC verification gaps (SYNC-01 through SYNC-03) now addressed
- Upstream sync workflow fully satisfies ROADMAP success criteria for conflict categorization and estimated resolution effort

## Self-Check: PASSED

- FOUND: .github/workflows/upstream-sync.yml
- FOUND: 08-03-SUMMARY.md
- FOUND: commit 4c652d9

---
*Phase: 08-continuous-sync-automation*
*Completed: 2026-03-13*
