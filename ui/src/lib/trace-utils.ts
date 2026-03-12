import type { TranscriptEntry } from "@paperclipai/adapter-utils";

export interface TraceNode {
  id: string;
  type: "init" | "prompt" | "tool_call" | "tool_result" | "response" | "thinking" | "result" | "system" | "stderr";
  label: string;
  ts: string;
  durationMs?: number;
  tokenCount?: number;
  children: TraceNode[];
  content: TranscriptEntry;
}

// ---------------------------------------------------------------------------
// Kind -> TraceNode type mapping
// ---------------------------------------------------------------------------

function mapKindToType(kind: TranscriptEntry["kind"]): TraceNode["type"] {
  switch (kind) {
    case "assistant": return "response";
    case "user": return "prompt";
    case "init": return "init";
    case "result": return "result";
    case "tool_call": return "tool_call";
    case "tool_result": return "tool_result";
    case "thinking": return "thinking";
    case "stderr": return "stderr";
    case "system":
    case "stdout":
      return "system";
  }
}

// ---------------------------------------------------------------------------
// Label generation
// ---------------------------------------------------------------------------

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "...";
}

function makeLabel(entry: TranscriptEntry): string {
  switch (entry.kind) {
    case "init": return `Session: ${entry.model}`;
    case "assistant": return truncate(entry.text, 60);
    case "user": return truncate(entry.text, 60);
    case "tool_call": return `Tool: ${entry.name}`;
    case "tool_result": return "Result";
    case "result": return "Run Complete";
    case "thinking": return "Thinking...";
    case "stderr": return "stderr";
    case "system": return "System";
    case "stdout": return "System";
  }
}

// ---------------------------------------------------------------------------
// Duration calculation
// ---------------------------------------------------------------------------

function parseTsMs(ts: string): number | undefined {
  if (!ts) return undefined;
  const ms = new Date(ts).getTime();
  return Number.isNaN(ms) ? undefined : ms;
}

// ---------------------------------------------------------------------------
// buildTraceTree
// ---------------------------------------------------------------------------

export function buildTraceTree(entries: TranscriptEntry[]): TraceNode[] {
  if (entries.length === 0) return [];

  const topLevel: TraceNode[] = [];
  let currentAssistant: TraceNode | null = null;
  let currentToolCall: TraceNode | null = null;

  for (const entry of entries) {
    const kind = entry.kind;

    if (kind === "assistant") {
      // Start a new top-level assistant branch
      const node: TraceNode = {
        id: "", // assigned later
        type: "response",
        label: makeLabel(entry),
        ts: entry.ts,
        children: [],
        content: entry,
      };
      topLevel.push(node);
      currentAssistant = node;
      currentToolCall = null;
    } else if (kind === "tool_call") {
      const node: TraceNode = {
        id: "",
        type: "tool_call",
        label: makeLabel(entry),
        ts: entry.ts,
        children: [],
        content: entry,
      };
      if (currentAssistant) {
        currentAssistant.children.push(node);
      } else {
        topLevel.push(node);
      }
      currentToolCall = node;
    } else if (kind === "tool_result") {
      const node: TraceNode = {
        id: "",
        type: "tool_result",
        label: makeLabel(entry),
        ts: entry.ts,
        children: [],
        content: entry,
      };
      if (currentToolCall) {
        currentToolCall.children.push(node);
      } else if (currentAssistant) {
        currentAssistant.children.push(node);
      } else {
        topLevel.push(node);
      }
    } else if (kind === "thinking") {
      const node: TraceNode = {
        id: "",
        type: "thinking",
        label: makeLabel(entry),
        ts: entry.ts,
        children: [],
        content: entry,
      };
      if (currentAssistant) {
        currentAssistant.children.push(node);
      } else {
        topLevel.push(node);
      }
    } else if (kind === "result") {
      const resultEntry = entry as Extract<TranscriptEntry, { kind: "result" }>;
      const node: TraceNode = {
        id: "",
        type: "result",
        label: makeLabel(entry),
        ts: entry.ts,
        tokenCount: resultEntry.inputTokens + resultEntry.outputTokens,
        children: [],
        content: entry,
      };
      topLevel.push(node);
      currentAssistant = null;
      currentToolCall = null;
    } else if (kind === "user") {
      // User prompt starts fresh -- not nested under assistant
      const node: TraceNode = {
        id: "",
        type: "prompt",
        label: makeLabel(entry),
        ts: entry.ts,
        children: [],
        content: entry,
      };
      topLevel.push(node);
      currentAssistant = null;
      currentToolCall = null;
    } else {
      // init, stderr, system, stdout -> top-level standalone
      const node: TraceNode = {
        id: "",
        type: mapKindToType(kind),
        label: makeLabel(entry),
        ts: entry.ts,
        children: [],
        content: entry,
      };
      topLevel.push(node);
      // Don't reset currentAssistant for init/stderr/system/stdout
      // so that tool_calls after them still nest properly if assistant is active
      if (kind === "init") {
        currentAssistant = null;
        currentToolCall = null;
      }
    }
  }

  // Assign hierarchical IDs
  assignIds(topLevel, "node");

  // Calculate durations for top-level sibling nodes
  assignSiblingDurations(topLevel);

  return topLevel;
}

// ---------------------------------------------------------------------------
// ID assignment
// ---------------------------------------------------------------------------

function assignIds(nodes: TraceNode[], prefix: string): void {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    node.id = `${prefix}-${i}`;
    if (node.children.length > 0) {
      assignIds(node.children, node.id);
    }
  }
}

// ---------------------------------------------------------------------------
// Duration calculation for sibling nodes
// ---------------------------------------------------------------------------

function assignSiblingDurations(nodes: TraceNode[]): void {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const nextSibling = nodes[i + 1];
    if (nextSibling) {
      const thisMs = parseTsMs(node.ts);
      const nextMs = parseTsMs(nextSibling.ts);
      if (thisMs !== undefined && nextMs !== undefined) {
        node.durationMs = nextMs - thisMs;
      }
    }
    // Recurse into children
    if (node.children.length > 0) {
      assignSiblingDurations(node.children);
    }
  }
}
