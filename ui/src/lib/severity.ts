export const SEVERITY_LEVELS = ["info", "warning", "error"] as const;

export type Severity = (typeof SEVERITY_LEVELS)[number];

/**
 * Derive a severity level from an activity action string.
 *
 * - Error: action contains "failed" or "error"
 * - Warning: action contains "budget", "retry", or "slow"
 * - Info: everything else (default)
 */
export function deriveSeverity(action: string | undefined | null): Severity {
  if (!action) return "info";

  const lower = action.toLowerCase();

  if (lower.includes("failed") || lower.includes("error")) {
    return "error";
  }

  if (lower.includes("budget") || lower.includes("retry") || lower.includes("slow")) {
    return "warning";
  }

  return "info";
}
