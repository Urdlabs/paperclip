import { useCallback, useMemo } from "react";
import { useSearchParams } from "@/lib/router";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FilterBar, type FilterValue } from "@/components/FilterBar";
import { SEVERITY_LEVELS } from "@/lib/severity";
import type { ActivityListFilters } from "@/api/activity";

interface ActivityFilterBarProps {
  agents: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; name: string }>;
  entityTypes: string[];
}

const PARAM_KEYS = {
  agent: "agent",
  project: "project",
  type: "type",
  severity: "severity",
} as const;

/**
 * Hook that reads activity filter state from URL search params.
 * Returns the current filters and whether any are active.
 */
export function useActivityFilters(): {
  filters: ActivityListFilters;
  hasActiveFilters: boolean;
} {
  const [searchParams] = useSearchParams();

  return useMemo(() => {
    const agentId = searchParams.get(PARAM_KEYS.agent) || undefined;
    const projectId = searchParams.get(PARAM_KEYS.project) || undefined;
    const entityType = searchParams.get(PARAM_KEYS.type) || undefined;
    const severity = searchParams.get(PARAM_KEYS.severity) || undefined;

    const filters: ActivityListFilters = {};
    if (agentId) filters.agentId = agentId;
    if (projectId) filters.projectId = projectId;
    if (entityType) filters.entityType = entityType;
    if (severity) filters.severity = severity;

    const hasActiveFilters = !!(agentId || projectId || entityType || severity);

    return { filters, hasActiveFilters };
  }, [searchParams]);
}

export function ActivityFilterBar({ agents, projects, entityTypes }: ActivityFilterBarProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  const agentValue = searchParams.get(PARAM_KEYS.agent) || "all";
  const projectValue = searchParams.get(PARAM_KEYS.project) || "all";
  const typeValue = searchParams.get(PARAM_KEYS.type) || "all";
  const severityValue = searchParams.get(PARAM_KEYS.severity) || "all";

  const setParam = useCallback(
    (key: string, value: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value === "all" || value === "") {
            next.delete(key);
          } else {
            next.set(key, value);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const removeFilter = useCallback(
    (key: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete(key);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const clearAll = useCallback(() => {
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  // Build active filter chips for the FilterBar
  const agentMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of agents) m.set(a.id, a.name);
    return m;
  }, [agents]);

  const projectMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects) m.set(p.id, p.name);
    return m;
  }, [projects]);

  const activeFilters = useMemo<FilterValue[]>(() => {
    const chips: FilterValue[] = [];
    const agent = searchParams.get(PARAM_KEYS.agent);
    if (agent) {
      chips.push({
        key: PARAM_KEYS.agent,
        label: "Agent",
        value: agentMap.get(agent) ?? agent,
      });
    }
    const project = searchParams.get(PARAM_KEYS.project);
    if (project) {
      chips.push({
        key: PARAM_KEYS.project,
        label: "Project",
        value: projectMap.get(project) ?? project,
      });
    }
    const type = searchParams.get(PARAM_KEYS.type);
    if (type) {
      chips.push({
        key: PARAM_KEYS.type,
        label: "Type",
        value: type.charAt(0).toUpperCase() + type.slice(1),
      });
    }
    const severity = searchParams.get(PARAM_KEYS.severity);
    if (severity) {
      chips.push({
        key: PARAM_KEYS.severity,
        label: "Severity",
        value: severity.charAt(0).toUpperCase() + severity.slice(1),
      });
    }
    return chips;
  }, [searchParams, agentMap, projectMap]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={agentValue} onValueChange={(v) => setParam(PARAM_KEYS.agent, v)}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="All agents" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All agents</SelectItem>
            {agents.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={projectValue} onValueChange={(v) => setParam(PARAM_KEYS.project, v)}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="All projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={typeValue} onValueChange={(v) => setParam(PARAM_KEYS.type, v)}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {entityTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={severityValue} onValueChange={(v) => setParam(PARAM_KEYS.severity, v)}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="All severities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            {SEVERITY_LEVELS.map((level) => (
              <SelectItem key={level} value={level}>
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <FilterBar filters={activeFilters} onRemove={removeFilter} onClear={clearAll} />
    </div>
  );
}
