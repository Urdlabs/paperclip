---
phase: 04-notifications-agent-capabilities
plan: 04
subsystem: api
tags: [github-api, code-review, review-provider, pull-request, installation-token]

# Dependency graph
requires:
  - phase: 01-token-usage-optimization
    provides: service factory pattern, DB infrastructure
provides:
  - ReviewProvider interface abstracting diff/review operations
  - GitHub ReviewProvider implementation with installation token auth
  - Code review orchestration service (prepareReviewContext, submitReview)
  - PR metadata extraction in GitHub App webhook handler
  - Review issue creation for reviewer-profile agents
affects: [04-05-ui-integration, future-gitlab-bitbucket-providers]

# Tech tracking
tech-stack:
  added: []
  patterns: [review-provider-interface, authenticated-fetch-wrapper, incremental-review-diffing]

key-files:
  created:
    - server/src/services/review-providers/types.ts
    - server/src/services/review-providers/github.ts
    - server/src/services/code-review.ts
    - server/src/__tests__/code-review.test.ts
  modified:
    - server/src/services/github-app.ts
    - server/src/services/index.ts

key-decisions:
  - "ReviewProvider interface uses line+side fields (not deprecated position) per Pitfall 4 in research"
  - "buildReviewPayload supports optional nitpick filtering via options parameter"
  - "Code review service uses lazy import to avoid circular dependency with github-app.ts"
  - "PR metadata (head/base SHA, refs) stored in issue description for review context"
  - "Review issue creation is best-effort (errors logged but don't fail main PR handling)"

patterns-established:
  - "ReviewProvider interface: fetchDiff, fetchExistingReviews, submitReview, compareDiff -- extensible for GitLab/Bitbucket"
  - "Authenticated fetch wrapper pattern: generateInstallationToken -> fetch wrapper with Bearer token"
  - "Incremental review context: previous review summary + compareDiff for re-reviews"

requirements-completed: [AGNT-03]

# Metrics
duration: 5min
completed: 2026-03-12
---

# Phase 4 Plan 4: Code Review Workflow Summary

**Abstracted ReviewProvider interface with GitHub implementation, code review orchestration service, and PR-to-review-issue bridge for automated code reviews**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-12T04:19:14Z
- **Completed:** 2026-03-12T04:24:15Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- ReviewProvider interface abstracts diff fetching, existing review retrieval, review submission, and diff comparison for multi-platform support
- GitHub implementation uses installation tokens for authenticated API calls with line+side fields (not deprecated position)
- Code review orchestration service prepares full review context including incremental re-review data
- GitHub App extended to create review issues with PR metadata when reviewer-profile agents exist
- 13 unit tests covering URL parsing, payload building, type structure, and nitpick filtering

## Task Commits

Each task was committed atomically:

1. **Task 1: ReviewProvider interface and GitHub implementation (TDD)**
   - `91098f1` (test) - Failing tests for ReviewProvider and GitHub implementation
   - `7c79283` (feat) - ReviewProvider interface, types, GitHub implementation
2. **Task 2: Code review orchestration service and GitHub App PR trigger** - `23049f1` (feat)

## Files Created/Modified
- `server/src/services/review-providers/types.ts` - ReviewProvider interface, ReviewComment, ReviewResult, ReviewContext types
- `server/src/services/review-providers/github.ts` - GitHub ReviewProvider with parsePrUrl, buildReviewPayload, createGitHubReviewProvider
- `server/src/services/code-review.ts` - Code review orchestration service with prepareReviewContext, submitReview, getReviewProvider
- `server/src/__tests__/code-review.test.ts` - 13 unit tests for URL parsing, payload building, type structure
- `server/src/services/github-app.ts` - Extended handleGitHubPrOpened with PR metadata and review issue creation
- `server/src/services/index.ts` - Added codeReviewService export

## Decisions Made
- Used line+side fields instead of deprecated position field per Pitfall 4 in research -- avoids diff-position calculation complexity
- buildReviewPayload supports optional nitpick filtering to control which comments get posted to GitHub
- Code review service uses lazy import pattern (same as heartbeat in github-app.ts) to avoid circular dependency
- PR metadata (head/base SHA, branch refs) embedded in issue description rather than requiring schema changes
- Review issue creation wrapped in try/catch as best-effort -- main PR tracking is never disrupted by review logic failures

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Pre-existing test failure in context-pipeline.test.ts (expects 4 processors but 5 exist due to skill-profile-resolver from plan 04-03). This is out-of-scope -- not caused by our changes. Logged as deferred item.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- ReviewProvider interface ready for GitLab/Bitbucket implementations in v2
- Code review service ready for integration with agent skill profiles and heartbeat execution flow
- Review issue creation will trigger review agents via the existing heartbeat wakeup mechanism

---
*Phase: 04-notifications-agent-capabilities*
*Completed: 2026-03-12*
