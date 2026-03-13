# Deferred Items - Phase 07

## Pre-existing Test Failure (out of scope)

**File:** `server/src/__tests__/v1-integration-activity-feeds.test.ts`
**Status:** Untracked file (not committed), pre-existing from a previous session
**Failure:** `GET /api/issues/:id/activity > returns 200 with activity for a resolved issue (UUID-style id)` returns 404 instead of 200
**Root cause:** The test mocks `issueService` from `../services/index.js` but the activity route imports `issueService` from `../services/index.js` at module level; the mock may not be intercepting correctly for the `/issues/:id/activity` route's `resolveIssueByRef` helper.
**Action:** This file is not part of the 07-01 plan. It should either be fixed or removed in a future plan.
