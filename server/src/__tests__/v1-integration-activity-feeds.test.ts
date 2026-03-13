import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/index.js";
import { activityRoutes } from "../routes/activity.js";

/**
 * Integration tests for activity feed API contracts.
 *
 * Verifies the company-scoped activity list and create endpoints
 * return expected shapes and status codes.
 */

// ---------------------------------------------------------------------------
// Mock services
// ---------------------------------------------------------------------------

const mockActivityService = vi.hoisted(() => ({
  list: vi.fn().mockResolvedValue([
    { id: "act-1", action: "issue.created", createdAt: "2026-01-01T00:00:00Z" },
    { id: "act-2", action: "issue.updated", createdAt: "2026-01-01T01:00:00Z" },
  ]),
  create: vi.fn().mockResolvedValue({
    id: "act-3",
    action: "custom.action",
    createdAt: "2026-01-01T02:00:00Z",
  }),
  forIssue: vi.fn().mockResolvedValue([
    { id: "act-10", action: "issue.created" },
  ]),
  runsForIssue: vi.fn().mockResolvedValue([]),
  issuesForRun: vi.fn().mockResolvedValue([]),
}));

const mockIssueService = vi.hoisted(() => ({
  getById: vi.fn().mockResolvedValue({
    id: "issue-1",
    companyId: "company-1",
  }),
  getByIdentifier: vi.fn().mockResolvedValue({
    id: "issue-1",
    companyId: "company-1",
  }),
}));

vi.mock("../services/activity.js", () => ({
  activityService: () => mockActivityService,
}));

vi.mock("../services/index.js", () => ({
  issueService: () => mockIssueService,
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

  app.use("/api", activityRoutes({} as any));
  app.use(errorHandler);

  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("v1.0 integration: activity feeds", () => {
  describe("GET /api/companies/:companyId/activity", () => {
    it("returns 200 with an array of activity objects", async () => {
      const res = await request(createApp()).get(
        "/api/companies/company-1/activity",
      );
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toHaveProperty("id");
      expect(res.body[0]).toHaveProperty("action");
      expect(res.body[0]).toHaveProperty("createdAt");
    });

    it("passes companyId filter to service", async () => {
      await request(createApp()).get("/api/companies/company-1/activity");
      expect(mockActivityService.list).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: "company-1" }),
      );
    });

    it("forwards query params as filters", async () => {
      await request(createApp()).get(
        "/api/companies/company-1/activity?agentId=agent-1&entityType=issue",
      );
      expect(mockActivityService.list).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: "company-1",
          agentId: "agent-1",
          entityType: "issue",
        }),
      );
    });
  });

  describe("POST /api/companies/:companyId/activity", () => {
    const validBody = {
      actorId: "user-1",
      action: "custom.action",
      entityType: "issue",
      entityId: "entity-1",
    };

    it("returns 201 with the created activity object", async () => {
      const res = await request(createApp())
        .post("/api/companies/company-1/activity")
        .send(validBody);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("id", "act-3");
      expect(res.body).toHaveProperty("action", "custom.action");
      expect(res.body).toHaveProperty("createdAt");
    });

    it("calls service.create with companyId and body fields", async () => {
      await request(createApp())
        .post("/api/companies/company-1/activity")
        .send(validBody);

      expect(mockActivityService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: "company-1",
          actorId: "user-1",
          action: "custom.action",
          entityType: "issue",
          entityId: "entity-1",
        }),
      );
    });

    it("rejects request with missing required fields", async () => {
      const res = await request(createApp())
        .post("/api/companies/company-1/activity")
        .send({ action: "test" }); // missing actorId, entityType, entityId

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/issues/:id/activity", () => {
    it("returns 200 with activity for a UUID-style issue id", async () => {
      const res = await request(createApp()).get(
        "/api/issues/550e8400-e29b-41d4-a716-446655440000/activity",
      );

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      // UUID format does not match /^[A-Z]+-\d+$/i so it uses getById
      expect(mockIssueService.getById).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440000",
      );
      expect(mockActivityService.forIssue).toHaveBeenCalledWith("issue-1");
    });

    it("resolves identifier-style IDs via getByIdentifier", async () => {
      const res = await request(createApp()).get(
        "/api/issues/PAP-100/activity",
      );

      expect(res.status).toBe(200);
      expect(mockIssueService.getByIdentifier).toHaveBeenCalledWith("PAP-100");
    });

    it("returns 404 when issue is not found", async () => {
      mockIssueService.getByIdentifier.mockResolvedValueOnce(null);

      // "FAKE-999" matches identifier pattern, so getByIdentifier is called
      const res = await request(createApp()).get(
        "/api/issues/FAKE-999/activity",
      );

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("error");
    });
  });
});
