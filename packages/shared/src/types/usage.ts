export interface TokenBreakdown {
  systemPrompt: number;
  skillsTools: number;
  issueContext: number;
  fileContent: number;
  history: number;
}

export interface UsageJsonExtended {
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  costUsd?: number;
  billingType?: string;
  breakdown?: TokenBreakdown | null;
  contextWindowSize?: number | null;
}
