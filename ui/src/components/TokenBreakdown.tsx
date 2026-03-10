import type { TokenBreakdown as TokenBreakdownData } from "@paperclipai/shared";
import { formatTokens, cn } from "@/lib/utils";

interface TokenBreakdownProps {
  breakdown: TokenBreakdownData;
  className?: string;
}

const COMPONENTS: { key: keyof TokenBreakdownData; label: string; color: string }[] = [
  { key: "systemPrompt", label: "System Prompt", color: "bg-[var(--chart-1)]" },
  { key: "skillsTools", label: "Skills & Tools", color: "bg-[var(--chart-2)]" },
  { key: "issueContext", label: "Issue Context", color: "bg-[var(--chart-3)]" },
  { key: "fileContent", label: "File Content", color: "bg-[var(--chart-4)]" },
  { key: "history", label: "History", color: "bg-[var(--chart-5)]" },
];

export function TokenBreakdown({ breakdown, className }: TokenBreakdownProps) {
  const total = Object.values(breakdown).reduce(
    (a, b) => a + (b ?? 0),
    0,
  );

  if (total === 0) {
    return (
      <div className={cn("text-sm text-muted-foreground", className)}>
        No breakdown data available
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {COMPONENTS.map(({ key, label, color }) => {
        const value = breakdown[key] ?? 0;
        const pct = (value / total) * 100;
        return (
          <div key={key} className="space-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-sm">{label}</span>
              <span className="text-xs font-mono text-muted-foreground">
                {formatTokens(value)} ({pct.toFixed(1)}%)
              </span>
            </div>
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${color}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
