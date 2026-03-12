# Deferred Items - Phase 04

## Pre-existing Test Failures

1. **context-pipeline.test.ts:87** - `defaultProcessors has 4 entries` fails because another plan (likely 04-04/04-05) added a 5th processor (skill-profile-resolver) without updating this test assertion.
2. **skill-profiles.ts typecheck** - `Cannot find module '@paperclipai/db/schema'` - another plan introduced a broken import path.
