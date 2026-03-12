/**
 * Format an ISO date string to "Mon DD" display format (e.g., "Mar 1").
 */
export function formatChartDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Format a token count for chart display.
 * <1000: as-is, <1M: "X.XK", >=1M: "X.XM"
 */
export function formatTokenCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

/**
 * Format cents to dollar string "$X.XX".
 */
export function formatCostCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
