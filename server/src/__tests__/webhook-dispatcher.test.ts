import { describe, expect, it } from "vitest";
import { mapLiveEventToWebhookEvent } from "../services/webhook-dispatcher.js";
import type { LiveEvent } from "@paperclipai/shared";

function makeLiveEvent(overrides: Partial<LiveEvent> & { type: LiveEvent["type"]; payload?: Record<string, unknown> }): LiveEvent {
  return {
    id: 1,
    companyId: "company-1",
    createdAt: new Date().toISOString(),
    payload: {},
    ...overrides,
  };
}

describe("mapLiveEventToWebhookEvent", () => {
  it('maps heartbeat.run.status with status "running" to "run.started"', () => {
    const event = makeLiveEvent({
      type: "heartbeat.run.status",
      payload: { status: "running" },
    });
    expect(mapLiveEventToWebhookEvent(event)).toBe("run.started");
  });

  it('maps heartbeat.run.status with status "succeeded" to "run.completed"', () => {
    const event = makeLiveEvent({
      type: "heartbeat.run.status",
      payload: { status: "succeeded" },
    });
    expect(mapLiveEventToWebhookEvent(event)).toBe("run.completed");
  });

  it('maps heartbeat.run.status with status "failed" to "run.failed"', () => {
    const event = makeLiveEvent({
      type: "heartbeat.run.status",
      payload: { status: "failed" },
    });
    expect(mapLiveEventToWebhookEvent(event)).toBe("run.failed");
  });

  it('maps heartbeat.run.status with status "timed_out" to "run.failed"', () => {
    const event = makeLiveEvent({
      type: "heartbeat.run.status",
      payload: { status: "timed_out" },
    });
    expect(mapLiveEventToWebhookEvent(event)).toBe("run.failed");
  });

  it('maps activity.logged with action "issue.created" to "issue.created"', () => {
    const event = makeLiveEvent({
      type: "activity.logged",
      payload: { action: "issue.created" },
    });
    expect(mapLiveEventToWebhookEvent(event)).toBe("issue.created");
  });

  it('maps activity.logged with action containing "issue.updated" to "issue.updated"', () => {
    const event = makeLiveEvent({
      type: "activity.logged",
      payload: { action: "issue.updated" },
    });
    expect(mapLiveEventToWebhookEvent(event)).toBe("issue.updated");
  });

  it('maps activity.logged with action containing "issue.status" to "issue.updated"', () => {
    const event = makeLiveEvent({
      type: "activity.logged",
      payload: { action: "issue.status.changed" },
    });
    expect(mapLiveEventToWebhookEvent(event)).toBe("issue.updated");
  });

  it('maps activity.logged with action containing "approval" to "approval.requested"', () => {
    const event = makeLiveEvent({
      type: "activity.logged",
      payload: { action: "approval.created" },
    });
    expect(mapLiveEventToWebhookEvent(event)).toBe("approval.requested");
  });

  it("returns null for unmapped event types", () => {
    const event = makeLiveEvent({
      type: "heartbeat.run.log",
      payload: {},
    });
    expect(mapLiveEventToWebhookEvent(event)).toBeNull();
  });

  it("returns null for heartbeat.run.status with queued status", () => {
    const event = makeLiveEvent({
      type: "heartbeat.run.status",
      payload: { status: "queued" },
    });
    expect(mapLiveEventToWebhookEvent(event)).toBeNull();
  });

  it("returns null for activity.logged with unrelated action", () => {
    const event = makeLiveEvent({
      type: "activity.logged",
      payload: { action: "agent.started" },
    });
    expect(mapLiveEventToWebhookEvent(event)).toBeNull();
  });
});
