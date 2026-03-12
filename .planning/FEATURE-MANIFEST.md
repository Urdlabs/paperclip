# v1.0 Fork Feature Manifest

This manifest lists every fork-only addition in the Paperclip v1.0 fork. Each item is a code path that does not exist in the upstream repo. During post-merge verification (phase 7), check off each item to confirm it survived the merge.

---

## 1. Token Analytics & Budget Management

### Server Services
- [ ] `estimateTokens` (from `server/src/services/token-estimation.ts`)
- [ ] `estimatePromptBreakdown` (from `server/src/services/token-estimation.ts`)
- [ ] `computeContextUtilization` (from `server/src/services/token-estimation.ts`)
- [ ] `createUsageTracker` (from `server/src/services/claude-usage-streaming.ts`)
- [ ] `resolveBudget` (from `server/src/services/budget.ts`)
- [ ] `isBudgetExceeded` (from `server/src/services/budget.ts`)
- [ ] `isWindDownThreshold` (from `server/src/services/budget.ts`)

### Server Service Files
- [ ] `server/src/services/token-estimation.ts`
- [ ] `server/src/services/claude-usage-streaming.ts`
- [ ] `server/src/services/budget.ts`

### Shared Types
- [ ] `TokenBreakdown` (from `packages/shared/src/types/usage.ts`)
- [ ] `UsageJsonExtended` (from `packages/shared/src/types/usage.ts`)
- [ ] `BudgetInfo` type

### Shared Exports
- [ ] `MODEL_CONTEXT_LIMITS` (from `packages/shared/src/model-context-limits.ts`)
- [ ] `DEFAULT_CONTEXT_LIMIT` (from `packages/shared/src/model-context-limits.ts`)
- [ ] `getContextWindowSize` (from `packages/shared/src/model-context-limits.ts`)

### UI Components
- [ ] `ui/src/components/AnalyticsCharts.tsx`
- [ ] `ui/src/components/BudgetBar.tsx`
- [ ] `ui/src/components/ContextUtilizationBar.tsx`
- [ ] `ui/src/components/TokenBreakdown.tsx`

---

## 2. GitHub App Integration

### DB Tables
- [ ] `githubApps` (from `packages/db/src/schema/github_apps.ts`)
- [ ] `githubAppInstallations` (from `packages/db/src/schema/github_app_installations.ts`)

### DB Schema Files
- [ ] `packages/db/src/schema/github_apps.ts`
- [ ] `packages/db/src/schema/github_app_installations.ts`

### Server Services
- [ ] `githubAppService` (from `server/src/services/github-app.ts`)

### Server Service Files
- [ ] `server/src/services/github-app.ts`

### Server Routes
- [ ] `githubRoutes` (from `server/src/routes/github.ts`)
- [ ] `githubWebhookRoute` (from `server/src/routes/github.ts`)

### Server Route Files
- [ ] `server/src/routes/github.ts`

### API Endpoints
- [ ] `GET /api/github/status`
- [ ] `GET /api/github/manifest`
- [ ] `GET /api/github/callback`
- [ ] `DELETE /api/github/app/:id`
- [ ] `GET /api/github/installations`
- [ ] `POST /api/github/installations/:id/sync`
- [ ] `GET /api/github/install-url/:id`
- [ ] `POST /api/github/webhook`

### Shared Types
- [ ] `GitHubAppConfig` (from `packages/shared/src/types/github.ts`)
- [ ] `GitHubAppInstallation` (from `packages/shared/src/types/github.ts`)
- [ ] `GitHubAppStatus` (from `packages/shared/src/types/github.ts`)

### UI Pages
- [ ] `ui/src/pages/GitHubSetupComplete.tsx`

---

## 3. Outgoing Webhooks

### DB Tables
- [ ] `webhookEndpoints` (from `packages/db/src/schema/webhook_endpoints.ts`)
- [ ] `webhookDeliveries` (from `packages/db/src/schema/webhook_deliveries.ts`)

### DB Schema Files
- [ ] `packages/db/src/schema/webhook_endpoints.ts`
- [ ] `packages/db/src/schema/webhook_deliveries.ts`

### Server Services
- [ ] `webhookService` (from `server/src/services/webhooks.ts`)
- [ ] `startWebhookDispatcher` (from `server/src/services/webhook-dispatcher.ts`)
- [ ] `mapLiveEventToWebhookEvent` (from `server/src/services/webhook-dispatcher.ts`)

### Server Service Files
- [ ] `server/src/services/webhooks.ts`
- [ ] `server/src/services/webhook-dispatcher.ts`

### Server Routes
- [ ] `webhookRoutes` (from `server/src/routes/webhooks.ts`)

### Server Route Files
- [ ] `server/src/routes/webhooks.ts`

### API Endpoints
- [ ] `POST /api/companies/:companyId/webhooks`
- [ ] `GET /api/companies/:companyId/webhooks`
- [ ] `GET /api/companies/:companyId/webhooks/:webhookId`
- [ ] `PATCH /api/companies/:companyId/webhooks/:webhookId`
- [ ] `DELETE /api/companies/:companyId/webhooks/:webhookId`
- [ ] `GET /api/companies/:companyId/webhooks/:webhookId/deliveries`
- [ ] `POST /api/companies/:companyId/webhooks/:webhookId/test`

### Shared Types
- [ ] `WebhookEndpoint` (from `packages/shared/src/types/webhooks.ts`)
- [ ] `WebhookDelivery` (from `packages/shared/src/types/webhooks.ts`)
- [ ] `WebhookPayload` (from `packages/shared/src/types/webhooks.ts`)

### Shared Constants
- [ ] `WEBHOOK_EVENT_TYPES` (from `packages/shared/src/constants.ts`)

### Shared Validators
- [ ] `createWebhookEndpointSchema` (from `packages/shared/src/validators/index.ts`)
- [ ] `updateWebhookEndpointSchema` (from `packages/shared/src/validators/index.ts`)

### UI Components
- [ ] `ui/src/components/WebhookDeliveryLog.tsx`
- [ ] `ui/src/components/WebhookEndpointList.tsx`

---

## 4. Task Decomposition & Dependencies

### DB Tables
- [ ] `issueDependencies` (from `packages/db/src/schema/issue_dependencies.ts`)

### DB Schema Files
- [ ] `packages/db/src/schema/issue_dependencies.ts`

### Server Services
- [ ] `topologicalSort` (from `server/src/services/dependency-graph.ts`)
- [ ] `validateNoCycle` (from `server/src/services/dependency-graph.ts`)
- [ ] `getExecutionWaves` (from `server/src/services/dependency-graph.ts`)

### Server Service Files
- [ ] `server/src/services/dependency-graph.ts`

### Shared Types
- [ ] `SubtaskWithDependencies` (from `packages/shared/src/types/index.ts`)
- [ ] `DerivedParentStatus` (from `packages/shared/src/types/index.ts`)

### Shared Validators
- [ ] `createSubtaskSchema` (from `packages/shared/src/validators/index.ts`)
- [ ] `addDependencySchema` (from `packages/shared/src/validators/index.ts`)

### UI Components
- [ ] `ui/src/components/SubtaskTree.tsx`

---

## 5. Agent Skill Profiles

### DB Tables
- [ ] `skillProfiles` (from `packages/db/src/schema/skill_profiles.ts`)

### DB Schema Files
- [ ] `packages/db/src/schema/skill_profiles.ts`

### Server Services
- [ ] `skillProfileService` (from `server/src/services/skill-profiles.ts`)

### Server Service Files
- [ ] `server/src/services/skill-profiles.ts`

### Server Routes
- [ ] `skillProfileRoutes` (from `server/src/routes/skill-profiles.ts`)

### Server Route Files
- [ ] `server/src/routes/skill-profiles.ts`

### API Endpoints
- [ ] `GET /api/companies/:companyId/skill-profiles`
- [ ] `GET /api/companies/:companyId/skill-profiles/:profileId`
- [ ] `POST /api/companies/:companyId/skill-profiles`
- [ ] `PATCH /api/companies/:companyId/skill-profiles/:profileId`
- [ ] `DELETE /api/companies/:companyId/skill-profiles/:profileId`
- [ ] `POST /api/companies/:companyId/skill-profiles/seed`

### Shared Types
- [ ] `SkillProfile` (from `packages/shared/src/types/skill-profiles.ts`)
- [ ] `SkillProfileSummary` (from `packages/shared/src/types/skill-profiles.ts`)

### Shared Constants
- [ ] `BUILTIN_SKILL_PROFILE_SLUGS` (from `packages/shared/src/constants.ts`)

### Shared Validators
- [ ] `createSkillProfileSchema` (from `packages/shared/src/validators/index.ts`)
- [ ] `updateSkillProfileSchema` (from `packages/shared/src/validators/index.ts`)

### UI Components
- [ ] `ui/src/components/SkillProfileSelector.tsx`

---

## 6. Code Review

### Server Services
- [ ] `codeReviewService` (from `server/src/services/code-review.ts`)

### Server Service Files
- [ ] `server/src/services/code-review.ts`
- [ ] `server/src/services/review-providers/` directory

---

## 7. Observability UX

### UI Components
- [ ] `ui/src/components/TraceNode.tsx`
- [ ] `ui/src/components/TraceView.tsx`
- [ ] `ui/src/components/ActivityFilterBar.tsx`

---

## 8. Task Types

### Shared Exports
- [ ] `TASK_TYPES` (from `packages/shared/src/types/task-types.ts`)
- [ ] `TaskType` type (from `packages/shared/src/types/task-types.ts`)
- [ ] `TaskTypeTemplateConfig` type (from `packages/shared/src/types/task-types.ts`)
- [ ] `LabelMapping` type (from `packages/shared/src/types/task-types.ts`)

---

## Summary

| Feature Area | DB Tables | Services | Routes | API Endpoints | UI Components | Shared Types/Constants |
|---|---|---|---|---|---|---|
| Token Analytics & Budget | 0 | 7 | 0 | 0 | 4 | 5 |
| GitHub App Integration | 2 | 1 | 2 | 8 | 1 | 3 |
| Outgoing Webhooks | 2 | 3 | 1 | 7 | 2 | 4 |
| Task Decomposition | 1 | 3 | 0 | 0 | 1 | 4 |
| Agent Skill Profiles | 1 | 1 | 1 | 6 | 1 | 4 |
| Code Review | 0 | 1 | 0 | 0 | 0 | 0 |
| Observability UX | 0 | 0 | 0 | 0 | 3 | 0 |
| Task Types | 0 | 0 | 0 | 0 | 0 | 4 |
| **Totals** | **6** | **16** | **4** | **21** | **12** | **24** |
