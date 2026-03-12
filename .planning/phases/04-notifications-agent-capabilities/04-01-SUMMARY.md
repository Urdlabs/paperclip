---
phase: 04-notifications-agent-capabilities
plan: 01
subsystem: api
tags: [webhooks, hmac-sha256, standard-webhooks, event-dispatch, retry-queue]

# Dependency graph
requires:
  - phase: 01-token-awareness-live-usage
    provides: "Live events infrastructure (publishLiveEvent, subscribeCompanyLiveEvents)"
provides:
  - "Webhook endpoint CRUD REST API"
  - "Standard Webhooks HMAC-SHA256 payload signing"
  - "Event-to-webhook dispatcher bridge (live events -> webhook deliveries)"
  - "Retry queue with exponential backoff"
  - "Auto-disable endpoints after 5 consecutive failures"
  - "WEBHOOK_EVENT_TYPES constant with 6 event types"
affects: [04-notifications-agent-capabilities]

# Tech tracking
tech-stack:
  added: []
  patterns: [Standard Webhooks spec signing, webhook dispatcher bridge, retry queue sweep]

key-files:
  created:
    - packages/db/src/schema/webhook_endpoints.ts
    - packages/db/src/schema/webhook_deliveries.ts
    - packages/shared/src/types/webhooks.ts
    - packages/shared/src/validators/webhooks.ts
    - server/src/services/webhooks.ts
    - server/src/services/webhook-dispatcher.ts
    - server/src/routes/webhooks.ts
    - server/src/__tests__/webhooks.test.ts
    - server/src/__tests__/webhook-dispatcher.test.ts
  modified:
    - packages/db/src/schema/index.ts
    - packages/shared/src/constants.ts
    - packages/shared/src/index.ts
    - packages/shared/src/types/index.ts
    - packages/shared/src/validators/index.ts
    - server/src/services/index.ts
    - server/src/routes/index.ts
    - server/src/app.ts
    - server/src/index.ts

key-decisions:
  - "Standard Webhooks spec for signing (HMAC-SHA256 with v1, prefix and base64 encoding)"
  - "Same master-key encryption pattern as github-app.ts for webhook secret storage"
  - "Immediate delivery attempt on dispatch, with retry queue as fallback"
  - "5-second retry queue sweep interval"
  - "Response body truncated to 4096 chars in delivery log"

patterns-established:
  - "Webhook dispatcher bridge: maps internal LiveEvent types to external WebhookEventType"
  - "Retry queue sweep: select pending deliveries with nextAttemptAt <= now, limit 50"
  - "Auto-disable pattern: consecutive failure counter with threshold-based disable"

requirements-completed: [NOTF-01, NOTF-02, NOTF-03]

# Metrics
duration: 6min
completed: 2026-03-12
---

# Phase 04 Plan 01: Webhook System Summary

**Outgoing webhook notification system with Standard Webhooks HMAC-SHA256 signing, event dispatcher bridge, exponential backoff retry queue, and full CRUD REST API**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-12T04:19:26Z
- **Completed:** 2026-03-12T04:25:39Z
- **Tasks:** 2
- **Files modified:** 18

## Accomplishments
- webhook_endpoints and webhook_deliveries DB tables with indexes for retry sweep and delivery log queries
- WEBHOOK_EVENT_TYPES constant with 6 event types (run.completed, run.failed, run.started, approval.requested, issue.created, issue.updated)
- Webhook service with full CRUD, Standard Webhooks HMAC-SHA256 signing, delivery attempts with retry queue, and auto-disable after 5 consecutive failures
- Event dispatcher bridge mapping live events to webhook deliveries with immediate dispatch and retry fallback
- REST API with full endpoint management, delivery log viewing, and test delivery endpoint
- 18 tests covering signing, header generation, retry delay, secret generation, and event mapping

## Task Commits

Each task was committed atomically:

1. **Task 1: Webhook DB schema, shared types, and service with Standard Webhooks signing** - `b2c2f75` (feat)
2. **Task 2: Webhook dispatcher bridge, routes, and server wiring** - `d798a77` (feat)

_Note: TDD tasks have test + implementation in single commit per TDD cycle_

## Files Created/Modified
- `packages/db/src/schema/webhook_endpoints.ts` - Webhook endpoint configuration table with company, URL, encrypted secret, event type subscriptions
- `packages/db/src/schema/webhook_deliveries.ts` - Webhook delivery log with retry state tracking
- `packages/shared/src/constants.ts` - WEBHOOK_EVENT_TYPES constant with 6 types
- `packages/shared/src/types/webhooks.ts` - WebhookEndpoint, WebhookDelivery, WebhookPayload types
- `packages/shared/src/validators/webhooks.ts` - createWebhookEndpointSchema, updateWebhookEndpointSchema
- `server/src/services/webhooks.ts` - Webhook CRUD, HMAC-SHA256 signing, delivery, retry queue, auto-disable
- `server/src/services/webhook-dispatcher.ts` - Event-to-webhook bridge, dispatchEvent, startWebhookDispatcher
- `server/src/routes/webhooks.ts` - REST API: POST/GET/PATCH/DELETE webhooks + deliveries + test
- `server/src/__tests__/webhooks.test.ts` - 7 tests: signing, headers, retry delay, secret generation
- `server/src/__tests__/webhook-dispatcher.test.ts` - 11 tests: event mapping for all 6 types + null cases

## Decisions Made
- Used Standard Webhooks spec for signing: HMAC-SHA256 with "v1," prefix, base64-encoded, msg_id.timestamp.body format
- Reused same master-key encryption pattern as github-app.ts for webhook secret storage (AES-256-GCM)
- Immediate delivery attempt on dispatch with retry queue as fallback (reduces latency for healthy endpoints)
- 5-second retry queue sweep interval for timely retries
- Response body truncated to 4096 chars to prevent oversized delivery logs
- Re-enabling an endpoint resets consecutive failure counter and disabledAt

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Webhook infrastructure complete and ready for use
- All 6 event types supported via live event bridge
- Retry queue and auto-disable provide reliability

---
*Phase: 04-notifications-agent-capabilities*
*Completed: 2026-03-12*
