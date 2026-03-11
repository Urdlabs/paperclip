export interface TokenBreakdown {
  systemPrompt: number;
  skillsTools: number;
  issueContext: number;
  fileContent: number;
  history: number;
}

export interface BudgetInfo {
  maxTokens: number | null;
  source: "run" | "agent" | "project" | "none";
  usedTokens: number;
  windDownThreshold: number;
  windDownTriggered: boolean;
}

export interface UsageJsonExtended {
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  costUsd?: number;
  billingType?: string;
  breakdown?: TokenBreakdown | null;
  contextWindowSize?: number | null;
  budgetInfo?: BudgetInfo | null;
  compressionRatio?: number | null;
  taskType?: string | null;
}
