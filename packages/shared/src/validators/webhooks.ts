import { z } from "zod";
import { WEBHOOK_EVENT_TYPES } from "../constants.js";

export const createWebhookEndpointSchema = z.object({
  url: z.string().url(),
  description: z.string().optional(),
  eventTypes: z.array(z.enum(WEBHOOK_EVENT_TYPES)).min(1),
});
export type CreateWebhookEndpoint = z.infer<typeof createWebhookEndpointSchema>;

export const updateWebhookEndpointSchema = z.object({
  url: z.string().url().optional(),
  description: z.string().nullable().optional(),
  eventTypes: z.array(z.enum(WEBHOOK_EVENT_TYPES)).min(1).optional(),
  enabled: z.boolean().optional(),
});
export type UpdateWebhookEndpoint = z.infer<typeof updateWebhookEndpointSchema>;
