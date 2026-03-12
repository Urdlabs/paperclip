import { useState } from "react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  CirclePlay,
  MessageSquare,
  Wrench,
  Package,
  Zap,
  Brain,
  Flag,
  Terminal,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTokens } from "@/lib/utils";
import type { TraceNode } from "@/lib/trace-utils";

// ---------------------------------------------------------------------------
// Node type config: icon, text color, background color
// ---------------------------------------------------------------------------

const nodeTypeConfig: Record<
  TraceNode["type"],
  {
    icon: typeof CirclePlay;
    textColor: string;
    bgColor: string;
  }
> = {
  init: { icon: CirclePlay, textColor: "text-slate-400", bgColor: "bg-slate-400/10" },
  prompt: { icon: MessageSquare, textColor: "text-blue-400", bgColor: "bg-blue-400/10" },
  tool_call: { icon: Wrench, textColor: "text-amber-400", bgColor: "bg-amber-400/10" },
  tool_result: { icon: Package, textColor: "text-orange-400", bgColor: "bg-orange-400/10" },
  response: { icon: Zap, textColor: "text-green-400", bgColor: "bg-green-400/10" },
  thinking: { icon: Brain, textColor: "text-purple-400", bgColor: "bg-purple-400/10" },
  result: { icon: Flag, textColor: "text-emerald-400", bgColor: "bg-emerald-400/10" },
  system: { icon: Terminal, textColor: "text-gray-400", bgColor: "bg-gray-400/10" },
  stderr: { icon: Terminal, textColor: "text-gray-400", bgColor: "bg-gray-400/10" },
};

// ---------------------------------------------------------------------------
// Content extraction
// ---------------------------------------------------------------------------

const CONTENT_TRUNCATE_LIMIT = 500;

function getContentText(node: TraceNode): string {
  const entry = node.content;
  switch (entry.kind) {
    case "tool_call":
      try {
        return JSON.stringify(entry.input, null, 2);
      } catch {
        return String(entry.input);
      }
    case "tool_result":
      return entry.content;
    case "assistant":
    case "thinking":
    case "user":
      return entry.text;
    case "result": {
      const lines = [];
      if (entry.text) lines.push(entry.text);
      lines.push(
        `Tokens: in=${entry.inputTokens} out=${entry.outputTokens} cached=${entry.cachedTokens}`
      );
      lines.push(`Cost: $${entry.costUsd.toFixed(6)}`);
      if (entry.isError) lines.push(`Error: ${entry.errors.join(", ")}`);
      return lines.join("\n");
    }
    case "init":
      return `Model: ${entry.model}\nSession: ${entry.sessionId}`;
    case "stderr":
    case "system":
    case "stdout":
      return entry.text;
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// Format duration
// ---------------------------------------------------------------------------

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

// ---------------------------------------------------------------------------
// TraceNodeRow
// ---------------------------------------------------------------------------

export function TraceNodeRow({
  node,
  depth = 0,
  defaultOpen = false,
}: {
  node: TraceNode;
  depth?: number;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [showFullContent, setShowFullContent] = useState(false);

  const config = nodeTypeConfig[node.type];
  const Icon = config.icon;
  const hasChildren = node.children.length > 0;
  const contentText = getContentText(node);
  const needsTruncation = contentText.length > CONTENT_TRUNCATE_LIMIT;
  const displayContent =
    !showFullContent && needsTruncation
      ? contentText.slice(0, CONTENT_TRUNCATE_LIMIT)
      : contentText;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center w-full gap-2 px-2 py-1.5 text-left text-sm",
            "hover:bg-accent/30 rounded transition-colors",
            "group"
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {/* Chevron */}
          <span className="w-4 h-4 shrink-0 flex items-center justify-center">
            {hasChildren || contentText ? (
              isOpen ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )
            ) : null}
          </span>

          {/* Type icon with color background */}
          <span
            className={cn(
              "inline-flex items-center justify-center w-6 h-6 rounded shrink-0",
              config.bgColor
            )}
          >
            <Icon className={cn("h-3.5 w-3.5", config.textColor)} />
          </span>

          {/* Label */}
          <span className="truncate min-w-0 flex-1 text-xs">{node.label}</span>

          {/* Duration */}
          {node.durationMs !== undefined && (
            <span className="font-mono text-xs text-muted-foreground shrink-0 ml-auto">
              {formatDuration(node.durationMs)}
            </span>
          )}

          {/* Token count */}
          {node.tokenCount !== undefined && (
            <span className="font-mono text-xs text-muted-foreground shrink-0 ml-2">
              {formatTokens(node.tokenCount)} tokens
            </span>
          )}
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        {/* Expanded content */}
        {contentText && (
          <div
            className="ml-4 border-l-2 border-border"
            style={{ marginLeft: `${depth * 16 + 20}px` }}
          >
            <pre className="font-mono text-xs whitespace-pre-wrap text-muted-foreground max-h-60 overflow-y-auto p-2 pl-3">
              {displayContent}
            </pre>
            {needsTruncation && (
              <button
                type="button"
                className="text-xs text-blue-400 hover:text-blue-300 px-3 pb-2"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowFullContent(!showFullContent);
                }}
              >
                {showFullContent ? "Show less" : "Show more"}
              </button>
            )}
          </div>
        )}

        {/* Children */}
        {hasChildren &&
          node.children.map((child) => (
            <TraceNodeRow key={child.id} node={child} depth={depth + 1} />
          ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
