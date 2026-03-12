import { describe, it, expect } from "vitest";
import type { TranscriptEntry } from "@paperclipai/adapter-utils";
import { buildTraceTree, type TraceNode } from "./trace-utils";

describe("buildTraceTree", () => {
  it("returns empty array for empty input", () => {
    expect(buildTraceTree([])).toEqual([]);
  });

  it("returns one root node of type 'init' for a single init entry", () => {
    const entries: TranscriptEntry[] = [
      { kind: "init", ts: "2026-01-01T00:00:00Z", model: "claude-3.5-sonnet", sessionId: "sess-1" },
    ];
    const tree = buildTraceTree(entries);
    expect(tree).toHaveLength(1);
    expect(tree[0].type).toBe("init");
    expect(tree[0].label).toBe("Session: claude-3.5-sonnet");
    expect(tree[0].id).toBe("node-0");
    expect(tree[0].children).toEqual([]);
  });

  it("produces correct nesting for init + assistant + tool_call + tool_result + result", () => {
    const entries: TranscriptEntry[] = [
      { kind: "init", ts: "2026-01-01T00:00:00.000Z", model: "claude-3.5-sonnet", sessionId: "sess-1" },
      { kind: "assistant", ts: "2026-01-01T00:00:01.000Z", text: "Let me help you with that." },
      { kind: "tool_call", ts: "2026-01-01T00:00:02.000Z", name: "read_file", input: { path: "/tmp/test" } },
      { kind: "tool_result", ts: "2026-01-01T00:00:03.000Z", toolUseId: "tu-1", content: "file contents here", isError: false },
      { kind: "result", ts: "2026-01-01T00:00:04.000Z", text: "Done", inputTokens: 100, outputTokens: 50, cachedTokens: 10, costUsd: 0.001, subtype: "end_turn", isError: false, errors: [] },
    ];
    const tree = buildTraceTree(entries);

    // Top-level: init, assistant branch, result
    expect(tree).toHaveLength(3);
    expect(tree[0].type).toBe("init");
    expect(tree[1].type).toBe("response"); // assistant -> response
    expect(tree[2].type).toBe("result");

    // Assistant has tool_call as child
    const assistantNode = tree[1];
    expect(assistantNode.children).toHaveLength(1);
    expect(assistantNode.children[0].type).toBe("tool_call");
    expect(assistantNode.children[0].label).toBe("Tool: read_file");

    // tool_call has tool_result as child
    const toolCallNode = assistantNode.children[0];
    expect(toolCallNode.children).toHaveLength(1);
    expect(toolCallNode.children[0].type).toBe("tool_result");
  });

  it("nests consecutive tool_call + tool_result pairs under the same assistant turn", () => {
    const entries: TranscriptEntry[] = [
      { kind: "assistant", ts: "2026-01-01T00:00:00.000Z", text: "I will read multiple files." },
      { kind: "tool_call", ts: "2026-01-01T00:00:01.000Z", name: "read_file", input: { path: "a.ts" } },
      { kind: "tool_result", ts: "2026-01-01T00:00:02.000Z", toolUseId: "tu-1", content: "content a", isError: false },
      { kind: "tool_call", ts: "2026-01-01T00:00:03.000Z", name: "write_file", input: { path: "b.ts" } },
      { kind: "tool_result", ts: "2026-01-01T00:00:04.000Z", toolUseId: "tu-2", content: "content b", isError: false },
    ];
    const tree = buildTraceTree(entries);

    expect(tree).toHaveLength(1);
    const assistantNode = tree[0];
    expect(assistantNode.type).toBe("response");
    expect(assistantNode.children).toHaveLength(2);
    expect(assistantNode.children[0].type).toBe("tool_call");
    expect(assistantNode.children[0].label).toBe("Tool: read_file");
    expect(assistantNode.children[1].type).toBe("tool_call");
    expect(assistantNode.children[1].label).toBe("Tool: write_file");

    // Each tool_call has its tool_result nested
    expect(assistantNode.children[0].children).toHaveLength(1);
    expect(assistantNode.children[0].children[0].type).toBe("tool_result");
    expect(assistantNode.children[1].children).toHaveLength(1);
    expect(assistantNode.children[1].children[0].type).toBe("tool_result");
  });

  it("nests thinking entries under the containing assistant turn", () => {
    const entries: TranscriptEntry[] = [
      { kind: "assistant", ts: "2026-01-01T00:00:00.000Z", text: "Working on it..." },
      { kind: "thinking", ts: "2026-01-01T00:00:01.000Z", text: "I need to consider the options" },
    ];
    const tree = buildTraceTree(entries);

    expect(tree).toHaveLength(1);
    const assistantNode = tree[0];
    expect(assistantNode.children).toHaveLength(1);
    expect(assistantNode.children[0].type).toBe("thinking");
    expect(assistantNode.children[0].label).toBe("Thinking...");
  });

  it("calculates duration as difference between consecutive entries' timestamps (in ms)", () => {
    const entries: TranscriptEntry[] = [
      { kind: "init", ts: "2026-01-01T00:00:00.000Z", model: "claude-3.5-sonnet", sessionId: "s1" },
      { kind: "assistant", ts: "2026-01-01T00:00:02.500Z", text: "Hello" },
      { kind: "result", ts: "2026-01-01T00:00:05.000Z", text: "Done", inputTokens: 100, outputTokens: 50, cachedTokens: 0, costUsd: 0.001, subtype: "end_turn", isError: false, errors: [] },
    ];
    const tree = buildTraceTree(entries);

    expect(tree[0].durationMs).toBe(2500); // init -> assistant = 2.5s
    expect(tree[1].durationMs).toBe(2500); // assistant -> result = 2.5s
    expect(tree[2].durationMs).toBeUndefined(); // last node, no next sibling
  });

  it("produces durationMs = undefined for entries without valid timestamps", () => {
    const entries: TranscriptEntry[] = [
      { kind: "system", ts: "", text: "some message" },
    ];
    const tree = buildTraceTree(entries);
    expect(tree[0].durationMs).toBeUndefined();
  });

  it("result entry produces a top-level terminal node with token count", () => {
    const entries: TranscriptEntry[] = [
      { kind: "result", ts: "2026-01-01T00:00:00.000Z", text: "Done", inputTokens: 200, outputTokens: 100, cachedTokens: 50, costUsd: 0.003, subtype: "end_turn", isError: false, errors: [] },
    ];
    const tree = buildTraceTree(entries);

    expect(tree).toHaveLength(1);
    expect(tree[0].type).toBe("result");
    expect(tree[0].tokenCount).toBe(300); // 200 + 100
    expect(tree[0].label).toBe("Run Complete");
  });

  it("stderr and system entries appear as standalone top-level nodes", () => {
    const entries: TranscriptEntry[] = [
      { kind: "stderr", ts: "2026-01-01T00:00:00.000Z", text: "error output" },
      { kind: "system", ts: "2026-01-01T00:00:01.000Z", text: "system message" },
    ];
    const tree = buildTraceTree(entries);

    expect(tree).toHaveLength(2);
    expect(tree[0].type).toBe("stderr");
    expect(tree[0].label).toBe("stderr");
    expect(tree[1].type).toBe("system");
    expect(tree[1].label).toBe("System");
  });

  it("generates unique hierarchical IDs for all nodes", () => {
    const entries: TranscriptEntry[] = [
      { kind: "init", ts: "2026-01-01T00:00:00.000Z", model: "claude", sessionId: "s1" },
      { kind: "assistant", ts: "2026-01-01T00:00:01.000Z", text: "Hello" },
      { kind: "tool_call", ts: "2026-01-01T00:00:02.000Z", name: "read_file", input: {} },
      { kind: "tool_result", ts: "2026-01-01T00:00:03.000Z", toolUseId: "tu-1", content: "result", isError: false },
    ];
    const tree = buildTraceTree(entries);

    expect(tree[0].id).toBe("node-0"); // init
    expect(tree[1].id).toBe("node-1"); // assistant
    expect(tree[1].children[0].id).toBe("node-1-0"); // tool_call
    expect(tree[1].children[0].children[0].id).toBe("node-1-0-0"); // tool_result
  });

  it("generates human-readable labels for all entry types", () => {
    const entries: TranscriptEntry[] = [
      { kind: "init", ts: "2026-01-01T00:00:00.000Z", model: "claude-3.5-sonnet", sessionId: "s1" },
      { kind: "user", ts: "2026-01-01T00:00:01.000Z", text: "Please help me with this task" },
      { kind: "assistant", ts: "2026-01-01T00:00:02.000Z", text: "A".repeat(100) },
      { kind: "tool_call", ts: "2026-01-01T00:00:03.000Z", name: "bash", input: { command: "ls" } },
      { kind: "tool_result", ts: "2026-01-01T00:00:04.000Z", toolUseId: "tu-1", content: "file1.ts\nfile2.ts", isError: false },
      { kind: "thinking", ts: "2026-01-01T00:00:05.000Z", text: "Let me think about this" },
      { kind: "result", ts: "2026-01-01T00:00:06.000Z", text: "Complete", inputTokens: 100, outputTokens: 50, cachedTokens: 0, costUsd: 0.001, subtype: "end_turn", isError: false, errors: [] },
    ];
    const tree = buildTraceTree(entries);

    expect(tree[0].label).toBe("Session: claude-3.5-sonnet");
    expect(tree[1].label).toBe("Please help me with this task"); // user -> prompt, text < 60 chars
    // assistant text is 100 chars, should be truncated to 60 + "..."
    expect(tree[2].label).toBe("A".repeat(60) + "...");
    expect(tree[2].children[0].label).toBe("Tool: bash"); // tool_call
    expect(tree[2].children[0].children[0].label).toBe("Result"); // tool_result
    expect(tree[2].children[1].label).toBe("Thinking..."); // thinking
    expect(tree[3].label).toBe("Run Complete"); // result
  });

  it("maps TranscriptEntry kinds to correct TraceNode types", () => {
    const entries: TranscriptEntry[] = [
      { kind: "assistant", ts: "2026-01-01T00:00:00.000Z", text: "hi" },
      { kind: "user", ts: "2026-01-01T00:00:01.000Z", text: "hello" },
      { kind: "stdout", ts: "2026-01-01T00:00:02.000Z", text: "output" },
    ];
    const tree = buildTraceTree(entries);

    // assistant -> response (a new assistant branch since no prior)
    // user -> prompt (top level since it starts before an assistant)
    // stdout -> system
    const types = tree.map((n) => n.type);
    expect(types).toContain("response");
    expect(types).toContain("prompt");
    expect(types).toContain("system");
  });

  it("preserves original content in the content field", () => {
    const entry: TranscriptEntry = { kind: "tool_call", ts: "2026-01-01T00:00:00.000Z", name: "bash", input: { command: "ls" } };
    const tree = buildTraceTree([
      { kind: "assistant", ts: "2026-01-01T00:00:00.000Z", text: "hi" },
      entry,
    ]);
    expect(tree[0].children[0].content).toEqual(entry);
  });
});
