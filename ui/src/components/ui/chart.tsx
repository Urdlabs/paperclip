import * as React from "react";
import { Tooltip as RechartsTooltip } from "recharts";
import type { NameType, Payload, ValueType } from "recharts/types/component/DefaultTooltipContent";

// --- Chart Config ---

export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode;
    icon?: React.ComponentType;
    color?: string;
    theme?: Record<string, string>;
  }
>;

type ChartContextProps = {
  config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />");
  }
  return context;
}

// --- ChartContainer ---

interface ChartContainerProps extends React.ComponentProps<"div"> {
  config: ChartConfig;
  children: React.ReactNode;
}

const ChartContainer = React.forwardRef<HTMLDivElement, ChartContainerProps>(
  ({ config, children, className, ...props }, ref) => {
    const configId = React.useId();

    return (
      <ChartContext.Provider value={{ config }}>
        <div
          ref={ref}
          data-chart={configId}
          className={className}
          {...props}
        >
          <ChartStyle id={configId} config={config} />
          {/* Recharts ResponsiveContainer is built into the chart components in v3 */}
          {children}
        </div>
      </ChartContext.Provider>
    );
  },
);
ChartContainer.displayName = "ChartContainer";

// --- ChartStyle ---

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colorConfig = Object.entries(config).filter(
    ([, cfg]) => cfg.color || cfg.theme,
  );

  if (!colorConfig.length) return null;

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
${colorConfig
  .map(([key, cfg]) => {
    const color = cfg.color || `var(--color-${key})`;
    return `
[data-chart="${id}"] {
  --color-${key}: ${color};
}`;
  })
  .join("\n")}
`,
      }}
    />
  );
}

// --- ChartTooltip ---

const ChartTooltip = RechartsTooltip;

// --- ChartTooltipContent ---

interface ChartTooltipContentProps {
  active?: boolean;
  payload?: Payload<ValueType, NameType>[];
  label?: string;
  labelFormatter?: (label: string, payload: Payload<ValueType, NameType>[]) => React.ReactNode;
  formatter?: (value: ValueType, name: NameType) => React.ReactNode;
  hideLabel?: boolean;
  hideIndicator?: boolean;
  indicator?: "line" | "dot" | "dashed";
  nameKey?: string;
  labelKey?: string;
}

const ChartTooltipContent = React.forwardRef<HTMLDivElement, ChartTooltipContentProps>(
  (
    {
      active,
      payload,
      label,
      labelFormatter,
      formatter,
      hideLabel = false,
      hideIndicator = false,
      indicator = "dot",
      nameKey,
      labelKey,
    },
    ref,
  ) => {
    const { config } = useChart();

    if (!active || !payload?.length) return null;

    return (
      <div
        ref={ref}
        className="rounded-lg border border-border bg-background px-3 py-2 text-xs shadow-md"
      >
        {!hideLabel && (
          <div className="mb-1 font-medium">
            {labelFormatter ? labelFormatter(label ?? "", payload) : label}
          </div>
        )}
        <div className="space-y-0.5">
          {payload.map((item, i) => {
            const key = (nameKey ? item.payload?.[nameKey] : item.dataKey ?? item.name) as string;
            const cfg = config[key];
            const itemLabel = cfg?.label ?? key;
            const color = item.color || cfg?.color || `var(--color-${key})`;

            return (
              <div key={i} className="flex items-center gap-2">
                {!hideIndicator && (
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: color,
                      ...(indicator === "line"
                        ? { borderRadius: 0, height: 2, width: 12 }
                        : indicator === "dashed"
                          ? { borderRadius: 0, height: 2, width: 12, borderTop: "2px dashed", backgroundColor: "transparent", borderColor: color }
                          : {}),
                    }}
                  />
                )}
                <span className="text-muted-foreground">{itemLabel}</span>
                <span className="ml-auto font-mono font-medium tabular-nums">
                  {formatter ? formatter(item.value ?? 0, item.name ?? "") : String(item.value)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  },
);
ChartTooltipContent.displayName = "ChartTooltipContent";

// --- ChartLegend ---

// Re-export Recharts Legend for convenience
export { Legend as ChartLegend } from "recharts";

// --- ChartLegendContent ---

interface ChartLegendContentProps {
  payload?: Array<{
    value: string;
    type?: string;
    color?: string;
    dataKey?: string;
  }>;
  verticalAlign?: "top" | "bottom";
  nameKey?: string;
}

function ChartLegendContent({ payload, nameKey }: ChartLegendContentProps) {
  const { config } = useChart();

  if (!payload?.length) return null;

  return (
    <div className="flex items-center justify-center gap-4 pt-2">
      {payload.map((entry) => {
        const key = (nameKey ? entry.dataKey : entry.value) as string;
        const cfg = config[key];
        const label = cfg?.label ?? key;
        const color = entry.color || cfg?.color || `var(--color-${key})`;

        return (
          <div key={key} className="flex items-center gap-1.5 text-xs">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-muted-foreground">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

export { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegendContent, useChart };
