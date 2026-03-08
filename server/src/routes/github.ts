import { Router, raw as expressRaw } from "express";
import type { Request, Response } from "express";
import type { Db } from "@paperclipai/db";
import { forbidden, unauthorized, badRequest, notFound } from "../errors.js";
import { githubAppService } from "../services/github-app.js";
import { logger as rootLogger } from "../middleware/logger.js";

const logger = rootLogger.child({ route: "github" });

function resolvePublicUrl(): string | null {
  return (
    process.env.PAPERCLIP_PUBLIC_URL?.trim() ||
    process.env.PAPERCLIP_AUTH_PUBLIC_BASE_URL?.trim() ||
    process.env.BETTER_AUTH_URL?.trim() ||
    null
  );
}

function requireInstanceAdmin(req: Request): void {
  if (req.actor.type !== "board") throw unauthorized();
  if (!req.actor.isInstanceAdmin) throw forbidden("Instance admin required");
}

function requireBoard(req: Request): void {
  if (req.actor.type !== "board") throw unauthorized();
}

/**
 * GitHub webhook route. Must be mounted BEFORE express.json() middleware
 * because it needs the raw request body for HMAC signature verification.
 * Mount at: app.use("/api", githubWebhookRoute(db))
 */
export function githubWebhookRoute(db: Db) {
  const router = Router();
  const svc = githubAppService(db);

  router.post(
    "/github/webhook",
    expressRaw({ type: "application/json" }),
    async (req: Request, res: Response) => {
      const signature = req.headers["x-hub-signature-256"] as string | undefined;
      const event = req.headers["x-github-event"] as string | undefined;

      if (!event) {
        res.status(400).json({ error: "Missing X-GitHub-Event header" });
        return;
      }

      const rawBody = req.body as Buffer;
      const valid = await svc.verifyWebhookSignature(rawBody, signature);
      if (!valid) {
        logger.warn("GitHub webhook signature verification failed");
        res.status(401).json({ error: "Invalid signature" });
        return;
      }

      const payload = JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>;
      await svc.handleWebhook(event, payload);
      res.json({ ok: true });
    },
  );

  return router;
}

/**
 * GitHub API routes (all except webhook).
 * Mount under /api like other routes: api.use(githubRoutes(db))
 */
export function githubRoutes(db: Db) {
  const router = Router();
  const svc = githubAppService(db);

  // GET /github/manifest — generate the GitHub App manifest
  router.get("/github/manifest", async (req: Request, res: Response) => {
    requireInstanceAdmin(req);
    const publicUrl = resolvePublicUrl();
    if (!publicUrl) {
      throw badRequest(
        "PAPERCLIP_PUBLIC_URL is not set. It is required to create a GitHub App manifest.",
      );
    }
    const org = (req.query.org as string | undefined)?.trim();
    const companyId = (req.query.companyId as string | undefined)?.trim();
    const manifest = svc.generateManifest(publicUrl, companyId);
    const redirectUrl = org
      ? `https://github.com/organizations/${encodeURIComponent(org)}/settings/apps/new`
      : "https://github.com/settings/apps/new";
    res.json({ manifest, redirectUrl });
  });

  // GET /github/callback?code=<code> — exchange code for app credentials
  router.get("/github/callback", async (req: Request, res: Response) => {
    requireInstanceAdmin(req);
    const code = req.query.code as string | undefined;
    if (!code) throw badRequest("Missing code parameter");
    const companyId = (req.query.companyId as string | undefined)?.trim();

    let result: { githubAppSlug: string };
    try {
      result = await svc.exchangeCode(code, companyId);
    } catch (err) {
      logger.error({ err }, "Failed to exchange GitHub App manifest code");
      const publicUrl = resolvePublicUrl() ?? "";
      res.redirect(`${publicUrl}/github/setup-complete?error=exchange_failed`);
      return;
    }

    // Redirect directly to repository installation on GitHub
    res.redirect(`https://github.com/apps/${result.githubAppSlug}/installations/new`);
  });

  // DELETE /github/app/:id — remove a specific GitHub App config
  router.delete("/github/app/:id", async (req: Request, res: Response) => {
    requireInstanceAdmin(req);
    const appId = req.params.id as string;
    await svc.deleteApp(appId);
    res.json({ ok: true });
  });

  // GET /github/installations — list all installations (flat, across all apps)
  router.get("/github/installations", async (req: Request, res: Response) => {
    requireBoard(req);
    const installations = await svc.listInstallations();
    res.json({ installations });
  });

  // POST /github/installations/:id/sync — sync a specific app's installations
  router.post("/github/installations/:id/sync", async (req: Request, res: Response) => {
    requireInstanceAdmin(req);
    const appId = req.params.id as string;
    await svc.syncAppInstallations(appId);
    const installations = await svc.listInstallations();
    res.json({ installations });
  });

  // GET /github/install-url/:id — get URL to install a specific app on repos
  router.get("/github/install-url/:id", async (req: Request, res: Response) => {
    requireBoard(req);
    const appId = req.params.id as string;
    const url = await svc.getInstallUrl(appId);
    if (!url) throw notFound("No GitHub App found with that ID");
    res.json({ url });
  });

  // GET /github/status — check if GitHub Apps are configured (returns all apps)
  router.get("/github/status", async (req: Request, res: Response) => {
    requireBoard(req);
    const companyId = (req.query.companyId as string | undefined)?.trim();
    const status = await svc.getStatus(companyId);
    res.json(status);
  });

  return router;
}
