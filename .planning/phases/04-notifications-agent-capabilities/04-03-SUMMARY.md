---
phase: 04-notifications-agent-capabilities
plan: 03
subsystem: api, database, pipeline
tags: [skill-profiles, agent-behavior, prompt-augmentation, drizzle, express, vitest]

# Dependency graph
requires:
  - phase: 02-context-optimization
    provides: context pipeline with processor chain and PipelineContext type
provides:
  - skill_profiles DB table with 6 predefined profiles per company
  - skillProfileService for CRUD and builtin profile seeding
  - resolveSkillProfile pipeline processor for prompt augmentation
  - REST API for skill profile management (/companies/:companyId/skill-profiles)
  - heartbeat integration resolving skillProfileId from agent runtimeConfig
affects: [04-notifications-agent-capabilities, agent-settings-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [pipeline processor for prompt injection, idempotent seed with onConflictDoNothing]

key-files:
  created:
    - packages/db/src/schema/skill_profiles.ts
    - packages/shared/src/types/skill-profiles.ts
    - packages/shared/src/validators/skill-profiles.ts
    - server/src/services/skill-profiles.ts
    - server/src/context-pipeline/processors/skill-profile-resolver.ts
    - server/src/routes/skill-profiles.ts
    - server/src/__tests__/skill-profile-resolver.test.ts
  modified:
    - server/src/context-pipeline/types.ts
    - server/src/context-pipeline/index.ts
    - server/src/services/heartbeat.ts
    - server/src/services/index.ts
    - server/src/routes/index.ts
    - server/src/app.ts
    - server/src/__tests__/context-pipeline.test.ts
    - packages/shared/src/constants.ts
    - packages/shared/src/index.ts
    - packages/shared/src/types/index.ts
    - packages/shared/src/validators/index.ts
    - packages/db/src/schema/index.ts

key-decisions:
  - "Skill profile prompt injection uses markdown headers (## Skill Profile: Name) for clear delineation in agent prompt"
  - "resolveSkillProfile processor placed after task-type resolution, before serialization in pipeline chain"
  - "Profile resolved in heartbeat before pipeline runs, passed via PipelineContext.skillProfile field"
  - "Builtin profiles cannot be modified or deleted via API (403 Forbidden)"
  - "Seed endpoint is idempotent using onConflictDoNothing on company+slug unique index"

patterns-established:
  - "Pipeline processor for agent behavior augmentation: add to PipelineContext type, create processor, insert into defaultProcessors"
  - "Profile-based prompt injection: orthogonal to task-type routing, both contribute independently"

requirements-completed: [AGNT-02]

# Metrics
duration: 8min
completed: 2026-03-12
---

# Phase 4 Plan 3: Agent Skill Profiles Summary

**Six predefined skill profiles with DB-backed CRUD, pipeline prompt injection, heartbeat integration, and REST API for profile management**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-12T04:19:35Z
- **Completed:** 2026-03-12T04:28:01Z
- **Tasks:** 2
- **Files modified:** 19

## Accomplishments
- skill_profiles DB table with company+slug unique index and 6 predefined profiles (Refactor, Test Writer, Reviewer, Debugger, Architect, Documentation Writer)
- skillProfileService with full CRUD, getBySlug, and idempotent seedBuiltinProfiles using onConflictDoNothing
- resolveSkillProfile pipeline processor that augments promptTemplate with profile name, systemPromptAdditions, and optional outputFormatHints
- REST API with GET list, GET by ID, POST create, PATCH update (rejects builtin), DELETE (rejects builtin), POST seed
- Heartbeat resolves skillProfileId from agent runtimeConfig and passes profile to pipeline via PipelineContext.skillProfile
- Shared types (SkillProfile, SkillProfileSummary), constants (BUILTIN_SKILL_PROFILE_SLUGS), and validators (createSkillProfileSchema, updateSkillProfileSchema)

## Task Commits

Each task was committed atomically:

1. **Task 1: Skill profile schema, service, pipeline processor, and tests** - `9160dce` (feat, TDD)
2. **Task 2: Skill profile routes, heartbeat integration, and agent assignment** - `0f426ad` (feat)

## Files Created/Modified
- `packages/db/src/schema/skill_profiles.ts` - skill_profiles table with company+slug unique index
- `packages/shared/src/types/skill-profiles.ts` - SkillProfile and SkillProfileSummary types
- `packages/shared/src/validators/skill-profiles.ts` - Zod schemas for create/update
- `server/src/services/skill-profiles.ts` - CRUD service + BUILTIN_SKILL_PROFILES constant with 6 profiles
- `server/src/context-pipeline/processors/skill-profile-resolver.ts` - Pipeline processor for prompt augmentation
- `server/src/routes/skill-profiles.ts` - REST API routes under /companies/:companyId/skill-profiles
- `server/src/__tests__/skill-profile-resolver.test.ts` - 8 tests for processor behavior
- `server/src/context-pipeline/types.ts` - Added skillProfile optional field to PipelineContext
- `server/src/context-pipeline/index.ts` - Added resolveSkillProfile to defaultProcessors chain
- `server/src/services/heartbeat.ts` - Resolve skillProfileId from runtimeConfig before pipeline
- `server/src/__tests__/context-pipeline.test.ts` - Updated processor count expectation (4 -> 5)

## Decisions Made
- Skill profile prompt injection uses markdown section headers for clear delineation
- resolveSkillProfile runs after task-type resolution but before serialization (position 2 in chain)
- Profile is resolved in heartbeat, not in the processor itself (processor reads from context, not DB)
- Builtin profiles are protected from modification/deletion (403 Forbidden response)
- Seed endpoint uses onConflictDoNothing for idempotent operation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed import path for @paperclipai/db**
- **Found during:** Task 2 (full test suite run)
- **Issue:** skill-profiles service used `@paperclipai/db/schema` which doesn't exist as a package export
- **Fix:** Changed import to `@paperclipai/db` which re-exports all schema tables
- **Files modified:** server/src/services/skill-profiles.ts
- **Verification:** All 446 tests pass
- **Committed in:** 0f426ad (Task 2 commit)

**2. [Rule 1 - Bug] Updated context-pipeline test processor count**
- **Found during:** Task 2 (full test suite run)
- **Issue:** Existing test expected 4 processors in defaultProcessors, but adding resolveSkillProfile made it 5
- **Fix:** Updated test expectation from 4 to 5
- **Files modified:** server/src/__tests__/context-pipeline.test.ts
- **Verification:** All 446 tests pass
- **Committed in:** 0f426ad (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both auto-fixes necessary for test correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Skill profiles fully operational: DB, service, pipeline processor, REST API, heartbeat integration
- Operators can assign profiles to agents via existing PATCH /agents/:agentId with runtimeConfig.skillProfileId
- Profile prompt injection is orthogonal to task-type routing (both run independently in pipeline)
- Ready for UI skill profile selector component in future work

## Self-Check: PASSED

All 8 created files verified present. Both commit hashes (9160dce, 0f426ad) verified in git log.

---
*Phase: 04-notifications-agent-capabilities*
*Completed: 2026-03-12*
