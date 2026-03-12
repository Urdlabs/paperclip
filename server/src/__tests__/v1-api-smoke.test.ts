import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/index.js";
import { githubRoutes } from "../routes/github.js";
import { webhookRoutes } from "../routes/webhooks.js";
import { skillProfileRoutes } from "../routes/skill-profiles.js";

/**
 * API endpoint smoke tests for v1.0 fork-only routes.
 *
 * These tests verify that fork-only routes are registered and respond
 * correctly. If a route is accidentally unregistered during the upstream
 * merge, the corresponding test fails with a 404 instead of 200.
 *
 * These are permanent regression tests -- do NOT remove after the merge.
 */

// ---------------------------------------------------------------------------
// Mock services
// ---------------------------------------------------------------------------

const mockGithubAppService = vi.hoisted(() => ({
  getAppConfig: vi.fn(),
  getStatus: vi.fn().mockResolvedValue({ configured: false, apps: [] }),
  generateManifest: vi.fn().mockReturnValue({ name: "test-app" }),
  exchangeCode: vi.fn(),
  deleteApp: vi.fn(),
  listInstallations: vi.fn().mockResolvedValue([]),
  getInstallUrl: vi.fn(),
  handleWebhook: vi.fn(),
  syncInstallations: vi.fn(),
  syncAppInstallations: vi.fn(),
  verifyWebhookSignature: vi.fn(),
  generateInstallationToken: vi.fn(),
  generateAllInstallationTokens: vi.fn(),
  isConfigured: vi.fn(),
}));

vi.mock("../services/github-app.js", () => ({
  githubAppService: () => mockGithubAppService,
}));

const mockWebhookService = vi.hoisted(() => ({
  create: vi.fn(),
  list: vi.fn().mockResolvedValue([]),
  getById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  rotateSecret: vi.fn(),
}));

vi.mock("../services/webhooks.js", () => ({
  webhookService: () => mockWebhookService,
  generateWebhookSecret: vi.fn(),
  signPayload: vi.fn(),
  buildWebhookHeaders: vi.fn(),
  getRetryDelay: vi.fn(),
}));

const mockSkillProfileService = vi.hoisted(() => ({
  list: vi.fn().mockResolvedValue([]),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("../services/index.js", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    skillProfileService: () => mockSkillProfileService,
    logActivity: vi.fn(),
  };
});

vi.mock("../services/activity-log.js", () => ({
  logActivity: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createApp() {
  const app = express();
  app.use(express.json());

  // Inject a board admin actor
  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "board",
      userId: "user-1",
      companyIds: ["company-1"],
      source: "session",
      isInstanceAdmin: true,
    };
    next();
  });

  // Set env var that github routes read
  process.env.PAPERCLIP_PUBLIC_URL = "https://example.com";

  app.use("/api", githubRoutes({} as any));
  app.use("/api", webhookRoutes({} as any));
  app.use("/api", skillProfileRoutes({} as any));
  app.use(errorHandler);

  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("v1.0 fork API endpoints", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  describe("GitHub routes", () => {
    it("GET /api/github/status returns 200 with status shape", async () => {
      const res = await request(app).get("/api/github/status");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("configured");
      expect(res.body).toHaveProperty("apps");
      expect(Array.isArray(res.body.apps)).toBe(true);
    });

    it("GET /api/github/manifest returns 200 with an object", async () => {
      const res = await request(app).get("/api/github/manifest");
      expect(res.status).toBe(200);
      expect(typeof res.body).toBe("object");
      expect(res.body).not.toBeNull();
    });
  });

  describe("Webhook routes", () => {
    it("GET /api/companies/:companyId/webhooks returns 200 with an array", async () => {
      const res = await request(app).get("/api/companies/company-1/webhooks");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe("Skill Profile routes", () => {
    it("GET /api/companies/:companyId/skill-profiles returns 200 with an array", async () => {
      const res = await request(app).get(
        "/api/companies/company-1/skill-profiles",
      );
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
