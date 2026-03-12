---
phase: 05-merge-preparation
plan: 02
subsystem: database
tags: [drizzle, migrations, postgresql, schema]

requires:
  - phase: none
    provides: fork migrations 0026-0030 already deployed
provides:
  - Renumbered upstream migrations as 0031-0032
  - Continuous snapshot prevId chain across fork-upstream boundary
  - Migration compatibility check script
affects: [06-merge-execution]

tech-stack:
  added: []
  patterns: [migration-renumbering-for-fork-upstream-merge]

key-files:
  created:
    - packages/db/src/migrations/0031_lying_pete_wisdom.sql
    - packages/db/src/migrations/0032_tranquil_tenebrous.sql
    - packages/db/src/migrations/meta/0031_snapshot.json
    - packages/db/src/migrations/meta/0032_snapshot.json
    - scripts/check-migration-compat.ts
  modified:
    - packages/db/src/migrations/meta/_journal.json

key-decisions:
  - "Renumbered upstream 0026→0031 and 0027→0032 to avoid collision with fork's deployed 0026-0030"
  - "Updated 0031 snapshot prevId to point to fork's 0030 id for continuous chain"
  - "Preserved upstream's original timestamps in journal entries"

patterns-established:
  - "Migration renumbering: extract via git show, update prevId chain, append journal entries"
  - "Migration compat script: dry-run apply in rolled-back transaction to verify schema compatibility"

requirements-completed: [PREP-03]

duration: 5min
completed: 2026-03-12
---

# Plan 05-02: Migration Renumbering Summary

**Renumbered upstream migrations 0026-0027 to 0031-0032 with continuous snapshot chain and compatibility check script**

## Performance

- **Duration:** 5 min
- **Tasks:** 3
- **Files created:** 6

## Accomplishments
- Upstream migrations extracted and renumbered to 0031-0032 without touching fork's 0026-0030
- Snapshot prevId chain verified continuous: 0030 → 0031 → 0032
- Journal correctly indexes all 33 migrations (0-30 fork + 31-32 upstream)
- Migration compatibility check script created for pre-deployment validation

## Task Commits

1. **Task 1: Extract upstream migrations and renumber** - `c1af492` (feat)
2. **Task 2: Verify renumbering** - verified inline (snapshot chain PASS, journal PASS)
3. **Task 3: Create migration compatibility check script** - `b69a710` (feat)

## Files Created/Modified
- `packages/db/src/migrations/0031_lying_pete_wisdom.sql` - Upstream CREATE TABLE workspace_runtime_services
- `packages/db/src/migrations/0032_tranquil_tenebrous.sql` - Upstream ALTER issues/projects
- `packages/db/src/migrations/meta/0031_snapshot.json` - Snapshot with prevId → fork's 0030
- `packages/db/src/migrations/meta/0032_snapshot.json` - Snapshot with prevId → 0031
- `packages/db/src/migrations/meta/_journal.json` - Added entries at idx 31-32
- `scripts/check-migration-compat.ts` - Dry-run migration compatibility checker

## Decisions Made
- Used `git show upstream/master:` to extract SQL without merging
- Used node script for snapshot prevId update (files are 6000+ lines)

## Deviations from Plan
None - plan executed as specified.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DB migration conflicts pre-resolved for phases 6-7
- Compat script available for pre-deployment validation: `DATABASE_URL=... npx tsx scripts/check-migration-compat.ts`

---
*Phase: 05-merge-preparation*
*Completed: 2026-03-12*
