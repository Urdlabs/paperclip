---
phase: 05-merge-preparation
plan: 03
subsystem: testing
tags: [vitest, supertest, canary-tests, regression, exports]

requires:
  - phase: none
    provides: fork-only modules already exist
provides:
  - Feature manifest documenting all v1.0-specific code paths
  - Canary export tests verifying 32 fork-only exports
  - API smoke tests verifying 4 fork-only route groups
affects: [06-merge-execution, 07-merge-verification]

tech-stack:
  added: []
  patterns: [canary-export-tests, api-smoke-tests]

key-files:
  created:
    - .planning/FEATURE-MANIFEST.md
    - server/src/__tests__/v1-feature-exports.test.ts
    - server/src/__tests__/v1-api-smoke.test.ts
  modified: []

key-decisions:
  - "Used dynamic import() for cross-package imports (@paperclipai/db, @paperclipai/shared)"
  - "API smoke tests use GET-only endpoints to minimize mock complexity"
  - "Tests are permanent regression tests, not temporary merge aids"

patterns-established:
  - "Canary tests: verify exports exist via toBeDefined() assertions on barrel imports"
  - "API smoke tests: express + supertest with mocked services, verify route registration + response shape"

requirements-completed: [PREP-04]

duration: 5min
completed: 2026-03-12
---

# Plan 05-03: Feature Manifest & Canary Tests Summary

**Feature manifest with 50+ checklist items and canary/smoke tests covering 32 exports and 4 route groups**

## Performance

- **Duration:** 5 min
- **Tasks:** 3
- **Files created:** 3

## Accomplishments
- Feature manifest documenting all fork-only DB tables, services, routes, shared types, and UI components
- Canary tests verifying 6 DB exports, 16 service exports, 4 route exports, 6 shared package exports
- API smoke tests for GitHub, webhooks, and skill-profile route groups (all return 200)
- All 455 tests pass including the 8 new canary/smoke tests

## Task Commits

1. **Task 1: Create fork feature manifest** - `7da147d` (feat)
2. **Task 2: Create canary export tests** - `b5db84b` (test)
3. **Task 3: Create API smoke tests** - `5034382` (test)

## Files Created/Modified
- `.planning/FEATURE-MANIFEST.md` - Checklist of all v1.0-specific code paths grouped by feature area
- `server/src/__tests__/v1-feature-exports.test.ts` - Import canary tests for 32 fork-only exports
- `server/src/__tests__/v1-api-smoke.test.ts` - API smoke tests for 4 fork-only route groups

## Decisions Made
- Used static ESM imports (not require()) matching project test patterns
- Mocked services to return safe defaults (empty arrays, false booleans)

## Deviations from Plan
None - plan executed as specified.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Canary tests will catch any accidentally removed fork exports during upstream merge
- API smoke tests will catch any accidentally unregistered routes during merge
- Feature manifest provides human-readable checklist for post-merge verification

---
*Phase: 05-merge-preparation*
*Completed: 2026-03-12*
