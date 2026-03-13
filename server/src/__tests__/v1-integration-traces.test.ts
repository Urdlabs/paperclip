import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/index.js";
import { activityRoutes } from "../routes/activity.js";

/**
 * Integration tests for trace and activity API contracts.
 *
 * Verifies that activity/trace endpoints return expected status codes and shapes.
 * Permanent regression tests -- do NOT remove.
 */

// ---------------------------------------------------------------------------
// Mock services
// ---------------------------------------------------------------------------

const mockActivityService = vi.hoisted(() => ({
  list: vi.fn().mockResolvedValue([
    { id: "act-1", action: "run.started", entityType: "heartbeat_run", entityId: "run-1" },
    { id: "act-2", action: "run.completed", entityType: "heartbeat_run", entityId: "run-1" },
  ]),
  create: vi.fn().mockResolvedValue({ id: "act-3", action: "test.action" }),
  forIssue: vi.fn().mockResolvedValue([
    { id: "act-4", action: "issue.updated", entityType: "issue", entityId: "issue-1" },
  ]),
  runsForIssue: vi.fn().mockResolvedValue([
    { id: "run-1", status: "completed", startedAt: "2026-03-10T00:00:00Z" },
    { id: "run-2", status: "running", startedAt: "2026-03-10T01:00:00Z" },
  ]),
  issuesForRun: vi.fn().mockResolvedValue([
    { id: "issue-1", identifier: "PAP-100", title: "Fix login bug" },
  ]),
}));

const mockIssueService = vi.hoisted(() => ({
  getById: vi.fn().mockResolvedValue({
    id: "issue-1",
    identifier: "PAP-100",
    companyId: "company-1",
    title: "Fix login bug",
  }),
  getByIdentifier: vi.fn().mockResolvedValue({
    id: "issue-1",
    identifier: "PAP-100",
    companyId: "company-1",
    title: "Fix login bug",
  }),
}));

vi.mock("../services/activity.js", () => ({
  activityService: () => mockActivityService,
}));

vi.mock("../services/index.js", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    issueService: () => mockIssueService,
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

  app.use("/api", activityRoutes({} as any));
  app.use(errorHandler);

  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Trace and activity API contracts", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it("GET /api/companies/:companyId/activity returns 200 with array", async () => {
    const res = await request(app).get("/api/companies/company-1/activity");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty("action");
    expect(res.body[0]).toHaveProperty("entityType");
  });

  it("GET /api/issues/:issueId/runs returns 200 with array", async () => {
    const res = await request(app).get("/api/issues/issue-1/runs");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty("id");
    expect(res.body[0]).toHaveProperty("status");
  });

  it("GET /api/heartbeat-runs/:runId/issues returns 200 with array", async () => {
    const res = await request(app).get("/api/heartbeat-runs/run-1/issues");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty("id");
    expect(res.body[0]).toHaveProperty("identifier");
  });

  it("GET /api/issues/:identifier/runs resolves issue by identifier", async () => {
    const res = await request(app).get("/api/issues/PAP-100/runs");
    expect(res.status).toBe(200);
    expect(mockIssueService.getByIdentifier).toHaveBeenCalledWith("PAP-100");
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET /api/issues/:id/runs returns 404 for unknown issue", async () => {
    mockIssueService.getById.mockResolvedValueOnce(null);
    const res = await request(app).get("/api/issues/unknown-id/runs");
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
  });
});
