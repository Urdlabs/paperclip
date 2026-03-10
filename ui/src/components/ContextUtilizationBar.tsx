import { formatTokens, cn } from "@/lib/utils";

interface ContextUtilizationBarProps {
  usedTokens: number;
  contextWindowSize: number;
  className?: string;
}

export function ContextUtilizationBar({
  usedTokens,
  contextWindowSize,
  className,
}: ContextUtilizationBarProps) {
  const pct = contextWindowSize > 0
    ? Math.min(100, (usedTokens / contextWindowSize) * 100)
    : 0;

  const barColor =
    pct > 85
      ? "bg-red-400"
      : pct > 60
        ? "bg-yellow-400"
        : "bg-green-400";

  return (
    <div className={cn("space-y-1", className)}>
      <span className="text-xs text-muted-foreground">
        Context: {pct.toFixed(0)}% used ({formatTokens(usedTokens)} / {formatTokens(contextWindowSize)} tokens)
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
