import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { costsApi } from "../api/costs";
import { queryKeys } from "../lib/queryKeys";
import { formatChartDate, formatTokenCount, formatCostCents } from "../lib/chart-utils";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import type { ChartConfig } from "@/components/ui/chart";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface AnalyticsChartsProps {
  companyId: string;
  from: string;
  to: string;
}

// --- Chart configs ---

const tokenLineConfig: ChartConfig = {
  inputTokens: {
    label: "Input Tokens",
    color: "var(--color-chart-1)",
  },
  outputTokens: {
    label: "Output Tokens",
    color: "var(--color-chart-2)",
  },
};

const agentBarConfig: ChartConfig = {
  costCents: {
    label: "Cost",
    color: "var(--color-chart-3)",
  },
};

const projectBarConfig: ChartConfig = {
  costCents: {
    label: "Cost",
    color: "var(--color-chart-4)",
  },
};

const compositionConfig: ChartConfig = {
  systemPrompt: { label: "System Prompt", color: "var(--color-chart-1)" },
  skillsTools: { label: "Skills & Tools", color: "var(--color-chart-2)" },
  issueContext: { label: "Issue Context", color: "var(--color-chart-3)" },
  fileContent: { label: "File Content", color: "var(--color-chart-4)" },
  history: { label: "History", color: "var(--color-chart-5)" },
};

const COMPOSITION_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

// --- Loading / Error helpers ---

function ChartSkeleton() {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-[250px] w-full" />
      </CardContent>
    </Card>
  );
}

function ChartError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card>
      <CardContent className="p-4 flex flex-col items-center justify-center h-[300px] gap-3">
        <AlertCircle className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

// --- Main component ---

export function AnalyticsCharts({ companyId, from, to }: AnalyticsChartsProps) {
  // Determine bucket: day for <=90 days, week for longer
  const daysDiff = from && to
    ? Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24))
    : 30;
  const bucket = daysDiff > 90 ? "week" : "day";

  const timeSeriesQuery = useQuery({
    queryKey: queryKeys.costsTimeSeries(companyId, from || undefined, to || undefined, bucket),
    queryFn: () => costsApi.timeSeries(companyId, from || undefined, to || undefined, bucket),
    enabled: !!companyId,
  });

  const byAgentQuery = useQuery({
    queryKey: [...queryKeys.costs(companyId, from || undefined, to || undefined), "by-agent"],
    queryFn: () => costsApi.byAgent(companyId, from || undefined, to || undefined),
    enabled: !!companyId,
  });

  const byProjectQuery = useQuery({
    queryKey: [...queryKeys.costs(companyId, from || undefined, to || undefined), "by-project"],
    queryFn: () => costsApi.byProject(companyId, from || undefined, to || undefined),
    enabled: !!companyId,
  });

  const compositionQuery = useQuery({
    queryKey: queryKeys.costsContextComposition(companyId, from || undefined, to || undefined),
    queryFn: () => costsApi.contextComposition(companyId, from || undefined, to || undefined),
    enabled: !!companyId,
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Chart 1: Token Usage Over Time */}
      {timeSeriesQuery.isLoading ? (
        <ChartSkeleton />
      ) : timeSeriesQuery.error ? (
        <ChartError message="Failed to load time series data" onRetry={() => timeSeriesQuery.refetch()} />
      ) : (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3">Token Usage Over Time</h3>
            <ChartContainer config={tokenLineConfig} className="h-[300px] w-full">
              <LineChart data={timeSeriesQuery.data ?? []} accessibilityLayer>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatChartDate}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={formatTokenCount}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={60}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(label) => formatChartDate(label)}
                      formatter={(value) => formatTokenCount(Number(value))}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Line
                  type="monotone"
                  dataKey="inputTokens"
                  stroke="var(--color-chart-1)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="outputTokens"
                  stroke="var(--color-chart-2)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Chart 2: Cost Per Agent */}
      {byAgentQuery.isLoading ? (
        <ChartSkeleton />
      ) : byAgentQuery.error ? (
        <ChartError message="Failed to load agent cost data" onRetry={() => byAgentQuery.refetch()} />
      ) : (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3">Cost Per Agent</h3>
            {(byAgentQuery.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No agent cost data yet.</p>
            ) : (
              <ChartContainer
                config={agentBarConfig}
                className="w-full"
                style={{ height: `${Math.max(200, Math.min((byAgentQuery.data?.slice(0, 10).length ?? 0) * 40, 400))}px` }}
              >
                <BarChart
                  data={(byAgentQuery.data ?? []).slice(0, 10).map((d) => ({
                    name: d.agentName ?? d.agentId.slice(0, 8),
                    costCents: d.costCents,
                  }))}
                  layout="vertical"
                  accessibilityLayer
                >
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    tickFormatter={formatCostCents}
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    width={100}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => formatCostCents(Number(value))}
                        hideIndicator
                      />
                    }
                  />
                  <Bar dataKey="costCents" fill="var(--color-chart-3)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Chart 3: Cost Per Project */}
      {byProjectQuery.isLoading ? (
        <ChartSkeleton />
      ) : byProjectQuery.error ? (
        <ChartError message="Failed to load project cost data" onRetry={() => byProjectQuery.refetch()} />
      ) : (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3">Cost Per Project</h3>
            {(byProjectQuery.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No project cost data yet.</p>
            ) : (
              <ChartContainer
                config={projectBarConfig}
                className="w-full"
                style={{ height: `${Math.max(200, Math.min((byProjectQuery.data?.slice(0, 10).length ?? 0) * 40, 400))}px` }}
              >
                <BarChart
                  data={(byProjectQuery.data ?? []).slice(0, 10).map((d) => ({
                    name: d.projectName ?? d.projectId ?? "Unattributed",
                    costCents: d.costCents,
                  }))}
                  layout="vertical"
                  accessibilityLayer
                >
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    tickFormatter={formatCostCents}
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    width={100}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => formatCostCents(Number(value))}
                        hideIndicator
                      />
                    }
                  />
                  <Bar dataKey="costCents" fill="var(--color-chart-4)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Chart 4: Context Composition */}
      {compositionQuery.isLoading ? (
        <ChartSkeleton />
      ) : compositionQuery.error ? (
        <ChartError message="Failed to load composition data" onRetry={() => compositionQuery.refetch()} />
      ) : (() => {
        const data = compositionQuery.data;
        const segments = data
          ? [
              { name: "systemPrompt", value: data.systemPrompt },
              { name: "skillsTools", value: data.skillsTools },
              { name: "issueContext", value: data.issueContext },
              { name: "fileContent", value: data.fileContent },
              { name: "history", value: data.history },
            ]
          : [];
        const total = segments.reduce((sum, s) => sum + s.value, 0);

        return (
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold mb-3">Context Composition</h3>
              {total === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No composition data available
                </p>
              ) : (
                <ChartContainer config={compositionConfig} className="h-[300px] w-full">
                  <PieChart accessibilityLayer>
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          nameKey="name"
                          formatter={(value) => formatTokenCount(Number(value))}
                        />
                      }
                    />
                    <Pie
                      data={segments.filter((s) => s.value > 0)}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      label={({ name, percent }: { name?: string; percent?: number }) => {
                        const cfg = name ? compositionConfig[name] : undefined;
                        return `${cfg?.label ?? name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`;
                      }}
                      labelLine={false}
                    >
                      {segments
                        .filter((s) => s.value > 0)
                        .map((entry, i) => {
                          const originalIndex = segments.findIndex((s) => s.name === entry.name);
                          return (
                            <Cell
                              key={entry.name}
                              fill={COMPOSITION_COLORS[originalIndex % COMPOSITION_COLORS.length]}
                            />
                          );
                        })}
                    </Pie>
                    <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                  </PieChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}
