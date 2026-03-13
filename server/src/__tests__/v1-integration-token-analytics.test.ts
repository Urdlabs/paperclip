import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/index.js";
import { costRoutes } from "../routes/costs.js";

/**
 * Integration tests for token analytics (cost) API contracts.
 *
 * Verifies that cost routes return expected response shapes and status codes.
 * Permanent regression tests -- do NOT remove.
 */

// ---------------------------------------------------------------------------
// Mock services
// ---------------------------------------------------------------------------

const mockCostService = vi.hoisted(() => ({
  createEvent: vi.fn().mockResolvedValue({ id: "evt-1", costCents: 42, model: "gpt-4" }),
  summary: vi.fn().mockResolvedValue({
    totalCostCents: 1500,
    budgetMonthlyCents: 10000,
    totalTokens: 250000,
    cacheHitRate: 0.42,
    avgTokensPerRun: 12500,
    avgCompressionRatio: 0.65,
  }),
  byAgent: vi.fn().mockResolvedValue([
    { agentId: "agent-1", agentName: "Coder", totalCostCents: 800, totalTokens: 120000 },
  ]),
  timeSeries: vi.fn().mockResolvedValue([
    { date: "2026-03-10", costCents: 500, tokens: 80000 },
  ]),
  contextComposition: vi.fn().mockResolvedValue({
    issueContext: 0.3,
    projectContext: 0.5,
    instructions: 0.2,
  }),
  byProject: vi.fn().mockResolvedValue([
    { projectId: "proj-1", projectName: "Main", totalCostCents: 1500, totalTokens: 250000 },
  ]),
}));

const mockCompanyService = vi.hoisted(() => ({
  update: vi.fn().mockResolvedValue({ id: "company-1", budgetMonthlyCents: 20000 }),
}));

const mockAgentService = vi.hoisted(() => ({
  getById: vi.fn().mockResolvedValue({ id: "agent-1", companyId: "company-1", budgetMonthlyCents: 5000 }),
  update: vi.fn().mockResolvedValue({ id: "agent-1", companyId: "company-1", budgetMonthlyCents: 8000 }),
}));

vi.mock("../services/index.js", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    costService: () => mockCostService,
    companyService: () => mockCompanyService,
    agentService: () => mockAgentService,
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

  app.use("/api", costRoutes({} as any));
  app.use(errorHandler);

  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Token analytics (cost) API contracts", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it("GET /api/companies/:companyId/costs/summary returns 200 with expected fields", async () => {
    const res = await request(app).get("/api/companies/company-1/costs/summary");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("totalCostCents");
    expect(res.body).toHaveProperty("totalTokens");
    expect(res.body).toHaveProperty("cacheHitRate");
    expect(res.body).toHaveProperty("avgTokensPerRun");
    expect(res.body).toHaveProperty("avgCompressionRatio");
    expect(typeof res.body.totalTokens).toBe("number");
    expect(typeof res.body.cacheHitRate).toBe("number");
  });

  it("GET /api/companies/:companyId/costs/by-agent returns 200 with array", async () => {
    const res = await request(app).get("/api/companies/company-1/costs/by-agent");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty("agentId");
  });

  it("GET /api/companies/:companyId/costs/time-series returns 200 with array", async () => {
    const res = await request(app).get("/api/companies/company-1/costs/time-series");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty("date");
  });

  it("GET /api/companies/:companyId/costs/context-composition returns 200 with object", async () => {
    const res = await request(app).get("/api/companies/company-1/costs/context-composition");
    expect(res.status).toBe(200);
    expect(typeof res.body).toBe("object");
    expect(res.body).not.toBeNull();
    expect(res.body).toHaveProperty("issueContext");
  });

  it("GET /api/companies/:companyId/costs/by-project returns 200 with array", async () => {
    const res = await request(app).get("/api/companies/company-1/costs/by-project");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty("projectId");
  });
});
