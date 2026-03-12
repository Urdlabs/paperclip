import { useMemo } from "react";
import type { TranscriptEntry } from "@paperclipai/adapter-utils";
import { buildTraceTree } from "@/lib/trace-utils";
import { TraceNodeRow } from "@/components/TraceNode";

export function TraceView({ transcript }: { transcript: TranscriptEntry[] }) {
  const tree = useMemo(() => buildTraceTree(transcript), [transcript]);

  if (tree.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        No trace data available
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-muted/30">
        <span className="text-xs font-medium text-muted-foreground">
          Execution Trace ({tree.length})
        </span>
      </div>
      <div className="divide-y divide-border/50">
        {tree.map((node, idx) => (
          <TraceNodeRow key={node.id} node={node} defaultOpen={idx === 0} />
        ))}
      </div>
    </div>
  );
}
