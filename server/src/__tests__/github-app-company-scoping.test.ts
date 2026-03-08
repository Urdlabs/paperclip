import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests for company-scoped GitHub App features:
 * - generateManifest() embedding companyId in redirect/callback URLs
 * - generateAllInstallationTokens() priority & dedup logic
 * - generateInstallationToken() backwards compat
 */

// Set a deterministic master key before any imports
process.env.PAPERCLIP_SECRETS_MASTER_KEY = "a".repeat(64); // 32 bytes hex

// Stub global fetch for GitHub API calls
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Import after env is set
const { githubAppService } = await import("../services/github-app.js");

// We need the encrypt function to create valid test data.
// Since it's not exported, we import the module and use a helper that
// creates an app row through the service's exchangeCode path.
// Instead, we'll create a small helper that encrypts using the same approach.
import { createCipheriv, randomBytes } from "node:crypto";

function encrypt(value: string): string {
  const key = Buffer.from("a".repeat(64), "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({
    scheme: "local_encrypted_v1",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  });
}

// Real RSA key generated for tests (never used outside this file)
const TEST_RSA_KEY = "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEAvRuFYxPzlJDAhP389BQBd9IQmI39Q1KWxEV+lHEK/hpgqKNQ\npoDDcTIAox8t6GCSg70iNU2VGZpJadEYVBKuvWTd3ubZ/kIYzbhk8RGfD0Mxs3le\nfx5NeuzBkwyE/BFPFJLkKQd0qm/1AwPlAoia4Ie+gPIwUPBvdCh0e1kEQfVqeggB\nu6p/02UcnENZ28VGpNw/2Ocx63ZUYKCu9lkMjLSRrWx2VYYy9S4yZvw1p/iZVltj\nnoKGcH7UBW67PnZoM7qPXVs/jNxG+TKQxQepKKePrawpFzKJb5YvDoJmhjw2NaAi\nVWzbQZBvhJdC2NhfNlUTdI9/3qwpZExvgIGTYQIDAQABAoIBABRUzyR10qxYW7pw\nrC95rya4uPwN1/rS+E6lwhQniy0CnP3EgTlFgr26yILBKWhgaaAsR28/phYYlmgA\nCQOQ9qR6IbiDTVCevpfviTq50EYNzVwkYlp8YYwjxDQRFoMbQUtO96TJnmtsmgT2\n+Dorgas+LOckIrmw/+qXJt7UFTcaAiij2N67LnYzIItqUbkAudwTEoqtdqY8if37\nYhdbxGDDJWf7TAdUJZ6mOTsuWlIzMz4uXDDwh+tAlm5oocpswQ59q9ZbVLzSL2lg\ncM21uZu/LUTE/Uo8LcBnPsvy1WLiA1a64hUqSIJyv/oZSIDqkoeRybY/E5+S/vMS\nL91RNSECgYEA7B90kLHfqeRhx1cv95ljZOJVBLbsf4jnCDzgJY6YNj6I8Sqo8j/3\nKp7al7fiQyIsJQxADbde6GrixeX5Avq4DzXxKId+Gv+NgUWFv5TCXdkBp6eNIMCg\nouyxq8DvqS/TMYF69X1+2l6Zzj8rdo6YrIH7Dj+F4iX1iOOBD156w50CgYEAzQbd\ngV3v2gZ/tYgdTDGUkimIqXKjO3FXHmoKzE2ZURcuF2xI20KIPX/S/a0CWWWNeUDR\n7hbtO37eoMxKxG8a3pPjCmdxVx8dD4u26Tw9wwKYIr1NGakjFhYA9EEWlCWHPTXY\nRAWfdsu8xd0ZvKjkhe//k/5Kup5i0yX+f3g9zZUCgYEAtJwG3FrCO0Burjx5e0l/\npn4dC+MjmRXNqhZuWSvuL6e7tcSsv8e/toEVsPE9h55O5/Or1xII7Xw8g6U5yFag\njTn0gczJ37rTsSrNeFJALeq8glH9+Cx/cr/b0wVcDCyBvZ9NvxNEAaJUwVa+VwwR\nqfouX6KlNOtWGWPzpx7chl0CgYATgj+5e5LDEDM+tsDy6xTUA5e5Z+sYUOSVREna\nvteD28zK9cbI9j+4el09PiUnFH6ttvlCynOwYZYVftrubhQEcdX8u3MRcyh0vjqd\nXtoRoEGRrKmVc36fL2DP3RGk7x07OdBmSJKv3xsLSMqWJQv5oqiTEHNT5pZIuSjK\nQErBMQKBgQDF66rPdvZPy3oeKGOStKRdwBXUjaqN2pSsL5fxBFRYA54MACBLTwPM\nt36dLxFwAQARpaFeGr/MhN85kGScztw+NAuRAJtYwI4wcMCGoI5ipCtI/rbCJcC4\nqB/W07jzZ4FhRTmBQdLvKxkGpwfGlWlDP+NnxlMul4J0MLDJVAJ8xw==\n-----END RSA PRIVATE KEY-----\n";

// ---------------------------------------------------------------------------
// Test data builders
// ---------------------------------------------------------------------------

function makeApp(overrides: Record<string, unknown> = {}) {
  return {
    id: "app-1",
    githubAppId: 100,
    githubAppSlug: "paperclip-test",
    appName: "Paperclip Test",
    clientId: "client-1",
    clientSecretEncrypted: encrypt("secret"),
    privateKeyEncrypted: encrypt(TEST_RSA_KEY),
    webhookSecretEncrypted: encrypt("whsec"),
    permissions: { contents: "write" },
    events: [],
    htmlUrl: "https://github.com/apps/paperclip-test",
    companyId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeInstallation(overrides: Record<string, unknown> = {}) {
  return {
    id: "inst-1",
    githubAppId: "app-1",
    installationId: 1000,
    accountLogin: "orgA",
    accountType: "Organization",
    repositorySelection: "all",
    suspendedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Drizzle mock
// ---------------------------------------------------------------------------

type AppRow = ReturnType<typeof makeApp>;
type InstRow = ReturnType<typeof makeInstallation>;

function thenableResult<T>(data: T[]) {
  return {
    where: () => thenableResult(data),
    then: (resolve: (value: T[]) => unknown, reject?: (err: unknown) => unknown) =>
      Promise.resolve(data).then(resolve, reject),
  };
}

function createMockDb(opts: { apps?: AppRow[]; installations?: InstRow[] }) {
  const apps = opts.apps ?? [];
  const installations = opts.installations ?? [];

  return {
    select: () => ({
      from: (table: unknown) => {
        const tableName =
          (table as any)?.[Symbol.for("drizzle:Name")] ??
          (table as any)?._?.name ?? "";
        if (tableName === "github_apps") {
          return thenableResult(apps);
        }
        if (tableName === "github_app_installations") {
          return thenableResult(installations);
        }
        return thenableResult([]);
      },
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([makeApp()]),
      }),
    }),
    update: vi.fn(),
    delete: vi.fn(),
  } as any;
}

function mockTokenResponse(token: string) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      token,
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    }),
    headers: new Map(),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("generateManifest", () => {
  it("does not embed companyId when not provided", () => {
    const svc = githubAppService(createMockDb({}));
    const manifest = svc.generateManifest("https://example.com");
    expect(manifest.redirect_url).toBe("https://example.com/api/github/callback");
    expect((manifest.callback_urls as string[])[0]).toBe(
      "https://example.com/api/github/callback",
    );
  });

  it("embeds companyId as query param in redirect_url and callback_urls", () => {
    const svc = githubAppService(createMockDb({}));
    const manifest = svc.generateManifest("https://example.com", "company-42");
    expect(manifest.redirect_url).toBe(
      "https://example.com/api/github/callback?companyId=company-42",
    );
    expect((manifest.callback_urls as string[])[0]).toBe(
      "https://example.com/api/github/callback?companyId=company-42",
    );
  });

  it("strips trailing slashes from publicUrl", () => {
    const svc = githubAppService(createMockDb({}));
    const manifest = svc.generateManifest("https://example.com///", "c1");
    expect(manifest.redirect_url).toContain("https://example.com/api/github/callback");
  });
});

describe("generateAllInstallationTokens", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns empty array when no apps configured", async () => {
    const svc = githubAppService(createMockDb({ apps: [], installations: [] }));
    const tokens = await svc.generateAllInstallationTokens();
    expect(tokens).toEqual([]);
  });

  it("returns tokens for all active installations", async () => {
    const apps = [makeApp({ id: "app-1" })];
    const installations = [
      makeInstallation({ id: "i1", githubAppId: "app-1", installationId: 1000, accountLogin: "orgA" }),
      makeInstallation({ id: "i2", githubAppId: "app-1", installationId: 1001, accountLogin: "orgB" }),
    ];

    // The service generates a JWT (needs decrypt of private key) then calls GitHub API
    mockTokenResponse("token-orgA");
    mockTokenResponse("token-orgB");

    const svc = githubAppService(createMockDb({ apps, installations }));
    const tokens = await svc.generateAllInstallationTokens();

    expect(tokens).toHaveLength(2);
    expect(tokens[0]).toMatchObject({ token: "token-orgA", accountLogin: "orgA" });
    expect(tokens[1]).toMatchObject({ token: "token-orgB", accountLogin: "orgB" });
  });

  it("skips suspended installations", async () => {
    const apps = [makeApp({ id: "app-1" })];
    const installations = [
      makeInstallation({ id: "i1", githubAppId: "app-1", installationId: 1000, accountLogin: "orgA" }),
      makeInstallation({
        id: "i2",
        githubAppId: "app-1",
        installationId: 1001,
        accountLogin: "orgB",
        suspendedAt: new Date(),
      }),
    ];

    mockTokenResponse("token-orgA");

    const svc = githubAppService(createMockDb({ apps, installations }));
    const tokens = await svc.generateAllInstallationTokens();

    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.accountLogin).toBe("orgA");
  });

  it("deduplicates by accountLogin (case-insensitive), company-scoped first", async () => {
    const companyApp = makeApp({ id: "app-company", companyId: "company-1" });
    const unscopedApp = makeApp({ id: "app-unscoped", companyId: null, githubAppId: 200 });
    const apps = [unscopedApp, companyApp]; // deliberately unsorted

    const installations = [
      makeInstallation({ id: "i1", githubAppId: "app-company", installationId: 3000, accountLogin: "OrgA" }),
      makeInstallation({ id: "i2", githubAppId: "app-unscoped", installationId: 3001, accountLogin: "orgA" }),
    ];

    mockTokenResponse("company-token");

    const db = createMockDb({ apps, installations });
    const svc = githubAppService(db);
    const tokens = await svc.generateAllInstallationTokens({ companyId: "company-1" });

    // Should only get 1 token since both map to "orga" (case-insensitive)
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.token).toBe("company-token");
  });
});

describe("generateInstallationToken (backwards compat)", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns null when no apps configured", async () => {
    const svc = githubAppService(createMockDb({ apps: [], installations: [] }));
    const token = await svc.generateInstallationToken();
    expect(token).toBeNull();
  });

  it("returns first token from generateAllInstallationTokens", async () => {
    const apps = [makeApp({ id: "app-1" })];
    const installations = [
      makeInstallation({ id: "i1", githubAppId: "app-1", installationId: 5000, accountLogin: "myorg" }),
    ];

    mockTokenResponse("first-token");

    const svc = githubAppService(createMockDb({ apps, installations }));
    const token = await svc.generateInstallationToken();

    expect(token).toBe("first-token");
  });
});
