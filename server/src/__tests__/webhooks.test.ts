import { describe, expect, it } from "vitest";
import {
  generateWebhookSecret,
  signPayload,
  buildWebhookHeaders,
  getRetryDelay,
} from "../services/webhooks.js";
import { WEBHOOK_EVENT_TYPES } from "@paperclipai/shared";
import { createHmac } from "node:crypto";

describe("WEBHOOK_EVENT_TYPES constant", () => {
  it("includes all 6 required event types", () => {
    expect(WEBHOOK_EVENT_TYPES).toContain("run.completed");
    expect(WEBHOOK_EVENT_TYPES).toContain("run.failed");
    expect(WEBHOOK_EVENT_TYPES).toContain("run.started");
    expect(WEBHOOK_EVENT_TYPES).toContain("approval.requested");
    expect(WEBHOOK_EVENT_TYPES).toContain("issue.created");
    expect(WEBHOOK_EVENT_TYPES).toContain("issue.updated");
    expect(WEBHOOK_EVENT_TYPES).toHaveLength(6);
  });
});

describe("generateWebhookSecret", () => {
  it("returns a secret with whsec_ prefix and base64-encoded random bytes", () => {
    const secret = generateWebhookSecret();
    expect(secret).toMatch(/^whsec_[A-Za-z0-9+/=]+$/);
    // Decode and verify it is 32 bytes
    const decoded = Buffer.from(secret.replace("whsec_", ""), "base64");
    expect(decoded.length).toBe(32);
  });

  it("generates unique secrets each time", () => {
    const a = generateWebhookSecret();
    const b = generateWebhookSecret();
    expect(a).not.toBe(b);
  });
});

describe("signPayload", () => {
  it("produces correct HMAC-SHA256 signature per Standard Webhooks spec", () => {
    const msgId = "msg_test123";
    const timestamp = 1700000000;
    const body = '{"type":"run.completed","data":{}}';
    const secretBase64 = Buffer.from("test-secret-key-32-bytes-long!!!", "utf8").toString("base64");

    const signature = signPayload(msgId, timestamp, body, secretBase64);

    // Verify manually: sign "msgId.timestamp.body" with decoded secret
    const toSign = `${msgId}.${timestamp}.${body}`;
    const expected = createHmac("sha256", Buffer.from(secretBase64, "base64"))
      .update(toSign)
      .digest("base64");

    expect(signature).toBe(`v1,${expected}`);
  });
});

describe("buildWebhookHeaders", () => {
  it("returns webhook-id, webhook-timestamp, webhook-signature headers", () => {
    const msgId = "msg_abc";
    const body = '{"test":true}';
    const secretBase64 = Buffer.from("test-secret-key-32-bytes-long!!!", "utf8").toString("base64");

    const headers = buildWebhookHeaders(msgId, body, secretBase64);

    expect(headers).toHaveProperty("webhook-id", msgId);
    expect(headers).toHaveProperty("webhook-timestamp");
    expect(typeof headers["webhook-timestamp"]).toBe("string");
    expect(headers).toHaveProperty("webhook-signature");
    expect(headers["webhook-signature"]).toMatch(/^v1,/);
  });
});

describe("getRetryDelay", () => {
  it("returns [1000, 10000, 60000, 300000, 1800000] for attempts 0-4", () => {
    expect(getRetryDelay(0)).toBe(1000);
    expect(getRetryDelay(1)).toBe(10000);
    expect(getRetryDelay(2)).toBe(60000);
    expect(getRetryDelay(3)).toBe(300000);
    expect(getRetryDelay(4)).toBe(1800000);
  });

  it("returns the last delay for attempts beyond the array", () => {
    expect(getRetryDelay(5)).toBe(1800000);
    expect(getRetryDelay(10)).toBe(1800000);
  });
});
