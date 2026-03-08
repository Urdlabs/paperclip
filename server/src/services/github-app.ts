import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  createSign,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { existsSync, readFileSync, mkdirSync, writeFileSync, chmodSync } from "node:fs";
import path from "node:path";
import { eq, or, isNull, and } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { githubApps, githubAppInstallations } from "@paperclipai/db";
import type { GitHubAppConfig, GitHubAppInstallation, GitHubAppStatus } from "@paperclipai/shared";
import { logger as rootLogger } from "../middleware/logger.js";

const logger = rootLogger.child({ service: "github-app" });

// ---------------------------------------------------------------------------
// Encryption helpers – reuses same master-key approach as local-encrypted
// secrets provider (AES-256-GCM).
// ---------------------------------------------------------------------------

let _masterKey: Buffer | null = null;

function decodeMasterKeyRaw(raw: string): Buffer | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^[A-Fa-f0-9]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }
  try {
    const decoded = Buffer.from(trimmed, "base64");
    if (decoded.length === 32) return decoded;
  } catch {
    // ignored
  }
  if (Buffer.byteLength(trimmed, "utf8") === 32) {
    return Buffer.from(trimmed, "utf8");
  }
  return null;
}

function getMasterKey(): Buffer {
  if (_masterKey) return _masterKey;

  // Try env var first
  const raw = process.env.PAPERCLIP_SECRETS_MASTER_KEY;
  if (raw && raw.trim().length > 0) {
    const decoded = decodeMasterKeyRaw(raw);
    if (decoded) {
      _masterKey = decoded;
      return _masterKey;
    }
  }

  // Fall back to the key file
  const keyPath =
    process.env.PAPERCLIP_SECRETS_MASTER_KEY_FILE?.trim() ||
    path.resolve(process.cwd(), "data/secrets/master.key");

  if (existsSync(keyPath)) {
    const fileRaw = readFileSync(keyPath, "utf8");
    const decoded = decodeMasterKeyRaw(fileRaw);
    if (decoded) {
      _masterKey = decoded;
      return _masterKey;
    }
  }

  // Generate key if none exists
  const generated = randomBytes(32);
  const dir = path.dirname(keyPath);
  mkdirSync(dir, { recursive: true });
  writeFileSync(keyPath, generated.toString("base64"), { encoding: "utf8", mode: 0o600 });
  try {
    chmodSync(keyPath, 0o600);
  } catch {
    // best effort
  }
  _masterKey = generated;
  return _masterKey;
}

function encrypt(value: string): string {
  const key = getMasterKey();
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

function decrypt(stored: string): string {
  const key = getMasterKey();
  const material = JSON.parse(stored) as {
    scheme: string;
    iv: string;
    tag: string;
    ciphertext: string;
  };
  if (material.scheme !== "local_encrypted_v1") {
    throw new Error(`Unknown encryption scheme: ${material.scheme}`);
  }
  const iv = Buffer.from(material.iv, "base64");
  const tag = Buffer.from(material.tag, "base64");
  const ciphertext = Buffer.from(material.ciphertext, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString("utf8");
}

// ---------------------------------------------------------------------------
// JWT generation for GitHub App auth (RS256)
// ---------------------------------------------------------------------------

function generateJwt(appId: number, privateKeyPem: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iat: now - 60, // clock skew tolerance
    exp: now + 10 * 60, // 10 minutes
    iss: String(appId),
  };

  const b64url = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");

  const headerB64 = b64url(header);
  const payloadB64 = b64url(payload);
  const signingInput = `${headerB64}.${payloadB64}`;

  const signature = createSign("RSA-SHA256")
    .update(signingInput)
    .sign(privateKeyPem, "base64url");

  return `${signingInput}.${signature}`;
}

// ---------------------------------------------------------------------------
// Installation token cache
// ---------------------------------------------------------------------------

interface CachedToken {
  token: string;
  expiresAt: number; // unix ms
}

const tokenCache = new Map<number, CachedToken>();

function getCachedToken(installationId: number): string | null {
  const cached = tokenCache.get(installationId);
  if (!cached) return null;
  // Expire 5 minutes early to be safe
  if (Date.now() > cached.expiresAt - 5 * 60 * 1000) {
    tokenCache.delete(installationId);
    return null;
  }
  return cached.token;
}

function setCachedToken(installationId: number, token: string, expiresAt: string) {
  tokenCache.set(installationId, {
    token,
    expiresAt: new Date(expiresAt).getTime(),
  });
}

// ---------------------------------------------------------------------------
// GitHub API helpers
// ---------------------------------------------------------------------------

const GITHUB_API = "https://api.github.com";

async function githubFetch(url: string, opts: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...opts,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(opts.headers as Record<string, string> | undefined),
    },
  });
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export interface InstallationToken {
  token: string;
  accountLogin: string;
  installationId: number;
}

export function githubAppService(db: Db) {
  /** Get GitHub App rows, optionally scoped to a company (+ unscoped fallbacks). */
  async function getApps(companyId?: string): Promise<(typeof githubApps.$inferSelect)[]> {
    if (companyId) {
      return db
        .select()
        .from(githubApps)
        .where(or(eq(githubApps.companyId, companyId), isNull(githubApps.companyId)));
    }
    return db.select().from(githubApps);
  }

  /** Get a specific GitHub App row by ID. */
  async function getAppById(appId: string): Promise<(typeof githubApps.$inferSelect) | null> {
    const rows = await db.select().from(githubApps).where(eq(githubApps.id, appId));
    return rows[0] ?? null;
  }

  /** Get the current GitHub App config as a public-safe type. */
  async function getAppConfig(): Promise<GitHubAppConfig | null> {
    const apps = await getApps();
    if (apps.length === 0) return null;
    const app = apps[0]!;
    return {
      id: app.id,
      githubAppId: app.githubAppId,
      githubAppSlug: app.githubAppSlug,
      appName: app.appName,
      htmlUrl: app.htmlUrl,
      permissions: app.permissions,
      events: app.events,
      createdAt: app.createdAt,
    };
  }

  /** Get status summary with all apps and their installations. */
  async function getStatus(companyId?: string): Promise<GitHubAppStatus> {
    const apps = await getApps(companyId);
    if (apps.length === 0) {
      return { configured: false, apps: [] };
    }

    const allInstallations = await db.select().from(githubAppInstallations);

    const appEntries = apps.map((app) => {
      const appInstallations = allInstallations.filter(
        (i) => i.githubAppId === app.id,
      );
      const activeInstallations = appInstallations.filter((i) => !i.suspendedAt);
      return {
        id: app.id,
        appName: app.appName,
        appSlug: app.githubAppSlug,
        htmlUrl: app.htmlUrl,
        installationCount: activeInstallations.length,
        installations: appInstallations.map((r) => ({
          id: r.id,
          installationId: r.installationId,
          accountLogin: r.accountLogin,
          accountType: r.accountType,
          repositorySelection: r.repositorySelection,
          suspendedAt: r.suspendedAt,
          createdAt: r.createdAt,
        })),
      };
    });

    return {
      configured: true,
      apps: appEntries,
    };
  }

  /** Generate the manifest JSON for creating the GitHub App. */
  function generateManifest(publicUrl: string, companyId?: string): Record<string, unknown> {
    const base = publicUrl.replace(/\/+$/, "");
    const qs = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
    return {
      name: `Paperclip ${randomBytes(4).toString("hex")}`,
      url: base,
      hook_attributes: {
        url: `${base}/api/github/webhook`,
        active: true,
      },
      redirect_url: `${base}/api/github/callback${qs}`,
      setup_url: `${base}/github/setup-complete`,
      callback_urls: [`${base}/api/github/callback${qs}`],
      public: false,
      default_permissions: {
        contents: "write",
        pull_requests: "write",
        issues: "write",
        metadata: "read",
      },
      // installation and installation_repositories events are delivered
      // automatically to all GitHub Apps — they must NOT be listed here.
      default_events: [],
    };
  }

  /** Exchange the code from GitHub manifest flow for app credentials. */
  async function exchangeCode(code: string, companyId?: string): Promise<GitHubAppConfig> {
    const res = await githubFetch(`${GITHUB_API}/app-manifests/${code}/conversions`, {
      method: "POST",
    });
    if (!res.ok) {
      const text = await res.text();
      logger.error({ status: res.status, body: text }, "GitHub manifest code exchange failed");
      throw new Error(`GitHub code exchange failed: ${res.status}`);
    }
    const data = (await res.json()) as {
      id: number;
      slug: string;
      name: string;
      client_id: string;
      client_secret: string;
      pem: string;
      webhook_secret: string;
      permissions: Record<string, string>;
      events: string[];
      html_url: string;
    };

    // Store encrypted
    const [row] = await db
      .insert(githubApps)
      .values({
        githubAppId: data.id,
        githubAppSlug: data.slug,
        appName: data.name,
        clientId: data.client_id,
        clientSecretEncrypted: encrypt(data.client_secret),
        privateKeyEncrypted: encrypt(data.pem),
        webhookSecretEncrypted: encrypt(data.webhook_secret),
        permissions: data.permissions,
        events: data.events,
        htmlUrl: data.html_url,
        companyId: companyId ?? null,
      })
      .returning();

    logger.info(
      { githubAppId: data.id, slug: data.slug },
      "GitHub App created via manifest flow",
    );

    return {
      id: row!.id,
      githubAppId: data.id,
      githubAppSlug: data.slug,
      appName: data.name,
      htmlUrl: data.html_url,
      permissions: data.permissions,
      events: data.events,
      createdAt: row!.createdAt,
    };
  }

  /** Delete a specific GitHub App config from Paperclip by ID. */
  async function deleteApp(appId: string): Promise<void> {
    // Delete associated installations first
    await db.delete(githubAppInstallations).where(eq(githubAppInstallations.githubAppId, appId));
    await db.delete(githubApps).where(eq(githubApps.id, appId));
    tokenCache.clear();
    logger.info({ appId }, "GitHub App configuration removed");
  }

  /** List all installations across all apps. */
  async function listInstallations(): Promise<GitHubAppInstallation[]> {
    const rows = await db.select().from(githubAppInstallations);
    return rows.map((r) => ({
      id: r.id,
      installationId: r.installationId,
      accountLogin: r.accountLogin,
      accountType: r.accountType,
      repositorySelection: r.repositorySelection,
      suspendedAt: r.suspendedAt,
      createdAt: r.createdAt,
    }));
  }

  /** Get the install URL for a specific GitHub App. */
  async function getInstallUrl(appId: string): Promise<string | null> {
    const app = await getAppById(appId);
    if (!app) return null;
    return `https://github.com/apps/${app.githubAppSlug}/installations/new`;
  }

  /** Handle a webhook event from GitHub. */
  async function handleWebhook(
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    // Determine which app this webhook belongs to by matching the installation's app_id
    const installation = payload.installation as { app_id?: number } | undefined;
    let appDbId: string | null = null;

    if (installation?.app_id) {
      const apps = await getApps();
      const matchingApp = apps.find((a) => a.githubAppId === installation.app_id);
      if (matchingApp) {
        appDbId = matchingApp.id;
      }
    }

    if (!appDbId) {
      // Fallback: try to find any configured app
      const apps = await getApps();
      if (apps.length === 0) {
        logger.warn("Received GitHub webhook but no app is configured");
        return;
      }
      appDbId = apps[0]!.id;
    }

    if (event === "installation") {
      await handleInstallationEvent(appDbId, payload);
    } else if (event === "installation_repositories") {
      logger.info(
        { action: payload.action },
        "Received installation_repositories webhook",
      );
    } else {
      logger.debug({ event }, "Ignoring unhandled GitHub webhook event");
    }
  }

  async function handleInstallationEvent(
    appDbId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const action = payload.action as string;
    const installation = payload.installation as {
      id: number;
      account: { login: string; type: string };
      repository_selection: string;
      suspended_at: string | null;
    };

    if (action === "created") {
      const existing = await db
        .select()
        .from(githubAppInstallations)
        .where(eq(githubAppInstallations.installationId, installation.id))
        .then((rows) => rows[0]);

      if (existing) {
        await db
          .update(githubAppInstallations)
          .set({
            accountLogin: installation.account.login,
            accountType: installation.account.type,
            repositorySelection: installation.repository_selection,
            suspendedAt: installation.suspended_at
              ? new Date(installation.suspended_at)
              : null,
            updatedAt: new Date(),
          })
          .where(eq(githubAppInstallations.id, existing.id));
      } else {
        await db.insert(githubAppInstallations).values({
          githubAppId: appDbId,
          installationId: installation.id,
          accountLogin: installation.account.login,
          accountType: installation.account.type,
          repositorySelection: installation.repository_selection,
          suspendedAt: installation.suspended_at
            ? new Date(installation.suspended_at)
            : null,
        });
      }
      logger.info(
        { installationId: installation.id, account: installation.account.login },
        "GitHub App installed",
      );
    } else if (action === "deleted") {
      await db
        .delete(githubAppInstallations)
        .where(eq(githubAppInstallations.installationId, installation.id));
      tokenCache.delete(installation.id);
      logger.info(
        { installationId: installation.id },
        "GitHub App installation removed",
      );
    } else if (action === "suspend") {
      await db
        .update(githubAppInstallations)
        .set({ suspendedAt: new Date(), updatedAt: new Date() })
        .where(eq(githubAppInstallations.installationId, installation.id));
      tokenCache.delete(installation.id);
      logger.info(
        { installationId: installation.id },
        "GitHub App installation suspended",
      );
    } else if (action === "unsuspend") {
      await db
        .update(githubAppInstallations)
        .set({ suspendedAt: null, updatedAt: new Date() })
        .where(eq(githubAppInstallations.installationId, installation.id));
      logger.info(
        { installationId: installation.id },
        "GitHub App installation unsuspended",
      );
    }
  }

  /** Sync installations for a specific app from GitHub API. */
  async function syncAppInstallations(appId: string): Promise<void> {
    const app = await getAppById(appId);
    if (!app) return;

    const privateKey = decrypt(app.privateKeyEncrypted);
    const jwt = generateJwt(app.githubAppId, privateKey);

    const res = await githubFetch(`${GITHUB_API}/app/installations`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (!res.ok) {
      logger.error({ status: res.status, appId }, "Failed to list installations from GitHub");
      return;
    }

    const installations = (await res.json()) as Array<{
      id: number;
      account: { login: string; type: string };
      repository_selection: string;
      suspended_at: string | null;
    }>;

    for (const inst of installations) {
      const existing = await db
        .select()
        .from(githubAppInstallations)
        .where(eq(githubAppInstallations.installationId, inst.id))
        .then((rows) => rows[0]);

      if (existing) {
        await db
          .update(githubAppInstallations)
          .set({
            accountLogin: inst.account.login,
            accountType: inst.account.type,
            repositorySelection: inst.repository_selection,
            suspendedAt: inst.suspended_at ? new Date(inst.suspended_at) : null,
            updatedAt: new Date(),
          })
          .where(eq(githubAppInstallations.id, existing.id));
      } else {
        await db.insert(githubAppInstallations).values({
          githubAppId: app.id,
          installationId: inst.id,
          accountLogin: inst.account.login,
          accountType: inst.account.type,
          repositorySelection: inst.repository_selection,
          suspendedAt: inst.suspended_at ? new Date(inst.suspended_at) : null,
        });
      }
    }

    // Remove installations that no longer exist on GitHub
    const existingRows = await db
      .select()
      .from(githubAppInstallations)
      .where(eq(githubAppInstallations.githubAppId, app.id));
    const remoteIds = new Set(installations.map((i) => i.id));
    for (const row of existingRows) {
      if (!remoteIds.has(row.installationId)) {
        await db
          .delete(githubAppInstallations)
          .where(eq(githubAppInstallations.id, row.id));
        tokenCache.delete(row.installationId);
      }
    }

    logger.info({ count: installations.length, appId }, "Synced GitHub App installations");
  }

  /** Sync installations for all apps from GitHub API. */
  async function syncInstallations(): Promise<void> {
    const apps = await getApps();
    for (const app of apps) {
      await syncAppInstallations(app.id);
    }
  }

  /** Verify a webhook signature (HMAC SHA-256). Tries each app's webhook secret. */
  async function verifyWebhookSignature(
    rawBody: Buffer,
    signature: string | undefined,
  ): Promise<boolean> {
    if (!signature) return false;
    const apps = await getApps();
    if (apps.length === 0) return false;

    for (const app of apps) {
      const secret = decrypt(app.webhookSecretEncrypted);
      const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
      if (expected.length === signature.length) {
        if (timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Generate installation access tokens for ALL active installations.
   * When companyId is provided, returns company-scoped apps first, then unscoped fallbacks.
   * Company-specific apps take priority: if a company-scoped app covers an org,
   * the unscoped app's token for the same org is skipped.
   */
  async function generateAllInstallationTokens(opts?: {
    companyId?: string;
  }): Promise<InstallationToken[]> {
    const apps = await getApps(opts?.companyId);
    if (apps.length === 0) return [];

    // Sort company-scoped apps first so they take priority
    if (opts?.companyId) {
      apps.sort((a, b) => {
        const aScoped = a.companyId ? 0 : 1;
        const bScoped = b.companyId ? 0 : 1;
        return aScoped - bScoped;
      });
    }

    const results: InstallationToken[] = [];
    const seenAccounts = new Set<string>();

    for (const app of apps) {
      const installations = await db
        .select()
        .from(githubAppInstallations)
        .where(eq(githubAppInstallations.githubAppId, app.id));
      const active = installations.filter((i) => !i.suspendedAt);

      for (const inst of active) {
        // Skip if a higher-priority app already covers this account
        if (seenAccounts.has(inst.accountLogin.toLowerCase())) continue;

        const token = await generateTokenForInstallation(app, inst.installationId);
        if (token) {
          results.push({
            token,
            accountLogin: inst.accountLogin,
            installationId: inst.installationId,
          });
          seenAccounts.add(inst.accountLogin.toLowerCase());
        }
      }
    }

    return results;
  }

  /**
   * Generate an installation access token for agent use.
   * Backwards-compatible: returns the first token from generateAllInstallationTokens().
   */
  async function generateInstallationToken(opts?: {
    installationId?: number;
    companyId?: string;
  }): Promise<string | null> {
    if (opts?.installationId) {
      // Find which app owns this installation
      const instRow = await db
        .select()
        .from(githubAppInstallations)
        .where(eq(githubAppInstallations.installationId, opts.installationId))
        .then((rows) => rows[0]);
      if (!instRow) return null;

      const app = await getAppById(instRow.githubAppId);
      if (!app) return null;

      return generateTokenForInstallation(app, opts.installationId);
    }

    const tokens = await generateAllInstallationTokens({ companyId: opts?.companyId });
    if (tokens.length === 0) {
      logger.warn("GitHub Apps configured but no active installations found");
      return null;
    }
    return tokens[0]!.token;
  }

  async function generateTokenForInstallation(
    app: typeof githubApps.$inferSelect,
    installationId: number,
  ): Promise<string | null> {
    // Check cache first
    const cached = getCachedToken(installationId);
    if (cached) return cached;

    // Generate JWT and request installation token
    const privateKey = decrypt(app.privateKeyEncrypted);
    const jwt = generateJwt(app.githubAppId, privateKey);

    const res = await githubFetch(
      `${GITHUB_API}/app/installations/${installationId}/access_tokens`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${jwt}` },
      },
    );

    if (!res.ok) {
      const text = await res.text();
      logger.error(
        { status: res.status, body: text, installationId },
        "Failed to generate installation access token",
      );
      return null;
    }

    const data = (await res.json()) as { token: string; expires_at: string };
    setCachedToken(installationId, data.token, data.expires_at);

    logger.debug(
      { installationId },
      "Generated GitHub installation access token",
    );
    return data.token;
  }

  /** Check if a GitHub App is configured with active installations. */
  async function isConfigured(): Promise<boolean> {
    const status = await getStatus();
    return status.configured && status.apps.some((a) => a.installationCount > 0);
  }

  return {
    getAppConfig,
    getStatus,
    generateManifest,
    exchangeCode,
    deleteApp,
    listInstallations,
    getInstallUrl,
    handleWebhook,
    syncInstallations,
    syncAppInstallations,
    verifyWebhookSignature,
    generateInstallationToken,
    generateAllInstallationTokens,
    isConfigured,
  };
}

export type GitHubAppServiceInstance = ReturnType<typeof githubAppService>;
