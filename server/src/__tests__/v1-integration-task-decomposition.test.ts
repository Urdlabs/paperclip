import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/index.js";
import { issueRoutes } from "../routes/issues.js";

/**
 * Integration tests for task decomposition dependency API.
 *
 * Verifies the subtask and dependency endpoints on issue routes
 * return correct status codes and response shapes.
 */

// ---------------------------------------------------------------------------
// Mock services
// ---------------------------------------------------------------------------

const mockIssueService = vi.hoisted(() => ({
  createSubtask: vi.fn().mockResolvedValue({
    id: "subtask-1",
    title: "Subtask one",
    identifier: "PAP-100",
    companyId: "company-1",
    parentIssueId: "issue-1",
  }),
  listSubtasks: vi.fn().mockResolvedValue([
    { id: "subtask-1", title: "Subtask one", identifier: "PAP-100" },
    { id: "subtask-2", title: "Subtask two", identifier: "PAP-101" },
  ]),
  addDependency: vi.fn().mockResolvedValue({
    issueId: "issue-1",
    dependsOnId: "issue-2",
  }),
  removeDependency: vi.fn().mockResolvedValue(undefined),
  getExecutionWaves: vi.fn().mockResolvedValue([]),
  // Stubs for other issueService methods that routes may call during setup
  list: vi.fn().mockResolvedValue({ issues: [], total: 0 }),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  getByIdentifier: vi.fn(),
  getComments: vi.fn().mockResolvedValue([]),
  addComment: vi.fn(),
  checkout: vi.fn(),
  listLabels: vi.fn().mockResolvedValue([]),
  createLabel: vi.fn(),
  deleteLabel: vi.fn(),
  addLabelToIssue: vi.fn(),
  removeLabelFromIssue: vi.fn(),
  listAttachments: vi.fn().mockResolvedValue([]),
  createAttachmentMetadata: vi.fn(),
  getAttachmentById: vi.fn(),
  completeAttachmentUpload: vi.fn(),
  deleteAttachment: vi.fn(),
  bulkUpdate: vi.fn(),
  linkApproval: vi.fn(),
  unlinkApproval: vi.fn(),
}));

const mockAccessService = vi.hoisted(() => ({
  getCompanyMembers: vi.fn().mockResolvedValue([]),
}));

const mockHeartbeatService = vi.hoisted(() => ({
  getLatestRun: vi.fn(),
}));

const mockAgentService = vi.hoisted(() => ({
  getById: vi.fn(),
  list: vi.fn().mockResolvedValue([]),
}));

const mockProjectService = vi.hoisted(() => ({
  getById: vi.fn(),
  list: vi.fn().mockResolvedValue([]),
}));

const mockGoalService = vi.hoisted(() => ({
  getById: vi.fn(),
  list: vi.fn().mockResolvedValue([]),
}));

const mockIssueApprovalService = vi.hoisted(() => ({
  getByIssueId: vi.fn(),
  list: vi.fn().mockResolvedValue([]),
}));

vi.mock("../services/index.js", () => ({
  issueService: () => mockIssueService,
  accessService: () => mockAccessService,
  heartbeatService: () => mockHeartbeatService,
  agentService: () => mockAgentService,
  projectService: () => mockProjectService,
  goalService: () => mockGoalService,
  issueApprovalService: () => mockIssueApprovalService,
  logActivity: vi.fn(),
}));

vi.mock("../services/activity-log.js", () => ({
  logActivity: vi.fn(),
}));

vi.mock("../middleware/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
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

  // issueRoutes expects (db, storage) -- pass stubs
  const mockStorage = {} as any;
  app.use("/api", issueRoutes({} as any, mockStorage));
  app.use(errorHandler);

  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("v1.0 integration: task decomposition", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  describe("POST /api/companies/:companyId/issues/:issueId/subtasks", () => {
    const validBody = {
      title: "Subtask one",
    };

    it("returns 201 with the created subtask", async () => {
      const res = await request(app)
        .post("/api/companies/company-1/issues/issue-1/subtasks")
        .send(validBody);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("id", "subtask-1");
      expect(res.body).toHaveProperty("title", "Subtask one");
      expect(res.body).toHaveProperty("identifier", "PAP-100");
    });

    it("calls issueService.createSubtask with correct args", async () => {
      await request(app)
        .post("/api/companies/company-1/issues/issue-1/subtasks")
        .send(validBody);

      expect(mockIssueService.createSubtask).toHaveBeenCalledWith(
        "company-1",
        "issue-1",
        expect.objectContaining({ title: "Subtask one" }),
      );
    });

    it("rejects request with empty title", async () => {
      const res = await request(app)
        .post("/api/companies/company-1/issues/issue-1/subtasks")
        .send({ title: "" });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/companies/:companyId/issues/:issueId/subtasks", () => {
    it("returns 200 with an array of subtasks", async () => {
      const res = await request(app).get(
        "/api/companies/company-1/issues/issue-1/subtasks",
      );

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toHaveProperty("id");
      expect(res.body[0]).toHaveProperty("title");
    });

    it("passes companyId and issueId to service", async () => {
      await request(app).get(
        "/api/companies/company-1/issues/issue-1/subtasks",
      );

      expect(mockIssueService.listSubtasks).toHaveBeenCalledWith(
        "company-1",
        "issue-1",
      );
    });
  });

  describe("POST /api/companies/:companyId/issues/:issueId/dependencies", () => {
    const validBody = {
      dependsOnId: "00000000-0000-0000-0000-000000000002",
    };

    it("returns 201 with the created dependency edge", async () => {
      const res = await request(app)
        .post("/api/companies/company-1/issues/issue-1/dependencies")
        .send(validBody);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("issueId");
      expect(res.body).toHaveProperty("dependsOnId");
    });

    it("calls issueService.addDependency with correct args", async () => {
      await request(app)
        .post("/api/companies/company-1/issues/issue-1/dependencies")
        .send(validBody);

      expect(mockIssueService.addDependency).toHaveBeenCalledWith(
        "company-1",
        "issue-1",
        "00000000-0000-0000-0000-000000000002",
      );
    });

    it("rejects request with non-UUID dependsOnId", async () => {
      const res = await request(app)
        .post("/api/companies/company-1/issues/issue-1/dependencies")
        .send({ dependsOnId: "not-a-uuid" });

      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /api/companies/:companyId/issues/:issueId/dependencies/:dependsOnId", () => {
    it("returns 200 with ok confirmation", async () => {
      const res = await request(app).delete(
        "/api/companies/company-1/issues/issue-1/dependencies/dep-2",
      );

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("ok", true);
    });

    it("calls issueService.removeDependency with correct args", async () => {
      await request(app).delete(
        "/api/companies/company-1/issues/issue-1/dependencies/dep-2",
      );

      expect(mockIssueService.removeDependency).toHaveBeenCalledWith(
        "company-1",
        "issue-1",
        "dep-2",
      );
    });
  });

  describe("GET /api/companies/:companyId/issues/:issueId/execution-waves", () => {
    it("returns 200 with an array", async () => {
      const res = await request(app).get(
        "/api/companies/company-1/issues/issue-1/execution-waves",
      );

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
