import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";
import { existsSync, readFileSync, mkdirSync, writeFileSync, chmodSync } from "node:fs";
import path from "node:path";
import { eq, and, lte, lt, desc } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { webhookEndpoints, webhookDeliveries } from "@paperclipai/db";
import type { WebhookEventType } from "@paperclipai/shared";
import { logger as rootLogger } from "../middleware/logger.js";

const logger = rootLogger.child({ service: "webhooks" });

// ---------------------------------------------------------------------------
// Encryption helpers -- same master-key approach as github-app.ts
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

  const raw = process.env.PAPERCLIP_SECRETS_MASTER_KEY;
  if (raw && raw.trim().length > 0) {
    const decoded = decodeMasterKeyRaw(raw);
    if (decoded) {
      _masterKey = decoded;
      return _masterKey;
    }
  }

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
// Standard Webhooks signing helpers (exported for testing)
// ---------------------------------------------------------------------------

const RETRY_DELAYS = [1_000, 10_000, 60_000, 300_000, 1_800_000];
const MAX_CONSECUTIVE_FAILURES = 5;

export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(32).toString("base64")}`;
}

export function signPayload(
  msgId: string,
  timestamp: number,
  body: string,
  secretBase64: string,
): string {
  const toSign = `${msgId}.${timestamp}.${body}`;
  const key = Buffer.from(secretBase64, "base64");
  const sig = createHmac("sha256", key).update(toSign).digest("base64");
  return `v1,${sig}`;
}

export function buildWebhookHeaders(
  msgId: string,
  body: string,
  secretBase64: string,
): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signPayload(msgId, timestamp, body, secretBase64);
  return {
    "webhook-id": msgId,
    "webhook-timestamp": String(timestamp),
    "webhook-signature": signature,
  };
}

export function getRetryDelay(attemptCount: number): number {
  if (attemptCount >= RETRY_DELAYS.length) {
    return RETRY_DELAYS[RETRY_DELAYS.length - 1]!;
  }
  return RETRY_DELAYS[attemptCount]!;
}

// ---------------------------------------------------------------------------
// Service factory
// ---------------------------------------------------------------------------

export function webhookService(db: Db) {
  // ---- Endpoint CRUD ----

  async function create(
    companyId: string,
    input: { url: string; description?: string; eventTypes: WebhookEventType[] },
  ) {
    const secret = generateWebhookSecret();
    const secretBase64 = secret.replace("whsec_", "");
    const secretEncrypted = encrypt(secret);

    const [endpoint] = await db
      .insert(webhookEndpoints)
      .values({
        companyId,
        url: input.url,
        description: input.description ?? null,
        secretEncrypted,
        eventTypes: input.eventTypes,
      })
      .returning();

    return {
      ...endpoint!,
      // Return the plain secret only on create so operator can store it
      secret,
    };
  }

  async function list(companyId: string) {
    return db
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.companyId, companyId))
      .orderBy(desc(webhookEndpoints.createdAt));
  }

  async function getById(endpointId: string) {
    const rows = await db
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.id, endpointId));
    return rows[0] ?? null;
  }

  async function update(
    endpointId: string,
    input: {
      url?: string;
      description?: string | null;
      eventTypes?: WebhookEventType[];
      enabled?: boolean;
    },
  ) {
    const sets: Record<string, unknown> = { updatedAt: new Date() };
    if (input.url !== undefined) sets.url = input.url;
    if (input.description !== undefined) sets.description = input.description;
    if (input.eventTypes !== undefined) sets.eventTypes = input.eventTypes;
    if (input.enabled !== undefined) {
      sets.enabled = input.enabled;
      if (input.enabled) {
        // Re-enabling resets failure tracking
        sets.consecutiveFailures = 0;
        sets.disabledAt = null;
      }
    }

    const [updated] = await db
      .update(webhookEndpoints)
      .set(sets)
      .where(eq(webhookEndpoints.id, endpointId))
      .returning();

    return updated ?? null;
  }

  async function remove(endpointId: string) {
    await db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, endpointId));
  }

  // ---- Delivery management ----

  async function listDeliveries(
    endpointId: string,
    opts?: { limit?: number; offset?: number },
  ) {
    const limit = opts?.limit ?? 50;
    const offset = opts?.offset ?? 0;
    return db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.endpointId, endpointId))
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async function createDelivery(
    endpointId: string,
    companyId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ) {
    const [delivery] = await db
      .insert(webhookDeliveries)
      .values({
        endpointId,
        companyId,
        eventType,
        payload,
        status: "pending",
        nextAttemptAt: new Date(),
      })
      .returning();

    return delivery!;
  }

  async function attemptDelivery(deliveryId: string) {
    const rows = await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.id, deliveryId));
    const delivery = rows[0];
    if (!delivery) return null;

    const endpointRows = await db
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.id, delivery.endpointId));
    const endpoint = endpointRows[0];
    if (!endpoint) return null;

    // Decrypt the webhook secret
    const secret = decrypt(endpoint.secretEncrypted);
    const secretBase64 = secret.replace("whsec_", "");

    const body = JSON.stringify(delivery.payload);
    const msgId = `msg_${delivery.id}`;
    const headers = buildWebhookHeaders(msgId, body, secretBase64);

    let responseStatus: number | null = null;
    let responseBody: string | null = null;
    let success = false;

    try {
      const res = await fetch(endpoint.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body,
        signal: AbortSignal.timeout(30_000),
      });
      responseStatus = res.status;
      const text = await res.text();
      responseBody = text.slice(0, 4096); // Truncate response
      success = res.status >= 200 && res.status < 300;
    } catch (err) {
      responseBody = err instanceof Error ? err.message : String(err);
    }

    const newAttemptCount = delivery.attemptCount + 1;
    const now = new Date();

    if (success) {
      // Update delivery as succeeded
      await db
        .update(webhookDeliveries)
        .set({
          status: "delivered",
          attemptCount: newAttemptCount,
          lastAttemptAt: now,
          lastResponseStatus: responseStatus,
          lastResponseBody: responseBody,
          nextAttemptAt: null,
          updatedAt: now,
        })
        .where(eq(webhookDeliveries.id, deliveryId));

      // Reset consecutive failures on success
      await db
        .update(webhookEndpoints)
        .set({
          consecutiveFailures: 0,
          updatedAt: now,
        })
        .where(eq(webhookEndpoints.id, endpoint.id));
    } else {
      const exhausted = newAttemptCount >= delivery.maxAttempts;
      const nextAttempt = exhausted
        ? null
        : new Date(now.getTime() + getRetryDelay(newAttemptCount));

      await db
        .update(webhookDeliveries)
        .set({
          status: exhausted ? "failed" : "pending",
          attemptCount: newAttemptCount,
          lastAttemptAt: now,
          lastResponseStatus: responseStatus,
          lastResponseBody: responseBody,
          nextAttemptAt: nextAttempt,
          updatedAt: now,
        })
        .where(eq(webhookDeliveries.id, deliveryId));

      // Increment consecutive failures
      const newFailures = endpoint.consecutiveFailures + 1;
      const shouldDisable = newFailures >= MAX_CONSECUTIVE_FAILURES;

      await db
        .update(webhookEndpoints)
        .set({
          consecutiveFailures: newFailures,
          ...(shouldDisable ? { enabled: false, disabledAt: now } : {}),
          updatedAt: now,
        })
        .where(eq(webhookEndpoints.id, endpoint.id));

      if (shouldDisable) {
        logger.warn(
          { endpointId: endpoint.id, url: endpoint.url, consecutiveFailures: newFailures },
          "Webhook endpoint auto-disabled after consecutive failures",
        );
      }
    }

    return { success, responseStatus, responseBody };
  }

  async function processRetryQueue() {
    const now = new Date();
    const pending = await db
      .select()
      .from(webhookDeliveries)
      .where(
        and(
          eq(webhookDeliveries.status, "pending"),
          lte(webhookDeliveries.nextAttemptAt, now),
          lt(webhookDeliveries.attemptCount, webhookDeliveries.maxAttempts),
        ),
      )
      .orderBy(webhookDeliveries.nextAttemptAt)
      .limit(50);

    for (const delivery of pending) {
      try {
        await attemptDelivery(delivery.id);
      } catch (err) {
        logger.error(
          { deliveryId: delivery.id, err },
          "Error processing webhook delivery retry",
        );
      }
    }

    return pending.length;
  }

  return {
    create,
    list,
    getById,
    update,
    remove,
    listDeliveries,
    createDelivery,
    attemptDelivery,
    processRetryQueue,
  };
}
