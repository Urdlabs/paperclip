---
phase: 04-notifications-agent-capabilities
plan: 02
subsystem: api
tags: [topological-sort, kahn-algorithm, dag, dependency-graph, subtasks, drizzle]

# Dependency graph
requires:
  - phase: 01-token-tracking-context-awareness
    provides: "issues table with parentId column and schema patterns"
provides:
  - "issue_dependencies table for subtask dependency edges"
  - "dependency-graph service with topologicalSort, validateNoCycle, getExecutionWaves"
  - "subtask CRUD methods on issueService"
  - "REST endpoints for subtask and dependency management"
  - "createSubtaskSchema and addDependencySchema validators"
  - "SubtaskWithDependencies and DerivedParentStatus shared types"
affects: [agent-capabilities, task-execution, issue-management]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Kahn's BFS topological sort for DAG ordering", "execution wave grouping for parallelism", "derived parent status from subtask states"]

key-files:
  created:
    - packages/db/src/schema/issue_dependencies.ts
    - server/src/services/dependency-graph.ts
    - server/src/__tests__/dependency-graph.test.ts
    - packages/db/src/migrations/0030_sharp_korath.sql
  modified:
    - packages/db/src/schema/index.ts
    - packages/shared/src/types/issue.ts
    - packages/shared/src/types/index.ts
    - packages/shared/src/validators/issue.ts
    - packages/shared/src/validators/index.ts
    - packages/shared/src/index.ts
    - server/src/services/issues.ts
    - server/src/services/index.ts
    - server/src/routes/issues.ts

key-decisions:
  - "Kahn's BFS algorithm chosen for topological sort (iterative, no recursion stack overflow risk)"
  - "Cycle detection via sorted.length !== issueIds.length check in Kahn's algorithm"
  - "Execution waves computed via BFS level ordering for maximum parallelism"
  - "Parent status derived on-the-fly from subtask states rather than stored (always fresh)"
  - "Self-dependency rejected at service layer (issueId === dependsOnId guard)"

patterns-established:
  - "DAG validation: always validate no-cycle before persisting edges in a transaction"
  - "Execution waves: group tasks by BFS level for parallel processing"
  - "Derived status: parent status computed from child states, not stored redundantly"

requirements-completed: [AGNT-01]

# Metrics
duration: 6min
completed: 2026-03-12
---

# Phase 04 Plan 02: Task Decomposition Summary

**Subtask parent-child relationships with DAG dependency ordering via Kahn's topological sort and cycle detection**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-12T04:19:17Z
- **Completed:** 2026-03-12T04:25:25Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- issue_dependencies table created with unique edge constraint and FK cascade deletes
- Dependency graph service with topologicalSort, validateNoCycle, and getExecutionWaves
- 11 unit tests covering linear chains, diamonds, cycles, single nodes, disconnected components, and wave grouping
- Issue service extended with createSubtask, listSubtasks, addDependency, removeDependency, deriveParentStatus, updateSubtaskStatus, getExecutionWaves
- 5 new REST endpoints for subtask and dependency management
- Shared types (SubtaskWithDependencies, DerivedParentStatus) and validators (createSubtaskSchema, addDependencySchema)

## Task Commits

Each task was committed atomically:

1. **Task 1: Issue dependencies schema and dependency graph service** (TDD)
   - `7c2d2f7` (test) - Failing tests for topological sort, cycle detection, execution waves
   - `140dff6` (feat) - Schema, migration, and dependency-graph service implementation
2. **Task 2: Issue service subtask extension and routes** - `d798a77` (feat)

## Files Created/Modified
- `packages/db/src/schema/issue_dependencies.ts` - Subtask dependency edge table (id, issueId, dependsOnId, companyId, createdAt)
- `packages/db/src/migrations/0030_sharp_korath.sql` - DB migration for issue_dependencies table
- `server/src/services/dependency-graph.ts` - Kahn's algorithm topological sort, cycle detection, execution wave grouping
- `server/src/__tests__/dependency-graph.test.ts` - 11 unit tests for graph algorithms
- `packages/shared/src/types/issue.ts` - SubtaskWithDependencies and DerivedParentStatus types
- `packages/shared/src/validators/issue.ts` - createSubtaskSchema and addDependencySchema
- `server/src/services/issues.ts` - Extended with subtask CRUD, dependency management, derived parent status
- `server/src/routes/issues.ts` - 5 new endpoints for subtasks and dependencies

## Decisions Made
- Used Kahn's BFS algorithm (not DFS) for topological sort -- iterative approach avoids stack overflow on deep graphs
- Cycle detection uses the Kahn's algorithm side effect (sorted.length < input.length means cycle exists)
- Execution waves computed as BFS levels from source nodes -- maximizes parallelism
- Parent status derived on-the-fly rather than stored -- always reflects current subtask states
- Self-dependency guard at service layer prevents issueId === dependsOnId
- Both issues in a dependency must share the same parentId (enforced at service layer)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing test failure in context-pipeline.test.ts (another plan added 5th processor without updating assertion) -- not related to this plan, logged to deferred-items.md
- Pre-existing typecheck failure in skill-profiles.ts (broken import path from another plan) -- not related

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Subtask and dependency infrastructure ready for agent task execution flows
- Agents can now decompose complex issues into ordered subtasks with dependency constraints
- getExecutionWaves enables parallel processing where no dependency exists

---
*Phase: 04-notifications-agent-capabilities*
*Completed: 2026-03-12*

## Self-Check: PASSED

All created files verified to exist. All commit hashes verified in git log.
