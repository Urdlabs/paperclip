import type { CostSummary, CostByAgent } from "@paperclipai/shared";
import { api } from "./client";

export interface CostByProject {
  projectId: string | null;
  projectName: string | null;
  costCents: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
}

export interface TimeSeriesPoint {
  date: string;
  totalTokens: number;
  costCents: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
}

export interface ContextComposition {
  systemPrompt: number;
  skillsTools: number;
  issueContext: number;
  fileContent: number;
  history: number;
}

function dateParams(from?: string, to?: string): string {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const costsApi = {
  summary: (companyId: string, from?: string, to?: string) =>
    api.get<CostSummary>(`/companies/${companyId}/costs/summary${dateParams(from, to)}`),
  byAgent: (companyId: string, from?: string, to?: string) =>
    api.get<CostByAgent[]>(`/companies/${companyId}/costs/by-agent${dateParams(from, to)}`),
  byProject: (companyId: string, from?: string, to?: string) =>
    api.get<CostByProject[]>(`/companies/${companyId}/costs/by-project${dateParams(from, to)}`),
  timeSeries: (companyId: string, from?: string, to?: string, bucket?: string) => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (bucket) params.set("bucket", bucket);
    const qs = params.toString();
    return api.get<TimeSeriesPoint[]>(`/companies/${companyId}/costs/time-series${qs ? `?${qs}` : ""}`);
  },
  contextComposition: (companyId: string, from?: string, to?: string) =>
    api.get<ContextComposition>(`/companies/${companyId}/costs/context-composition${dateParams(from, to)}`),
};
