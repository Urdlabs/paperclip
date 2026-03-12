# Upstream Merge Conflict Map

**Generated:** 2026-03-12
**Fork:** master (125 commits ahead, 228 commits behind upstream/master)
**Merge command:** `git merge --no-ff upstream/master`
**Total conflicts:** 16 files
**Divergence stats:** 459 files changed, 22,636 insertions, 52,852 deletions

---

## Summary

The dry-run merge (`git merge --no-commit --no-ff upstream/master`) produces exactly 16 conflicting files. These fall into 6 categories. The majority are EASY or MEDIUM -- only 2 files require careful manual merge (server/src/index.ts and server/src/services/heartbeat.ts).

**Difficulty breakdown:**
- EASY: 6 files (lockfile regenerate + combine exports/deps)
- MEDIUM: 6 files (both sides added different features, accept both)
- MEDIUM-HARD: 1 file (AgentDetail.tsx -- structural divergence)
- HARD: 2 files (index.ts and heartbeat.ts -- heavily divergent function bodies)
- SPECIAL: 1 file (pnpm-lock.yaml -- always regenerate)

---

## 1. DB Migrations (3 files)

> Resolution: Fully resolved by migration renumbering in PREP-03 -- fork keeps 0026-0030, upstream becomes 0031-0032.

### packages/db/src/migrations/meta/_journal.json

| Property | Value |
|----------|-------|
| Area | DB Migrations |
| Difficulty | EASY |
| Conflict zones | 2 (lines 190, 202) |
| Fork changed | Added journal entries for fork migrations 0026-0030 (rainy_blade through sharp_korath) |
| Upstream changed | Added journal entries for upstream migrations 0026-0027 (lying_pete_wisdom, tranquil_tenebrous) |
| Resolution Strategy | **Keep ours (fork)** during merge. The renumbering plan (05-02-PLAN.md) will create new journal entries for upstream's migrations as idx 31-32, grafting them onto the end of the fork's chain. |
| Notes | After renumbering, the journal will have idx 0-30 (fork) + idx 31-32 (upstream renamed). |

### packages/db/src/migrations/meta/0026_snapshot.json

| Property | Value |
|----------|-------|
| Area | DB Migrations |
| Difficulty | EASY |
| Conflict zones | 1 (add/add conflict -- both sides created this file) |
| Fork changed | Created 0026_rainy_blade snapshot (id: a9f2e716) -- GitHub App tables |
| Upstream changed | Created 0026_lying_pete_wisdom snapshot (id: 5f8dd541) -- workspace_runtime_services table |
| Resolution Strategy | **Keep ours (fork).** Upstream's 0026 snapshot gets renumbered to 0031 in PREP-03. |
| Notes | Fork's 0026 is deployed to production databases -- must remain untouched. |

### packages/db/src/migrations/meta/0027_snapshot.json

| Property | Value |
|----------|-------|
| Area | DB Migrations |
| Difficulty | EASY |
| Conflict zones | 1 (add/add conflict -- both sides created this file) |
| Fork changed | Created 0027_simple_toxin snapshot (id: 78c74e4d) -- issue dependencies table |
| Upstream changed | Created 0027_tranquil_tenebrous snapshot (id: 8186209d) -- execution workspace settings columns |
| Resolution Strategy | **Keep ours (fork).** Upstream's 0027 snapshot gets renumbered to 0032 in PREP-03. |
| Notes | Snapshot prevId chains will be updated during renumbering to maintain continuity. |

---

## 2. Server (4 files)

### server/src/index.ts -- HARD

| Property | Value |
|----------|-------|
| Area | Server |
| Difficulty | **HARD** |
| Conflict zones | 3 (lines 386-460, 466-636, 726-777) |
| Fork changed | 973 lines. Exports `startServer()` with all fork route registrations (github, webhooks, skill-profiles), webhook dispatcher startup, database backup scheduler, bootstrap CEO invite display, Lightpanda browser setup, and embedded PostgreSQL shutdown handler. |
| Upstream changed | 693 lines. Restructured with workspace runtime service reconciliation (`reconcilePersistedRuntimeServicesOnStartup`), onboarding wizard support, instance settings routes. Same `startServer()` export pattern. |
| Resolution Strategy | **Manual merge -- keep all fork additions while accepting upstream's new imports and startup code.** |

**Deep-Dive Analysis:**

**Conflict Zone 1 (lines 386-460):** Duplicate code block.
- Both sides have the same embedded PostgreSQL setup code (lines 388-407 on fork, duplicated from earlier in the file).
- The fork side includes this duplicate block followed by deployment mode validation.
- The upstream side jumps straight to `if (config.deploymentMode === "local_trusted" && !isLoopbackHost(config.host))`.
- **Action:** Remove the fork's duplicate embedded PostgreSQL block (it appears earlier in the file already). Keep the deployment mode validation from both sides -- they're identical.

**Conflict Zone 2 (lines 466-636):** Main server setup divergence.
- **Fork (lines 467-631):** BetterAuth handler setup with derived trusted origins, `createApp()` call, `createServer()`, port detection, runtime env vars, WebSocket setup, heartbeat scheduler with orphan reaping, webhook dispatcher startup, database backup scheduler, `server.listen()` with browser auto-open.
- **Upstream (lines 633-636):** Same deployment validation pattern but differently positioned.
- **Action:** Keep fork's full server setup sequence. Accept upstream's new imports at the top of the file. After the server setup, add upstream's `reconcilePersistedRuntimeServicesOnStartup` call.

**Conflict Zone 3 (lines 726-777):** Post-listen and shutdown.
- **Fork (lines 727-762):** Bootstrap invite URL display, embedded PostgreSQL shutdown handlers (SIGINT/SIGTERM).
- **Upstream (lines 763-777):** Runtime env var setup, WebSocket setup, reconciliation startup.
- **Action:** Keep fork's bootstrap invite and shutdown handlers. Upstream's env vars and WebSocket setup should already be present from Zone 2 merge. Add upstream's `reconcilePersistedRuntimeServicesOnStartup` call after WebSocket setup.

**Recommended merge order:**
1. Start with fork's version as base
2. Add upstream's new imports at top: `reconcilePersistedRuntimeServicesOnStartup` from workspace-runtime
3. Add upstream's `reconcilePersistedRuntimeServicesOnStartup` call after WebSocket setup in the listen callback area
4. Verify no duplicate code blocks remain from the conflict resolution

### server/src/services/heartbeat.ts -- HARD

| Property | Value |
|----------|-------|
| Area | Server |
| Difficulty | **HARD** |
| Conflict zones | 6 (lines 13-19, 29-34, 38-65, 480-484, 1496-1599, 1711-1790) |
| Fork changed | 2892 lines. Added token usage tracking (`createUsageTracker`), budget enforcement (`resolveBudget`), skill profile integration, context optimization pipeline (`runContextPipeline`), GitHub App token injection, Lightpanda browser env injection, webhook event dispatch. |
| Upstream changed | 2550 lines. Added workspace runtime service management, execution workspace policy, heartbeat run summary generation, issue goal fallback logic, adapter-managed runtime services, workspace-ready comments. |
| Resolution Strategy | **Manual merge -- both sets of modifications target different concerns and should coexist.** |

**Deep-Dive Analysis:**

**Conflict Zone 1 (lines 13-19): DB imports.**
- Fork imports: `issueComments`, `issueLabels`, `labels`
- Upstream imports: `projects`
- **Action:** Keep both. Final imports: `issueComments, issueLabels, labels, projects, projectWorkspaces`.

**Conflict Zone 2 (lines 29-34): Utility imports.**
- Fork imports: `asString` from adapters/utils
- Upstream imports: `costService` from costs.js (removes `asString`)
- **Action:** Keep both. Fork needs `asString` for browser config parsing. Upstream needs `costService`.

**Conflict Zone 3 (lines 38-65): Service imports.**
- Fork imports: `createUsageTracker`, `estimatePromptBreakdown`, `getContextWindowSize`, `runContextPipeline`, `defaultProcessors`, `resolveBudget`, `skillProfileService`, `PipelineContext` type. Defines `activeRunExecutions` Set.
- Upstream imports: `summarizeHeartbeatRunResultJson`, workspace-runtime functions (`buildWorkspaceReadyComment`, `ensureRuntimeServicesForRun`, etc.), `issueService`, execution workspace policy functions, `redactCurrentUserText`/`Value`.
- **Action:** Keep both sets of imports. They serve different purposes -- fork's token/budget/skills pipeline vs upstream's workspace/runtime management.

**Conflict Zone 4 (line 480-484): Service initialization.**
- Fork: `const githubSvc = githubAppService(db);`
- Upstream: `const issuesSvc = issueService(db);`
- **Action:** Keep both. Fork uses `githubSvc` for installation token injection. Upstream uses `issuesSvc` for workspace-ready comments.

**Conflict Zone 5 (lines 1496-1599): Pre-adapter execution setup.**
- Fork (lines 1497-1554): GitHub App token injection (generates installation tokens, sets `GITHUB_TOKEN`/`GH_TOKEN`, per-org git URL rewriting via `GIT_CONFIG_*`). Then Lightpanda browser env injection.
- Upstream (lines 1556-1599): Runtime service lifecycle (`ensureRuntimeServicesForRun`), updates context snapshot with runtime URLs, posts workspace-ready comment.
- **Action:** Keep both blocks sequentially. Fork's GitHub token injection should run first (sets env vars), then upstream's runtime service setup (may need those env vars). Both modify `resolvedConfig.env` and `context` but target different fields.

**Conflict Zone 6 (lines 1711-1790): Post-adapter execution.**
- Fork (lines 1712-1740): Adapter execution with try/finally (clears keepAlive interval, touches updatedAt), flushes usage tracker.
- Upstream (lines 1742-1790): Persists adapter-managed runtime services, posts workspace-ready comment for adapter-managed services.
- **Action:** Keep fork's adapter execution wrapper (try/finally + usage flush). After usage flush, add upstream's adapter-managed runtime service persistence logic.

**Recommended merge order:**
1. Start with fork's version as base
2. Add upstream's new imports alongside fork's imports
3. Add `issuesSvc` initialization next to `githubSvc`
4. In pre-adapter section: keep fork's GitHub token + browser injection, then add upstream's runtime service setup
5. In post-adapter section: keep fork's adapter execution + usage flush, then add upstream's runtime service persistence
6. Verify both `asString` (fork) and `costService` (upstream) are imported

### server/src/app.ts -- EASY

| Property | Value |
|----------|-------|
| Area | Server |
| Difficulty | EASY |
| Conflict zones | 1 (line 27) |
| Fork changed | Added import for `instanceHeartbeatSettingsRoutes` |
| Upstream changed | Added imports for `instanceSettingsRoutes` and `onboardingWizardRoutes` |
| Resolution Strategy | **Accept both.** Keep fork's `instanceHeartbeatSettingsRoutes` import and add upstream's two new route imports. Both are additive import lines with no overlap. |
| Notes | 10 insertions, 11 deletions in the full diff. Mostly import additions on both sides. |

### server/src/services/issues.ts -- MEDIUM

| Property | Value |
|----------|-------|
| Area | Server |
| Difficulty | MEDIUM |
| Conflict zones | 2 (lines 23-33, 1449-1725) |
| Fork changed | Added import for `topologicalSort`, `validateNoCycle`, `getExecutionWaves` from dependency-graph.js. Added `staleCount` method and webhook dispatch on issue events. |
| Upstream changed | Added imports for execution-workspace-policy, log-redaction, issue-goal-fallback, goals. Added execution workspace settings, goal fallback logic, text redaction. |
| Resolution Strategy | **Accept both.** Fork added dependency graph utilities and webhook dispatch. Upstream added workspace policy and goal fallback. Different concerns, additive. |
| Notes | Conflict zone 2 is large (1449-1725) because fork adds ~275 lines of webhook dispatch + staleCount vs upstream adds 1 line. Keep fork's additions and add upstream's single-line addition. |

---

## 3. UI (5 files)

### ui/src/App.tsx -- MEDIUM

| Property | Value |
|----------|-------|
| Area | UI |
| Difficulty | MEDIUM |
| Conflict zones | 1 (line 33) |
| Fork changed | Added `GitHubSetupComplete` route import and route definition |
| Upstream changed | Added `InstanceSettings`, `NotFound`, `RunTranscriptUxLab` route imports and route definitions |
| Resolution Strategy | **Accept both.** Keep fork's `GitHubSetupComplete` route. Add upstream's three new routes (`InstanceSettings`, `NotFound`, `RunTranscriptUxLab`). All are additive route registrations. |
| Notes | Simple import + route addition on both sides. No structural conflict. |

### ui/src/pages/AgentDetail.tsx -- MEDIUM-HARD

| Property | Value |
|----------|-------|
| Area | UI |
| Difficulty | MEDIUM-HARD |
| Conflict zones | 2 (lines 17-21, 66-74) |
| Fork changed | Added analytics tabs: token breakdown, trace view, context utilization. Added imports for `AnalyticsCharts`, `TokenBreakdown`, `TraceView`, `ContextUtilizationBar`. |
| Upstream changed | Restructured agent detail layout with new tab organization. Added transcript and run detail views. |
| Resolution Strategy | **Manual merge.** Keep fork's analytics tab additions. Accept upstream's structural changes to the layout. Fork's tabs need to be integrated into upstream's new tab structure. |
| Notes | Conflict zone 1 is imports (easy -- combine both). Conflict zone 2 is the tab/panel structure where fork added analytics tabs and upstream reorganized the layout. Needs careful integration of fork tabs into upstream's new structure. |

### ui/src/pages/Costs.tsx -- MEDIUM

| Property | Value |
|----------|-------|
| Area | UI |
| Difficulty | MEDIUM |
| Conflict zones | 2 (lines 239-364, 375-412) |
| Fork changed | Added detailed "By Agent" and "By Project" cost breakdown cards with token stats, cache efficiency, API/subscription run counts. Added `AnalyticsCharts` component integration. |
| Upstream changed | Added budget utilization bar, spend vs budget display, utilization percentage visualization. Modified cost summary presentation. |
| Resolution Strategy | **Accept both.** Fork's detailed breakdowns (By Agent / By Project) and upstream's budget utilization bar serve complementary purposes. Keep fork's breakdown cards and add upstream's budget visualization. |
| Notes | Zone 1 (239-364): Fork has ~65 lines of By Agent/By Project cards vs upstream's ~60 lines of budget bar. Both should appear on the page. Zone 2 (375-412): Fork has analytics chart integration vs upstream's expanded summary. |

### ui/src/components/agent-config-primitives.tsx -- MEDIUM

| Property | Value |
|----------|-------|
| Area | UI |
| Difficulty | MEDIUM |
| Conflict zones | 1 (lines 47-54) |
| Fork changed | Added skill profile and budget config fields to agent config form |
| Upstream changed | Added execution workspace and runtime service config fields |
| Resolution Strategy | **Accept both.** Both sides added different form fields to the agent configuration. Fork's skill profile/budget fields and upstream's workspace/runtime fields are independent additions. |
| Notes | Single conflict zone in the config field definitions. Straightforward combine. |

### ui/src/lib/queryKeys.ts -- EASY

| Property | Value |
|----------|-------|
| Area | UI |
| Difficulty | EASY |
| Conflict zones | 1 (lines 79-83) |
| Fork changed | Added query keys for: `skillProfiles`, `webhookEndpoints`, `webhookDeliveries`, `tokenAnalytics`, `contextUtilization` |
| Upstream changed | Added query keys for: `instanceSettings`, `workspaceRuntimeServices` |
| Resolution Strategy | **Accept both.** Both sides added new query key objects for their respective features. Combine all keys into the exported object. |
| Notes | Trivially additive. No overlap in key names. |

---

## 4. Shared Packages (1 file)

### packages/adapter-utils/src/index.ts -- EASY

| Property | Value |
|----------|-------|
| Area | Shared Packages |
| Difficulty | EASY |
| Conflict zones | 1 (lines 25-35) |
| Fork changed | Added exports for context pipeline utilities and token estimation helpers |
| Upstream changed | Added exports for workspace runtime types and execution workspace utilities |
| Resolution Strategy | **Accept both.** Both sides added new export lines. Combine all exports. |
| Notes | Pure additive exports on both sides. No naming conflicts. |

---

## 5. Infrastructure (2 files)

### Dockerfile -- MEDIUM

| Property | Value |
|----------|-------|
| Area | Infrastructure |
| Difficulty | MEDIUM |
| Conflict zones | 2 (lines 52-93, 113-117) |
| Fork changed | Zone 1: Added `agent-browser@latest` to npm global install, Lightpanda browser binary download, gosu + GitHub CLI apt install, non-root `paperclip` user creation (instead of `node`), custom entrypoint script + git-askpass. Zone 2: Uses `ENTRYPOINT ["entrypoint.sh"]` for privilege drop via gosu. |
| Upstream changed | Zone 1: Uses `--chown=node:node` on COPY, creates `/paperclip` dir owned by `node` user. Zone 2: Uses `USER node` directive. |
| Resolution Strategy | **Keep ours (fork).** Fork's Dockerfile is a superset -- adds Lightpanda, GitHub CLI, gosu-based privilege drop, and custom entrypoint. Upstream's simpler `node` user approach is superseded by fork's `paperclip` user with gosu for volume permission handling. |
| Notes | Fork's custom entrypoint handles volume ownership before dropping privileges, which is necessary for Docker volume mounts. Upstream's `USER node` is insufficient for this use case. |

### ui/package.json -- EASY

| Property | Value |
|----------|-------|
| Area | Infrastructure |
| Difficulty | EASY |
| Conflict zones | 1 (lines 20-24) |
| Fork changed | Added `recharts` dependency (for analytics charts), `@standardwebhooks/standard-webhooks` |
| Upstream changed | Added different UI dependencies (workspace/runtime related) |
| Resolution Strategy | **Accept both.** Combine all dependency additions. Then regenerate lockfile with `pnpm install`. |
| Notes | Both sides added to the `dependencies` object. No version conflicts on shared deps. |

---

## 6. Lockfile (1 file)

### pnpm-lock.yaml -- SPECIAL

| Property | Value |
|----------|-------|
| Area | Lockfile |
| Difficulty | SPECIAL (always regenerate) |
| Conflict zones | Multiple (binary-like conflict across thousands of lines) |
| Fork changed | Added lockfile entries for fork's new dependencies |
| Upstream changed | Added lockfile entries for upstream's new dependencies |
| Resolution Strategy | **Delete and regenerate.** After all package.json conflicts are resolved, delete `pnpm-lock.yaml` entirely and run `pnpm install` to generate a fresh lockfile. Never attempt to manually merge lockfiles. |
| Notes | This must be the LAST step after all other conflicts are resolved. Run `pnpm install --lockfile-only` first to verify resolution, then `pnpm install` for full install. |

---

## Summary Table

| File | Area | Difficulty | Strategy | Conflict Zones |
|------|------|------------|----------|----------------|
| `packages/db/src/migrations/meta/_journal.json` | DB Migrations | EASY | Keep ours + renumber upstream (PREP-03) | 2 |
| `packages/db/src/migrations/meta/0026_snapshot.json` | DB Migrations | EASY | Keep ours + renumber upstream (PREP-03) | 1 |
| `packages/db/src/migrations/meta/0027_snapshot.json` | DB Migrations | EASY | Keep ours + renumber upstream (PREP-03) | 1 |
| `server/src/index.ts` | Server | **HARD** | Manual merge (see deep-dive) | 3 |
| `server/src/services/heartbeat.ts` | Server | **HARD** | Manual merge (see deep-dive) | 6 |
| `server/src/app.ts` | Server | EASY | Accept both (additive imports) | 1 |
| `server/src/services/issues.ts` | Server | MEDIUM | Accept both (different features) | 2 |
| `ui/src/App.tsx` | UI | MEDIUM | Accept both (additive routes) | 1 |
| `ui/src/pages/AgentDetail.tsx` | UI | MEDIUM-HARD | Manual merge (tab integration) | 2 |
| `ui/src/pages/Costs.tsx` | UI | MEDIUM | Accept both (complementary views) | 2 |
| `ui/src/components/agent-config-primitives.tsx` | UI | MEDIUM | Accept both (additive form fields) | 1 |
| `ui/src/lib/queryKeys.ts` | UI | EASY | Accept both (additive keys) | 1 |
| `packages/adapter-utils/src/index.ts` | Shared Packages | EASY | Accept both (additive exports) | 1 |
| `Dockerfile` | Infrastructure | MEDIUM | Keep ours (superset) | 2 |
| `ui/package.json` | Infrastructure | EASY | Accept both + regenerate lockfile | 1 |
| `pnpm-lock.yaml` | Lockfile | SPECIAL | Delete and regenerate | N/A |

---

## Recommended Merge Order (Phases 6-7)

1. **DB Migrations** -- Complete renumbering first (PREP-03 prerequisite). Then `git merge --no-ff upstream/master` for DB files with `--strategy-option ours` for the 3 migration meta files.
2. **Shared Packages** -- `packages/adapter-utils/src/index.ts` (EASY combine).
3. **Server** -- `app.ts` (EASY), then `issues.ts` (MEDIUM), then `heartbeat.ts` (HARD), then `index.ts` (HARD). Save hardest for last.
4. **UI** -- `queryKeys.ts` (EASY), then `agent-config-primitives.tsx` (MEDIUM), then `App.tsx` (MEDIUM), then `Costs.tsx` (MEDIUM), then `AgentDetail.tsx` (MEDIUM-HARD).
5. **Infrastructure** -- `Dockerfile` (keep ours), `ui/package.json` (combine deps).
6. **Lockfile** -- `pnpm install` last, after everything else resolves.

**Tag after each chunk:** `post-chunk-1-db`, `post-chunk-2-server`, etc. per the rollback strategy.

---

*Conflict map for phases 6-7 merge execution.*
*Last updated: 2026-03-12*
