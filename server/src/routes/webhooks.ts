import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { createWebhookEndpointSchema, updateWebhookEndpointSchema } from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { webhookService } from "../services/webhooks.js";
import { logActivity } from "../services/activity-log.js";
import { assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";
import { notFound } from "../errors.js";

export function webhookRoutes(db: Db) {
  const router = Router();
  const svc = webhookService(db);

  // Create webhook endpoint
  router.post(
    "/companies/:companyId/webhooks",
    validate(createWebhookEndpointSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertBoard(req);
      assertCompanyAccess(req, companyId);

      const endpoint = await svc.create(companyId, req.body);

      const actor = getActorInfo(req);
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        action: "webhook.endpoint.created",
        entityType: "webhook_endpoint",
        entityId: endpoint.id,
        details: { url: endpoint.url, eventTypes: endpoint.eventTypes },
      });

      res.status(201).json(endpoint);
    },
  );

  // List webhook endpoints
  router.get("/companies/:companyId/webhooks", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertBoard(req);
    assertCompanyAccess(req, companyId);

    const endpoints = await svc.list(companyId);
    res.json(endpoints);
  });

  // Get single webhook endpoint
  router.get("/companies/:companyId/webhooks/:webhookId", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertBoard(req);
    assertCompanyAccess(req, companyId);

    const endpoint = await svc.getById(req.params.webhookId as string);
    if (!endpoint || endpoint.companyId !== companyId) {
      throw notFound("Webhook endpoint not found");
    }
    res.json(endpoint);
  });

  // Update webhook endpoint
  router.patch(
    "/companies/:companyId/webhooks/:webhookId",
    validate(updateWebhookEndpointSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertBoard(req);
      assertCompanyAccess(req, companyId);

      const existing = await svc.getById(req.params.webhookId as string);
      if (!existing || existing.companyId !== companyId) {
        throw notFound("Webhook endpoint not found");
      }

      const updated = await svc.update(req.params.webhookId as string, req.body);

      const actor = getActorInfo(req);
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        action: "webhook.endpoint.updated",
        entityType: "webhook_endpoint",
        entityId: req.params.webhookId as string,
        details: req.body,
      });

      res.json(updated);
    },
  );

  // Delete webhook endpoint
  router.delete("/companies/:companyId/webhooks/:webhookId", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertBoard(req);
    assertCompanyAccess(req, companyId);

    const existing = await svc.getById(req.params.webhookId as string);
    if (!existing || existing.companyId !== companyId) {
      throw notFound("Webhook endpoint not found");
    }

    await svc.remove(req.params.webhookId as string);

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      action: "webhook.endpoint.deleted",
      entityType: "webhook_endpoint",
      entityId: req.params.webhookId as string,
      details: { url: existing.url },
    });

    res.status(204).end();
  });

  // List deliveries for endpoint
  router.get("/companies/:companyId/webhooks/:webhookId/deliveries", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertBoard(req);
    assertCompanyAccess(req, companyId);

    const existing = await svc.getById(req.params.webhookId as string);
    if (!existing || existing.companyId !== companyId) {
      throw notFound("Webhook endpoint not found");
    }

    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;

    const deliveries = await svc.listDeliveries(req.params.webhookId as string, {
      limit,
      offset,
    });
    res.json(deliveries);
  });

  // Test webhook endpoint
  router.post("/companies/:companyId/webhooks/:webhookId/test", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertBoard(req);
    assertCompanyAccess(req, companyId);

    const existing = await svc.getById(req.params.webhookId as string);
    if (!existing || existing.companyId !== companyId) {
      throw notFound("Webhook endpoint not found");
    }

    const testPayload = {
      type: "webhook.test" as const,
      timestamp: new Date().toISOString(),
      data: { message: "This is a test webhook delivery" },
    };

    const delivery = await svc.createDelivery(
      req.params.webhookId as string,
      companyId,
      "webhook.test",
      testPayload,
    );

    const result = await svc.attemptDelivery(delivery.id);

    res.json({
      deliveryId: delivery.id,
      success: result?.success ?? false,
      responseStatus: result?.responseStatus ?? null,
    });
  });

  return router;
}
