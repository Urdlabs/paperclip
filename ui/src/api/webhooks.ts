import { api } from "./client";

export interface WebhookEndpoint {
  id: string;
  companyId: string;
  url: string;
  description: string | null;
  secret: string;
  eventTypes: string[];
  enabled: boolean;
  consecutiveFailures: number;
  disabledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDelivery {
  id: string;
  webhookEndpointId: string;
  companyId: string;
  eventType: string;
  payload: unknown;
  status: "pending" | "succeeded" | "failed" | "disabled";
  attemptCount: number;
  lastResponseStatus: number | null;
  lastResponseBody: string | null;
  nextRetryAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const webhooksApi = {
  list: (companyId: string) =>
    api.get<WebhookEndpoint[]>(`/companies/${companyId}/webhooks`),

  create: (companyId: string, data: { url: string; description?: string; eventTypes: string[] }) =>
    api.post<WebhookEndpoint>(`/companies/${companyId}/webhooks`, data),

  update: (companyId: string, webhookId: string, data: Partial<{ url: string; description: string; eventTypes: string[]; enabled: boolean }>) =>
    api.patch<WebhookEndpoint>(`/companies/${companyId}/webhooks/${webhookId}`, data),

  remove: (companyId: string, webhookId: string) =>
    api.delete<void>(`/companies/${companyId}/webhooks/${webhookId}`),

  listDeliveries: (companyId: string, webhookId: string) =>
    api.get<WebhookDelivery[]>(`/companies/${companyId}/webhooks/${webhookId}/deliveries`),

  testDelivery: (companyId: string, webhookId: string) =>
    api.post<{ deliveryId: string; success: boolean; responseStatus: number | null }>(
      `/companies/${companyId}/webhooks/${webhookId}/test`,
      {},
    ),
};
