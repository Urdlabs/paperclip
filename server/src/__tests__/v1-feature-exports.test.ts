import { describe, it, expect } from "vitest";

/**
 * Canary tests for v1.0 fork feature exports.
 *
 * These tests verify that all fork-only modules export the expected symbols.
 * If any export is accidentally removed during the upstream merge, the
 * corresponding test fails immediately.
 *
 * These are permanent regression tests -- do NOT remove after the merge.
 */
describe("v1.0 fork feature exports", () => {
  describe("DB schema exports", () => {
    it("exports all 6 fork-only tables", async () => {
      const db = await import("@paperclipai/db");
      expect(db.githubApps).toBeDefined();
      expect(db.githubAppInstallations).toBeDefined();
      expect(db.issueDependencies).toBeDefined();
      expect(db.webhookEndpoints).toBeDefined();
      expect(db.webhookDeliveries).toBeDefined();
      expect(db.skillProfiles).toBeDefined();
    });
  });

  describe("Server service exports", () => {
    it("exports all 16 fork-only service functions", async () => {
      const services = await import("../services/index.js");
      expect(services.githubAppService).toBeDefined();
      expect(services.createUsageTracker).toBeDefined();
      expect(services.resolveBudget).toBeDefined();
      expect(services.isBudgetExceeded).toBeDefined();
      expect(services.isWindDownThreshold).toBeDefined();
      expect(services.webhookService).toBeDefined();
      expect(services.startWebhookDispatcher).toBeDefined();
      expect(services.mapLiveEventToWebhookEvent).toBeDefined();
      expect(services.codeReviewService).toBeDefined();
      expect(services.topologicalSort).toBeDefined();
      expect(services.validateNoCycle).toBeDefined();
      expect(services.getExecutionWaves).toBeDefined();
      expect(services.skillProfileService).toBeDefined();
      expect(services.estimateTokens).toBeDefined();
      expect(services.estimatePromptBreakdown).toBeDefined();
      expect(services.computeContextUtilization).toBeDefined();
    });
  });

  describe("Server route exports", () => {
    it("exports all 4 fork-only route sets", async () => {
      const routes = await import("../routes/index.js");
      expect(routes.githubRoutes).toBeDefined();
      expect(routes.githubWebhookRoute).toBeDefined();
      expect(routes.webhookRoutes).toBeDefined();
      expect(routes.skillProfileRoutes).toBeDefined();
    });
  });

  describe("Shared package exports", () => {
    it("exports fork-only constants and functions", async () => {
      const shared = await import("@paperclipai/shared");
      expect(shared.MODEL_CONTEXT_LIMITS).toBeDefined();
      expect(shared.DEFAULT_CONTEXT_LIMIT).toBeDefined();
      expect(shared.getContextWindowSize).toBeDefined();
      expect(shared.WEBHOOK_EVENT_TYPES).toBeDefined();
      expect(shared.BUILTIN_SKILL_PROFILE_SLUGS).toBeDefined();
      expect(shared.TASK_TYPES).toBeDefined();
    });
  });
});
