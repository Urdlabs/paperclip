import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/index.js";
import { skillProfileRoutes } from "../routes/skill-profiles.js";

/**
 * Integration tests for skill profile CRUD API.
 *
 * Verifies that skill profile endpoints return correct status codes and
 * response shapes for list, get, create, update (PATCH), and delete.
 */

// ---------------------------------------------------------------------------
// Mock services
// ---------------------------------------------------------------------------

const mockSkillProfileService = vi.hoisted(() => ({
  list: vi.fn().mockResolvedValue([
    { id: "sp-1", name: "Backend Dev", slug: "backend-dev", systemPromptAdditions: "focus on APIs", isBuiltin: false, companyId: "company-1" },
    { id: "sp-2", name: "Code Reviewer", slug: "code-reviewer", systemPromptAdditions: "review code", isBuiltin: true, companyId: "company-1" },
  ]),
  getById: vi.fn().mockResolvedValue({
    id: "sp-1",
    name: "Backend Dev",
    slug: "backend-dev",
    systemPromptAdditions: "focus on APIs",
    isBuiltin: false,
    companyId: "company-1",
  }),
  create: vi.fn().mockResolvedValue({
    id: "sp-3",
    name: "Frontend Dev",
    slug: "frontend-dev",
    systemPromptAdditions: "focus on UI",
    isBuiltin: false,
    companyId: "company-1",
  }),
  update: vi.fn().mockResolvedValue({
    id: "sp-1",
    name: "Backend Dev Updated",
    slug: "backend-dev",
    systemPromptAdditions: "focus on APIs and infra",
    isBuiltin: false,
    companyId: "company-1",
  }),
  delete: vi.fn().mockResolvedValue(undefined),
  seedBuiltinProfiles: vi.fn().mockResolvedValue([]),
}));

vi.mock("../services/index.js", () => ({
  skillProfileService: () => mockSkillProfileService,
  logActivity: vi.fn(),
}));

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

  app.use("/api", skillProfileRoutes({} as any));
  app.use(errorHandler);

  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("v1.0 integration: skill profiles", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();

    // Re-apply default mocks after clear
    mockSkillProfileService.list.mockResolvedValue([
      { id: "sp-1", name: "Backend Dev", slug: "backend-dev", systemPromptAdditions: "focus on APIs", isBuiltin: false, companyId: "company-1" },
      { id: "sp-2", name: "Code Reviewer", slug: "code-reviewer", systemPromptAdditions: "review code", isBuiltin: true, companyId: "company-1" },
    ]);
    mockSkillProfileService.getById.mockResolvedValue({
      id: "sp-1",
      name: "Backend Dev",
      slug: "backend-dev",
      systemPromptAdditions: "focus on APIs",
      isBuiltin: false,
      companyId: "company-1",
    });
    mockSkillProfileService.create.mockResolvedValue({
      id: "sp-3",
      name: "Frontend Dev",
      slug: "frontend-dev",
      systemPromptAdditions: "focus on UI",
      isBuiltin: false,
      companyId: "company-1",
    });
    mockSkillProfileService.update.mockResolvedValue({
      id: "sp-1",
      name: "Backend Dev Updated",
      slug: "backend-dev",
      systemPromptAdditions: "focus on APIs and infra",
      isBuiltin: false,
      companyId: "company-1",
    });
    mockSkillProfileService.delete.mockResolvedValue(undefined);
    mockSkillProfileService.seedBuiltinProfiles.mockResolvedValue([]);

    app = createApp();
  });

  describe("GET /api/companies/:companyId/skill-profiles", () => {
    it("returns 200 with an array of profiles", async () => {
      const res = await request(app).get(
        "/api/companies/company-1/skill-profiles",
      );

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toHaveProperty("id");
      expect(res.body[0]).toHaveProperty("name");
      expect(res.body[0]).toHaveProperty("slug");
      expect(res.body[0]).toHaveProperty("isBuiltin");
    });

    it("passes companyId to service.list", async () => {
      await request(app).get("/api/companies/company-1/skill-profiles");
      expect(mockSkillProfileService.list).toHaveBeenCalledWith("company-1");
    });
  });

  describe("GET /api/companies/:companyId/skill-profiles/:profileId", () => {
    it("returns 200 with a single profile", async () => {
      const res = await request(app).get(
        "/api/companies/company-1/skill-profiles/sp-1",
      );

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("id", "sp-1");
      expect(res.body).toHaveProperty("name", "Backend Dev");
      expect(res.body).toHaveProperty("slug", "backend-dev");
    });

    it("returns 404 when profile not found", async () => {
      mockSkillProfileService.getById.mockResolvedValueOnce(null);

      const res = await request(app).get(
        "/api/companies/company-1/skill-profiles/nonexistent",
      );

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("error");
    });

    it("returns 404 when profile belongs to another company", async () => {
      mockSkillProfileService.getById.mockResolvedValueOnce({
        id: "sp-other",
        name: "Other",
        slug: "other",
        companyId: "company-other",
        isBuiltin: false,
      });

      const res = await request(app).get(
        "/api/companies/company-1/skill-profiles/sp-other",
      );

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/companies/:companyId/skill-profiles", () => {
    const validBody = {
      name: "Frontend Dev",
      slug: "frontend-dev",
      systemPromptAdditions: "focus on UI",
    };

    it("returns 201 with the created profile", async () => {
      const res = await request(app)
        .post("/api/companies/company-1/skill-profiles")
        .send(validBody);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("id", "sp-3");
      expect(res.body).toHaveProperty("name", "Frontend Dev");
      expect(res.body).toHaveProperty("slug", "frontend-dev");
    });

    it("calls service.create with companyId and body", async () => {
      await request(app)
        .post("/api/companies/company-1/skill-profiles")
        .send(validBody);

      expect(mockSkillProfileService.create).toHaveBeenCalledWith(
        "company-1",
        expect.objectContaining({
          name: "Frontend Dev",
          slug: "frontend-dev",
          systemPromptAdditions: "focus on UI",
        }),
      );
    });

    it("rejects request with invalid slug format", async () => {
      const res = await request(app)
        .post("/api/companies/company-1/skill-profiles")
        .send({ name: "Test", slug: "INVALID SLUG!", systemPromptAdditions: "test" });

      expect(res.status).toBe(400);
    });

    it("rejects request with missing required fields", async () => {
      const res = await request(app)
        .post("/api/companies/company-1/skill-profiles")
        .send({ name: "Test" }); // missing slug and systemPromptAdditions

      expect(res.status).toBe(400);
    });
  });

  describe("PATCH /api/companies/:companyId/skill-profiles/:profileId", () => {
    it("returns 200 with the updated profile", async () => {
      const res = await request(app)
        .patch("/api/companies/company-1/skill-profiles/sp-1")
        .send({ name: "Backend Dev Updated" });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("name", "Backend Dev Updated");
    });

    it("returns 403 when trying to modify builtin profile", async () => {
      mockSkillProfileService.getById.mockResolvedValueOnce({
        id: "sp-2",
        name: "Code Reviewer",
        slug: "code-reviewer",
        isBuiltin: true,
        companyId: "company-1",
      });

      const res = await request(app)
        .patch("/api/companies/company-1/skill-profiles/sp-2")
        .send({ name: "Modified Builtin" });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty("error");
    });
  });

  describe("DELETE /api/companies/:companyId/skill-profiles/:profileId", () => {
    it("returns 200 with deleted confirmation", async () => {
      const res = await request(app).delete(
        "/api/companies/company-1/skill-profiles/sp-1",
      );

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("deleted", true);
    });

    it("returns 403 when trying to delete builtin profile", async () => {
      mockSkillProfileService.getById.mockResolvedValueOnce({
        id: "sp-2",
        name: "Code Reviewer",
        slug: "code-reviewer",
        isBuiltin: true,
        companyId: "company-1",
      });

      const res = await request(app).delete(
        "/api/companies/company-1/skill-profiles/sp-2",
      );

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty("error");
    });

    it("returns 404 when profile not found", async () => {
      mockSkillProfileService.getById.mockResolvedValueOnce(null);

      const res = await request(app).delete(
        "/api/companies/company-1/skill-profiles/nonexistent",
      );

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/companies/:companyId/skill-profiles/seed", () => {
    it("returns 200 with seed result", async () => {
      mockSkillProfileService.seedBuiltinProfiles.mockResolvedValueOnce([
        { id: "sp-builtin-1", name: "Default Coder", isBuiltin: true },
      ]);

      const res = await request(app).post(
        "/api/companies/company-1/skill-profiles/seed",
      );

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("seeded", 1);
      expect(res.body).toHaveProperty("profiles");
      expect(Array.isArray(res.body.profiles)).toBe(true);
    });
  });
});
