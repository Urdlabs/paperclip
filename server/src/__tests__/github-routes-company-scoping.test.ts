import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { githubRoutes } from "../routes/github.js";
import { errorHandler } from "../middleware/index.js";

// ---------------------------------------------------------------------------
// Mock the github-app service
// ---------------------------------------------------------------------------

const mockGithubAppService = vi.hoisted(() => ({
  getAppConfig: vi.fn(),
  getStatus: vi.fn(),
  generateManifest: vi.fn(),
  exchangeCode: vi.fn(),
  deleteApp: vi.fn(),
  listInstallations: vi.fn(),
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createApp(actor: Record<string, unknown> = defaultBoardAdmin()) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = actor;
    next();
  });
  // Set the env var the route reads for public URL
  process.env.PAPERCLIP_PUBLIC_URL = "https://example.com";
  app.use("/api", githubRoutes({} as any));
  app.use(errorHandler);
  return app;
}

function defaultBoardAdmin() {
  return {
    type: "board",
    userId: "user-1",
    companyIds: ["company-1"],
    source: "session",
    isInstanceAdmin: true,
  };
}

function defaultBoard() {
  return {
    type: "board",
    userId: "user-1",
    companyIds: ["company-1"],
    source: "session",
    isInstanceAdmin: false,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /github/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGithubAppService.getStatus.mockResolvedValue({ configured: false, apps: [] });
  });

  it("calls getStatus without companyId when param not provided", async () => {
    const app = createApp(defaultBoard());
    await request(app).get("/api/github/status").expect(200);

    expect(mockGithubAppService.getStatus).toHaveBeenCalledWith(undefined);
  });

  it("passes companyId to getStatus when query param provided", async () => {
    const app = createApp(defaultBoard());
    await request(app).get("/api/github/status?companyId=company-42").expect(200);

    expect(mockGithubAppService.getStatus).toHaveBeenCalledWith("company-42");
  });
});

describe("GET /github/manifest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGithubAppService.generateManifest.mockReturnValue({ name: "test" });
  });

  it("passes companyId to generateManifest when query param provided", async () => {
    const app = createApp();
    await request(app).get("/api/github/manifest?companyId=company-42").expect(200);

    expect(mockGithubAppService.generateManifest).toHaveBeenCalledWith(
      "https://example.com",
      "company-42",
    );
  });

  it("passes both org and companyId when both provided", async () => {
    const app = createApp();
    const res = await request(app)
      .get("/api/github/manifest?org=myorg&companyId=company-42")
      .expect(200);

    expect(mockGithubAppService.generateManifest).toHaveBeenCalledWith(
      "https://example.com",
      "company-42",
    );
    expect(res.body.redirectUrl).toContain("organizations/myorg");
  });

  it("calls generateManifest without companyId when not provided", async () => {
    const app = createApp();
    await request(app).get("/api/github/manifest").expect(200);

    expect(mockGithubAppService.generateManifest).toHaveBeenCalledWith(
      "https://example.com",
      undefined,
    );
  });
});

describe("GET /github/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGithubAppService.exchangeCode.mockResolvedValue({
      githubAppSlug: "paperclip-test",
    });
  });

  it("passes companyId to exchangeCode when query param provided", async () => {
    const app = createApp();
    const res = await request(app)
      .get("/api/github/callback?code=test-code&companyId=company-42");

    // It redirects to GitHub for installation
    expect(res.status).toBe(302);
    expect(mockGithubAppService.exchangeCode).toHaveBeenCalledWith(
      "test-code",
      "company-42",
    );
  });

  it("passes undefined companyId when not provided", async () => {
    const app = createApp();
    await request(app).get("/api/github/callback?code=test-code");

    expect(mockGithubAppService.exchangeCode).toHaveBeenCalledWith(
      "test-code",
      undefined,
    );
  });

  it("returns 400 when code is missing", async () => {
    const app = createApp();
    const res = await request(app).get("/api/github/callback");

    expect(res.status).toBe(400);
  });
});
