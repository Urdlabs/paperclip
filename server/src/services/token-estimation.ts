import type { TokenBreakdown } from "@paperclipai/shared";

/**
 * Estimate token count using ~4 chars/token heuristic.
 * Returns 0 for empty string.
 */
export function estimateTokens(text: string): number {
  if (text.length === 0) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Estimate token breakdown for prompt components.
 * Called before adapter.execute() to produce a breakdown stored in usageJson.
 */
export function estimatePromptBreakdown(params: {
  promptTemplate: string;
  instructionsContent: string | null;
  contextSnapshot: Record<string, unknown> | null;
  sessionResuming: boolean;
}): TokenBreakdown {
  return {
    systemPrompt: estimateTokens(params.promptTemplate),
    skillsTools: estimateTokens(params.instructionsContent ?? ""),
    issueContext: estimateTokens(JSON.stringify(params.contextSnapshot ?? {})),
    fileContent: 0, // Unknown pre-execution (per research open question 1)
    history: 0, // Unknown when resuming (per research open question 2)
  };
}

/**
 * Compute context window utilization as a percentage (0-100), clamped.
 */
export function computeContextUtilization(totalEstimatedTokens: number, contextWindowSize: number): number {
  if (contextWindowSize <= 0) return 0;
  const pct = (totalEstimatedTokens / contextWindowSize) * 100;
  return Math.min(100, Math.max(0, Math.round(pct)));
}
