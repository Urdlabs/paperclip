import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { webhooksApi, type WebhookEndpoint } from "../api/webhooks";
import { queryKeys } from "../lib/queryKeys";
import { WebhookDeliveryLog } from "./WebhookDeliveryLog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Pencil,
  Play,
  Trash2,
  Plus,
  Webhook,
} from "lucide-react";

import { WEBHOOK_EVENT_TYPES } from "@paperclipai/shared";

const EVENT_TYPES = WEBHOOK_EVENT_TYPES;

type WebhookFormData = {
  url: string;
  description: string;
  eventTypes: string[];
};

const emptyForm: WebhookFormData = { url: "", description: "", eventTypes: [] };

export function WebhookEndpointList({ companyId }: { companyId: string }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<WebhookFormData>(emptyForm);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  const { data: endpoints, isLoading } = useQuery({
    queryKey: queryKeys.webhooks.list(companyId),
    queryFn: () => webhooksApi.list(companyId),
  });

  const createMutation = useMutation({
    mutationFn: (data: WebhookFormData) =>
      webhooksApi.create(companyId, {
        url: data.url,
        description: data.description || undefined,
        eventTypes: data.eventTypes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.list(companyId) });
      closeDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: WebhookFormData }) =>
      webhooksApi.update(companyId, id, {
        url: data.url,
        description: data.description || undefined,
        eventTypes: data.eventTypes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.list(companyId) });
      closeDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => webhooksApi.remove(companyId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.list(companyId) });
    },
  });

  const enableMutation = useMutation({
    mutationFn: (id: string) => webhooksApi.update(companyId, id, { enabled: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.list(companyId) });
    },
  });

  function closeDialog() {
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function openCreate() {
    setForm(emptyForm);
    setEditingId(null);
    setDialogOpen(true);
  }

  function openEdit(endpoint: WebhookEndpoint) {
    setForm({
      url: endpoint.url,
      description: endpoint.description ?? "",
      eventTypes: endpoint.eventTypes,
    });
    setEditingId(endpoint.id);
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  function toggleEventType(type: string) {
    setForm((prev) => ({
      ...prev,
      eventTypes: prev.eventTypes.includes(type)
        ? prev.eventTypes.filter((t) => t !== type)
        : [...prev.eventTypes, type],
    }));
  }

  async function handleTest(endpointId: string) {
    setTestingId(endpointId);
    setTestResult(null);
    try {
      const result = await webhooksApi.testDelivery(companyId, endpointId);
      setTestResult(result.success ? "Test delivery succeeded" : `Test failed (status: ${result.responseStatus})`);
    } catch (err) {
      setTestResult(err instanceof Error ? err.message : "Test failed");
    } finally {
      setTestingId(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.deliveries(companyId, endpointId) });
    }
  }

  function handleDelete(endpoint: WebhookEndpoint) {
    const confirmed = window.confirm(`Delete webhook "${endpoint.url}"? This cannot be undone.`);
    if (confirmed) deleteMutation.mutate(endpoint.id);
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (isLoading) {
    return <p className="text-xs text-muted-foreground">Loading webhooks...</p>;
  }

  return (
    <div className="space-y-3">
      {(!endpoints || endpoints.length === 0) ? (
        <p className="text-xs text-muted-foreground">No webhook endpoints configured.</p>
      ) : (
        <div className="space-y-2">
          {endpoints.map((endpoint) => (
            <div key={endpoint.id} className="border border-border rounded-lg">
              {/* Disabled warning banner */}
              {!endpoint.enabled && (
                <div className="flex items-center justify-between gap-2 rounded-t-lg border-b border-amber-500/30 bg-amber-500/10 px-3 py-2">
                  <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Webhook disabled after {endpoint.consecutiveFailures} consecutive failures
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs"
                    onClick={() => enableMutation.mutate(endpoint.id)}
                    disabled={enableMutation.isPending}
                  >
                    Re-enable
                  </Button>
                </div>
              )}

              <div className="px-3 py-2.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Webhook className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm font-mono truncate max-w-[280px]" title={endpoint.url}>
                      {endpoint.url}
                    </span>
                    <Badge variant={endpoint.enabled ? "default" : "secondary"} className="text-[10px] shrink-0">
                      {endpoint.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                    {endpoint.consecutiveFailures > 0 && endpoint.enabled && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400">
                        {endpoint.consecutiveFailures} failures
                      </span>
                    )}
                  </div>
                </div>

                {endpoint.description && (
                  <p className="text-xs text-muted-foreground">{endpoint.description}</p>
                )}

                <div className="flex items-center gap-1 flex-wrap">
                  {endpoint.eventTypes.map((type) => (
                    <Badge key={type} variant="outline" className="text-[10px] font-mono">
                      {type}
                    </Badge>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => openEdit(endpoint)}
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => handleTest(endpoint.id)}
                    disabled={testingId === endpoint.id}
                  >
                    <Play className="h-3 w-3 mr-1" />
                    {testingId === endpoint.id ? "Testing..." : "Test"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => setExpandedId(expandedId === endpoint.id ? null : endpoint.id)}
                  >
                    {expandedId === endpoint.id
                      ? <ChevronDown className="h-3 w-3 mr-1" />
                      : <ChevronRight className="h-3 w-3 mr-1" />
                    }
                    Deliveries
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                    onClick={() => handleDelete(endpoint)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                </div>

                {testResult && testingId === null && (
                  <p className={`text-xs ${testResult.includes("succeeded") ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                    {testResult}
                  </p>
                )}
              </div>

              {expandedId === endpoint.id && (
                <div className="border-t border-border px-3 py-2.5">
                  <WebhookDeliveryLog companyId={companyId} webhookId={endpoint.id} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Button size="sm" variant="outline" onClick={openCreate}>
        <Plus className="h-3.5 w-3.5 mr-1.5" />
        Add Webhook
      </Button>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Webhook" : "Add Webhook"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">URL (required)</Label>
              <Input
                placeholder="https://example.com/webhook"
                value={form.url}
                onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description (optional)</Label>
              <Input
                placeholder="What this webhook is for"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Event Types</Label>
              <div className="space-y-1.5">
                {EVENT_TYPES.map((type) => (
                  <div key={type} className="flex items-center gap-2">
                    <Checkbox
                      id={`event-${type}`}
                      checked={form.eventTypes.includes(type)}
                      onCheckedChange={() => toggleEventType(type)}
                    />
                    <label htmlFor={`event-${type}`} className="text-xs font-mono cursor-pointer">
                      {type}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!form.url.trim() || form.eventTypes.length === 0 || isSaving}
            >
              {isSaving ? "Saving..." : editingId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
