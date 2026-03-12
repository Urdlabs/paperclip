import type { Db } from "@paperclipai/db";
import { webhookEndpoints } from "@paperclipai/db";
import { eq, and } from "drizzle-orm";
import type { LiveEvent, WebhookEventType } from "@paperclipai/shared";
import { subscribeCompanyLiveEvents } from "./live-events.js";
import { webhookService } from "./webhooks.js";
import { logActivity } from "./activity-log.js";
import { logger as rootLogger } from "../middleware/logger.js";

const logger = rootLogger.child({ service: "webhook-dispatcher" });

// ---------------------------------------------------------------------------
// Event mapping: internal LiveEvent -> WebhookEventType (or null if no match)
// ---------------------------------------------------------------------------

export function mapLiveEventToWebhookEvent(
  event: LiveEvent,
): WebhookEventType | null {
  const payload = event.payload as Record<string, unknown>;

  if (event.type === "heartbeat.run.status") {
    const status = payload.status as string | undefined;
    switch (status) {
      case "running":
        return "run.started";
      case "succeeded":
        return "run.completed";
      case "failed":
      case "timed_out":
        return "run.failed";
      default:
        return null;
    }
  }

  if (event.type === "activity.logged") {
    const action = (payload.action as string) ?? "";
    if (action === "issue.created") return "issue.created";
    if (action.includes("issue.updated") || action.includes("issue.status")) return "issue.updated";
    if (action.includes("approval")) return "approval.requested";
    return null;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Dispatch: create deliveries for all matching endpoints
// ---------------------------------------------------------------------------

export async function dispatchEvent(
  db: Db,
  companyId: string,
  webhookEventType: WebhookEventType,
  eventData: Record<string, unknown>,
) {
  // Find all enabled endpoints for this company subscribed to this event type
  const endpoints = await db
    .select()
    .from(webhookEndpoints)
    .where(
      and(
        eq(webhookEndpoints.companyId, companyId),
        eq(webhookEndpoints.enabled, true),
      ),
    );

  // Filter by event type subscription (stored as JSONB array)
  const matching = endpoints.filter((ep) => {
    const types = ep.eventTypes as string[];
    return types.includes(webhookEventType);
  });

  if (matching.length === 0) return;

  const svc = webhookService(db);
  const payload = {
    type: webhookEventType,
    timestamp: new Date().toISOString(),
    data: eventData,
  };

  for (const endpoint of matching) {
    try {
      const delivery = await svc.createDelivery(
        endpoint.id,
        companyId,
        webhookEventType,
        payload,
      );
      // Attempt immediate delivery
      await svc.attemptDelivery(delivery.id);
    } catch (err) {
      logger.error(
        { endpointId: endpoint.id, eventType: webhookEventType, err },
        "Failed to dispatch webhook delivery",
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Start dispatcher: subscribe to live events + start retry queue
// ---------------------------------------------------------------------------

export function startWebhookDispatcher(db: Db) {
  const unsubscribers: (() => void)[] = [];
  const subscribedCompanies = new Set<string>();

  async function subscribeCompany(companyId: string) {
    if (subscribedCompanies.has(companyId)) return;
    subscribedCompanies.add(companyId);

    const unsub = subscribeCompanyLiveEvents(companyId, (event) => {
      const webhookEventType = mapLiveEventToWebhookEvent(event);
      if (!webhookEventType) return;

      void dispatchEvent(db, event.companyId, webhookEventType, event.payload as Record<string, unknown>).catch(
        (err) => {
          logger.error(
            { companyId: event.companyId, eventType: webhookEventType, err },
            "Webhook dispatch failed",
          );
        },
      );
    });

    unsubscribers.push(unsub);
  }

  // Subscribe to all companies with enabled webhook endpoints
  async function initialize() {
    try {
      const endpoints = await db
        .select({ companyId: webhookEndpoints.companyId })
        .from(webhookEndpoints)
        .where(eq(webhookEndpoints.enabled, true));

      const companyIds = new Set(endpoints.map((e) => e.companyId));
      for (const companyId of companyIds) {
        await subscribeCompany(companyId);
      }

      logger.info(
        { companyCount: companyIds.size },
        "Webhook dispatcher initialized",
      );
    } catch (err) {
      logger.error({ err }, "Failed to initialize webhook dispatcher");
    }
  }

  void initialize();

  // Start retry queue interval (every 5 seconds)
  const svc = webhookService(db);
  const retryInterval = setInterval(() => {
    void svc.processRetryQueue().catch((err) => {
      logger.error({ err }, "Webhook retry queue processing failed");
    });
  }, 5_000);

  // Return cleanup function
  return () => {
    clearInterval(retryInterval);
    for (const unsub of unsubscribers) {
      unsub();
    }
    subscribedCompanies.clear();
  };
}
