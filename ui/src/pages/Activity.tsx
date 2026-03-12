import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { activityApi } from "../api/activity";
import { agentsApi } from "../api/agents";
import { issuesApi } from "../api/issues";
import { projectsApi } from "../api/projects";
import { goalsApi } from "../api/goals";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { deriveSeverity } from "../lib/severity";
import { EmptyState } from "../components/EmptyState";
import { ActivityRow } from "../components/ActivityRow";
import { PageSkeleton } from "../components/PageSkeleton";
import { ActivityFilterBar, useActivityFilters } from "../components/ActivityFilterBar";
import { History } from "lucide-react";
import type { Agent } from "@paperclipai/shared";

const SEVERITY_DOT_COLORS: Record<string, string> = {
  info: "bg-emerald-500",
  warning: "bg-yellow-500",
  error: "bg-red-500",
};

export function Activity() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { filters, hasActiveFilters } = useActivityFilters();

  useEffect(() => {
    setBreadcrumbs([{ label: "Activity" }]);
  }, [setBreadcrumbs]);

  const filtersObj = useMemo<Record<string, string | undefined>>(
    () => ({
      agentId: filters.agentId,
      projectId: filters.projectId,
      entityType: filters.entityType,
      severity: filters.severity,
    }),
    [filters],
  );

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.activity(selectedCompanyId!, filtersObj),
    queryFn: () => activityApi.list(selectedCompanyId!, filters),
    enabled: !!selectedCompanyId,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: goals } = useQuery({
    queryKey: queryKeys.goals.list(selectedCompanyId!),
    queryFn: () => goalsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const agentMap = useMemo(() => {
    const map = new Map<string, Agent>();
    for (const a of agents ?? []) map.set(a.id, a);
    return map;
  }, [agents]);

  const entityNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of issues ?? []) map.set(`issue:${i.id}`, i.identifier ?? i.id.slice(0, 8));
    for (const a of agents ?? []) map.set(`agent:${a.id}`, a.name);
    for (const p of projects ?? []) map.set(`project:${p.id}`, p.name);
    for (const g of goals ?? []) map.set(`goal:${g.id}`, g.title);
    return map;
  }, [issues, agents, projects, goals]);

  const entityTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of issues ?? []) map.set(`issue:${i.id}`, i.title);
    return map;
  }, [issues]);

  // Derive unique entity types from current data for the type filter dropdown
  const entityTypes = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.map((e) => e.entityType))].sort();
  }, [data]);

  // Build agent/project lists for filter dropdowns
  const agentOptions = useMemo(
    () => (agents ?? []).map((a) => ({ id: a.id, name: a.name })),
    [agents],
  );

  const projectOptions = useMemo(
    () => (projects ?? []).map((p) => ({ id: p.id, name: p.name })),
    [projects],
  );

  if (!selectedCompanyId) {
    return <EmptyState icon={History} message="Select a company to view activity." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  return (
    <div className="space-y-4">
      <ActivityFilterBar
        agents={agentOptions}
        projects={projectOptions}
        entityTypes={entityTypes}
      />

      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {data && data.length === 0 && (
        <EmptyState
          icon={History}
          message={hasActiveFilters ? "No activity matches the current filters." : "No activity yet."}
        />
      )}

      {data && data.length > 0 && (
        <>
          <div className="border border-border divide-y divide-border">
            {data.map((event) => {
              const severity = deriveSeverity(event.action);
              const dotColor = SEVERITY_DOT_COLORS[severity] ?? SEVERITY_DOT_COLORS.info;
              return (
                <div key={event.id} className="flex items-center">
                  <div className="pl-3 shrink-0">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${dotColor}`}
                      title={severity}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <ActivityRow
                      event={event}
                      agentMap={agentMap}
                      entityNameMap={entityNameMap}
                      entityTitleMap={entityTitleMap}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {data.length >= 200 && (
            <p className="text-xs text-muted-foreground text-center">Showing first 200 events</p>
          )}
        </>
      )}
    </div>
  );
}
