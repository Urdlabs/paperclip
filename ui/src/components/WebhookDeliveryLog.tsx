import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { webhooksApi, type WebhookDelivery } from "../api/webhooks";
import { queryKeys } from "../lib/queryKeys";
import { Badge } from "@/components/ui/badge";
import { relativeTime } from "../lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";

const statusColors: Record<string, string> = {
  succeeded: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30",
  failed: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  pending: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  disabled: "bg-neutral-500/15 text-neutral-500 border-neutral-500/30",
};

function truncateJson(value: unknown, maxLen = 200): string {
  try {
    const str = typeof value === "string" ? value : JSON.stringify(value, null, 2);
    if (str.length <= maxLen) return str;
    return str.slice(0, maxLen - 1) + "\u2026";
  } catch {
    return String(value);
  }
}

export function WebhookDeliveryLog({
  companyId,
  webhookId,
}: {
  companyId: string;
  webhookId: string;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: deliveries, isLoading } = useQuery({
    queryKey: queryKeys.webhooks.deliveries(companyId, webhookId),
    queryFn: () => webhooksApi.listDeliveries(companyId, webhookId),
  });

  if (isLoading) {
    return <p className="text-xs text-muted-foreground">Loading deliveries...</p>;
  }

  if (!deliveries || deliveries.length === 0) {
    return <p className="text-xs text-muted-foreground">No deliveries yet.</p>;
  }

  return (
    <div className="space-y-0">
      {/* Header row */}
      <div className="grid grid-cols-[1fr_90px_60px_70px_100px] gap-2 px-2 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide border-b border-border">
        <span>Event Type</span>
        <span>Status</span>
        <span>Attempts</span>
        <span>Response</span>
        <span>Created</span>
      </div>

      {deliveries.map((delivery: WebhookDelivery) => (
        <div key={delivery.id}>
          <button
            className="grid grid-cols-[1fr_90px_60px_70px_100px] gap-2 w-full items-center px-2 py-1.5 text-xs hover:bg-accent/30 transition-colors text-left"
            onClick={() => setExpandedId(expandedId === delivery.id ? null : delivery.id)}
          >
            <span className="flex items-center gap-1.5">
              {expandedId === delivery.id
                ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
              }
              <span className="font-mono truncate">{delivery.eventType}</span>
            </span>
            <span>
              <Badge
                variant="outline"
                className={`text-[10px] ${statusColors[delivery.status] ?? ""}`}
              >
                {delivery.status}
              </Badge>
            </span>
            <span className="text-muted-foreground">{delivery.attemptCount}</span>
            <span className="font-mono text-muted-foreground">
              {delivery.lastResponseStatus ?? "-"}
            </span>
            <span className="text-muted-foreground">{relativeTime(delivery.createdAt)}</span>
          </button>

          {expandedId === delivery.id && (
            <div className="px-3 py-2 bg-muted/20 border-t border-border space-y-2 text-xs">
              <div>
                <span className="text-muted-foreground font-medium">Payload:</span>
                <pre className="mt-1 font-mono text-[11px] text-muted-foreground whitespace-pre-wrap break-all bg-neutral-950/50 rounded p-2">
                  {truncateJson(delivery.payload)}
                </pre>
              </div>
              {delivery.lastResponseBody && (
                <div>
                  <span className="text-muted-foreground font-medium">Response body:</span>
                  <pre className="mt-1 font-mono text-[11px] text-muted-foreground whitespace-pre-wrap break-all bg-neutral-950/50 rounded p-2">
                    {truncateJson(delivery.lastResponseBody)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
