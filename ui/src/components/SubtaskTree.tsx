import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { issuesApi } from "../api/issues";
import { queryKeys } from "../lib/queryKeys";
import { StatusIcon } from "./StatusIcon";
import { PriorityIcon } from "./PriorityIcon";
import { StatusBadge } from "./StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ArrowRight, GitBranch, Link2, Plus, X } from "lucide-react";
import type { Issue, SubtaskWithDependencies } from "@paperclipai/shared";

export function SubtaskTree({
  companyId,
  parentIssueId,
}: {
  companyId: string;
  parentIssueId: string;
}) {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [depPickerOpen, setDepPickerOpen] = useState<string | null>(null);

  const { data: subtasks, isLoading } = useQuery({
    queryKey: queryKeys.subtasks.list(companyId, parentIssueId),
    queryFn: () => issuesApi.listSubtasks(companyId, parentIssueId),
  });

  const createSubtask = useMutation({
    mutationFn: (data: { title: string; description?: string; priority?: string }) =>
      issuesApi.createSubtask(companyId, parentIssueId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subtasks.list(companyId, parentIssueId) });
      setNewTitle("");
      setNewDescription("");
      setNewPriority("medium");
      setShowAddForm(false);
    },
  });

  const addDependency = useMutation({
    mutationFn: ({ issueId, dependsOnId }: { issueId: string; dependsOnId: string }) =>
      issuesApi.addDependency(companyId, issueId, dependsOnId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subtasks.list(companyId, parentIssueId) });
      setDepPickerOpen(null);
    },
    onError: (err) => {
      // Cycle detected or other error -- show as alert
      alert(err instanceof Error ? err.message : "Failed to add dependency");
    },
  });

  const removeDependency = useMutation({
    mutationFn: ({ issueId, dependsOnId }: { issueId: string; dependsOnId: string }) =>
      issuesApi.removeDependency(companyId, issueId, dependsOnId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subtasks.list(companyId, parentIssueId) });
    },
  });

  function handleCreateSubtask() {
    if (!newTitle.trim()) return;
    createSubtask.mutate({
      title: newTitle.trim(),
      description: newDescription.trim() || undefined,
      priority: newPriority,
    });
  }

  // Build a lookup map for subtask titles by id
  const subtaskMap = new Map<string, SubtaskWithDependencies>();
  for (const s of subtasks ?? []) {
    subtaskMap.set(s.id, s);
  }

  if (isLoading) {
    return <p className="text-xs text-muted-foreground">Loading subtasks...</p>;
  }

  return (
    <div className="space-y-2">
      {(!subtasks || subtasks.length === 0) ? (
        <p className="text-xs text-muted-foreground">No subtasks yet.</p>
      ) : (
        <div className="border border-border rounded-lg divide-y divide-border">
          {subtasks.map((subtask) => {
            const deps: SubtaskWithDependencies[] = (subtask.dependsOn ?? [])
              .map((depId: string) => subtaskMap.get(depId))
              .filter(Boolean) as SubtaskWithDependencies[];

            return (
              <div key={subtask.id} className="px-3 py-2 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <StatusIcon status={subtask.status} />
                    <PriorityIcon priority={subtask.priority} />
                    <span className="font-mono text-xs text-muted-foreground shrink-0">
                      {subtask.identifier ?? subtask.id.slice(0, 8)}
                    </span>
                    <Link
                      to={`/issues/${subtask.identifier ?? subtask.id}`}
                      className="text-sm truncate hover:underline"
                    >
                      {subtask.title}
                    </Link>
                  </div>
                  <StatusBadge status={subtask.status} />
                </div>

                {/* Dependency labels */}
                {deps.length > 0 && (
                  <div className="flex items-center gap-1.5 pl-5 flex-wrap">
                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-[10px] text-muted-foreground">depends on:</span>
                    {deps.map((dep) => (
                      <Badge key={dep.id} variant="outline" className="text-[10px] gap-1 pr-1">
                        <Link
                          to={`/issues/${dep.identifier ?? dep.id}`}
                          className="hover:underline"
                        >
                          {dep.identifier ?? dep.title.slice(0, 20)}
                        </Link>
                        <button
                          className="hover:text-destructive ml-0.5"
                          onClick={() => removeDependency.mutate({ issueId: subtask.id, dependsOnId: dep.id })}
                          title="Remove dependency"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Add dependency action */}
                <div className="pl-5">
                  <Popover
                    open={depPickerOpen === subtask.id}
                    onOpenChange={(open) => setDepPickerOpen(open ? subtask.id : null)}
                  >
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                        <Link2 className="h-3 w-3" />
                        Add dependency
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-1" align="start">
                      <div className="text-xs font-medium px-2 py-1.5 text-muted-foreground">
                        Select a subtask
                      </div>
                      {(subtasks ?? [])
                        .filter((s) => s.id !== subtask.id)
                        .filter((s) => !deps.some((d) => d.id === s.id))
                        .map((s) => (
                          <button
                            key={s.id}
                            className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50 text-left"
                            onClick={() => addDependency.mutate({ issueId: subtask.id, dependsOnId: s.id })}
                          >
                            <StatusIcon status={s.status} />
                            <span className="truncate">{s.title}</span>
                          </button>
                        ))}
                      {(subtasks ?? []).filter((s) => s.id !== subtask.id && !deps.some((d) => d.id === s.id)).length === 0 && (
                        <p className="px-2 py-1.5 text-xs text-muted-foreground">No other subtasks available</p>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add subtask */}
      {showAddForm ? (
        <div className="border border-border rounded-lg px-3 py-2.5 space-y-2">
          <div className="flex items-center gap-1.5">
            <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">New Subtask</span>
          </div>
          <Input
            placeholder="Subtask title (required)"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="h-8 text-sm"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") handleCreateSubtask(); }}
          />
          <Input
            placeholder="Description (optional)"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            className="h-8 text-sm"
          />
          <div className="flex items-center gap-2">
            <Select value={newPriority} onValueChange={setNewPriority}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1.5 ml-auto">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => { setShowAddForm(false); setNewTitle(""); setNewDescription(""); }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={handleCreateSubtask}
                disabled={!newTitle.trim() || createSubtask.isPending}
              >
                {createSubtask.isPending ? "Creating..." : "Create"}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setShowAddForm(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Subtask
        </Button>
      )}
    </div>
  );
}
