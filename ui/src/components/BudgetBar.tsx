import { formatTokens, cn } from "@/lib/utils";

interface BudgetBarProps {
  usedTokens: number;
  budgetTokens: number | null;
  className?: string;
}

export function BudgetBar({ usedTokens, budgetTokens, className }: BudgetBarProps) {
  if (budgetTokens == null) {
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>
        {formatTokens(usedTokens)} tokens (no budget)
      </span>
    );
  }

  const pct = budgetTokens > 0
    ? Math.min(100, (usedTokens / budgetTokens) * 100)
    : 0;

  const barColor =
    pct > 95
      ? "bg-red-400"
      : pct > 80
        ? "bg-yellow-400"
        : "bg-green-400";

  return (
    <div className={cn("space-y-1", className)}>
      <span className="text-xs text-muted-foreground">
        Budget: {pct.toFixed(0)}% ({formatTokens(usedTokens)} / {formatTokens(budgetTokens)})
      </span>
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width,background-color] duration-150 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
