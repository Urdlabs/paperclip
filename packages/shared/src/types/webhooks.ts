import type { WebhookEventType } from "../constants.js";

export interface WebhookEndpoint {
  id: string;
  companyId: string;
  url: string;
  description: string | null;
  eventTypes: WebhookEventType[];
  enabled: boolean;
  consecutiveFailures: number;
  disabledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDelivery {
  id: string;
  endpointId: string;
  companyId: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: string;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  lastAttemptAt: string | null;
  lastResponseStatus: number | null;
  lastResponseBody: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookPayload {
  type: WebhookEventType;
  timestamp: string;
  data: Record<string, unknown>;
}
