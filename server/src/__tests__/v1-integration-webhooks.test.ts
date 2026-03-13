import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/index.js";
import { webhookRoutes } from "../routes/webhooks.js";

/**
 * Integration tests for webhook CRUD API contracts.
 *
 * Verifies that webhook endpoints return expected status codes and shapes.
 * Permanent regression tests -- do NOT remove.
 */

// ---------------------------------------------------------------------------
// Mock services
// ---------------------------------------------------------------------------

const mockWebhookEndpoint = {
  id: "wh-1",
  companyId: "company-1",
  url: "https://example.com/hook",
  description: "Test webhook",
  eventTypes: ["run.completed"],
  enabled: true,
  secret: "whsec_test123",
  createdAt: "2026-03-10T00:00:00Z",
  updatedAt: "2026-03-10T00:00:00Z",
};

const mockWebhookService = vi.hoisted(() => ({
  create: vi.fn().mockResolvedValue({
    id: "wh-1",
    companyId: "company-1",
    url: "https://example.com/hook",
    description: "Test webhook",
    eventTypes: ["run.completed"],
    enabled: true,
    secret: "whsec_test123",
    createdAt: "2026-03-10T00:00:00Z",
    updatedAt: "2026-03-10T00:00:00Z",
  }),
  list: vi.fn().mockResolvedValue([
    {
      id: "wh-1",
      companyId: "company-1",
      url: "https://example.com/hook",
      eventTypes: ["run.completed"],
      enabled: true,
    },
  ]),
  getById: vi.fn().mockResolvedValue({
    id: "wh-1",
    companyId: "company-1",
    url: "https://example.com/hook",
    description: "Test webhook",
    eventTypes: ["run.completed"],
    enabled: true,
  }),
  update: vi.fn().mockResolvedValue({
    id: "wh-1",
    companyId: "company-1",
    url: "https://example.com/hook-updated",
    eventTypes: ["run.completed", "run.failed"],
    enabled: true,
  }),
  remove: vi.fn().mockResolvedValue(undefined),
  listDeliveries: vi.fn().mockResolvedValue([]),
  createDelivery: vi.fn().mockResolvedValue({ id: "del-1" }),
  attemptDelivery: vi.fn().mockResolvedValue({ success: true, responseStatus: 200 }),
  rotateSecret: vi.fn(),
}));

vi.mock("../services/webhooks.js", () => ({
  webhookService: () => mockWebhookService,
  generateWebhookSecret: vi.fn(),
  signPayload: vi.fn(),
  buildWebhookHeaders: vi.fn(),
  getRetryDelay: vi.fn(),
}));

vi.mock("../services/index.js", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
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

  app.use("/api", webhookRoutes({} as any));
  app.use(errorHandler);

  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Webhook CRUD API contracts", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it("GET /api/companies/:companyId/webhooks returns 200 with array", async () => {
    const res = await request(app).get("/api/companies/company-1/webhooks");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty("id");
    expect(res.body[0]).toHaveProperty("url");
  });

  it("POST /api/companies/:companyId/webhooks with valid body returns 201", async () => {
    const res = await request(app)
      .post("/api/companies/company-1/webhooks")
      .send({
        url: "https://example.com/hook",
        eventTypes: ["run.completed"],
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("url");
    expect(res.body).toHaveProperty("eventTypes");
    expect(mockWebhookService.create).toHaveBeenCalledOnce();
  });

  it("GET /api/companies/:companyId/webhooks/:webhookId returns 200 with webhook object", async () => {
    const res = await request(app).get("/api/companies/company-1/webhooks/wh-1");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("id", "wh-1");
    expect(res.body).toHaveProperty("companyId", "company-1");
    expect(res.body).toHaveProperty("url");
    expect(mockWebhookService.getById).toHaveBeenCalledWith("wh-1");
  });

  it("DELETE /api/companies/:companyId/webhooks/:webhookId returns 204", async () => {
    const res = await request(app).delete("/api/companies/company-1/webhooks/wh-1");
    expect(res.status).toBe(204);
    expect(mockWebhookService.remove).toHaveBeenCalledWith("wh-1");
  });

  it("POST /api/companies/:companyId/webhooks with invalid body returns 400", async () => {
    const res = await request(app)
      .post("/api/companies/company-1/webhooks")
      .send({
        url: "not-a-url",
        eventTypes: [],
      });
    expect(res.status).toBe(400);
  });
});
