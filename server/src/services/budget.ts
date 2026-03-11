/**
 * Token budget resolution service.
 *
 * Resolves budget from a three-tier hierarchy: per-run override > per-agent
 * default > per-project default. Provides threshold checks for wind-down
 * detection and budget enforcement.
 */

export interface BudgetConfig {
  maxTokens: number | null;
  source: "run" | "agent" | "project" | "none";
  windDownThreshold: number;
}

interface ResolveBudgetParams {
  runOverride: number | null;
  agentDefault: number | null;
  projectDefault: number | null;
}

function isValidBudget(value: number | null): value is number {
  return value !== null && value > 0;
}

/**
 * Resolve budget from three-tier hierarchy.
 *
 * Priority: runOverride > agentDefault > projectDefault.
 * Zero and negative values are treated as "not configured" and fall through.
 * Wind-down threshold is always 0.9 (90%).
 */
export function resolveBudget(params: ResolveBudgetParams): BudgetConfig {
  const { runOverride, agentDefault, projectDefault } = params;

  if (isValidBudget(runOverride)) {
    return { maxTokens: runOverride, source: "run", windDownThreshold: 0.9 };
  }

  if (isValidBudget(agentDefault)) {
    return { maxTokens: agentDefault, source: "agent", windDownThreshold: 0.9 };
  }

  if (isValidBudget(projectDefault)) {
    return { maxTokens: projectDefault, source: "project", windDownThreshold: 0.9 };
  }

  return { maxTokens: null, source: "none", windDownThreshold: 0.9 };
}

/**
 * Check if budget has been exceeded.
 * Returns false when no budget is set (maxTokens is null).
 */
export function isBudgetExceeded(budget: BudgetConfig, usedTokens: number): boolean {
  if (budget.maxTokens === null) return false;
  return usedTokens >= budget.maxTokens;
}

/**
 * Check if usage has crossed the wind-down threshold.
 * Returns false when no budget is set (maxTokens is null).
 */
export function isWindDownThreshold(budget: BudgetConfig, usedTokens: number): boolean {
  if (budget.maxTokens === null) return false;
  return usedTokens >= budget.maxTokens * budget.windDownThreshold;
}
