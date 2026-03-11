import { describe, expect, it } from "vitest";
import { reorderForCaching } from "../context-pipeline/processors/prompt-reorderer.js";
import type { PipelineContext } from "../context-pipeline/types.js";

/**
 * Helper to create a minimal valid PipelineContext for testing.
 */
function makePipelineContext(
  overrides: Partial<PipelineContext> = {},
): PipelineContext {
  return {
    agent: {
      id: "agent-1",
      companyId: "company-1",
      name: "Test Agent",
      adapterType: "claude_local",
      adapterConfig: {},
      runtimeConfig: {},
    },
    config: {},
    context: {},
    taskType: null,
    budget: null,
    promptTemplate: "You are a helpful assistant.",
    instructionsContent: null,
    issueLabels: [],
    issue: null,
    triggeringCommentId: null,
    structuredBrief: null,
    metrics: {
      originalTokenEstimate: 0,
      compressedTokenEstimate: 0,
      compressionRatio: 1,
    },
    ...overrides,
  };
}

describe("reorderForCaching", () => {
  it("returns ctx unchanged (passthrough processor)", () => {
    const ctx = makePipelineContext({
      promptTemplate: "System prompt here",
      instructionsContent: "Instructions content",
      context: { issueId: "issue-1", _brief: { title: "Test" } },
      taskType: "bug_fix",
    });

    const result = reorderForCaching(ctx);

    expect(result).toEqual(ctx);
    expect(result.promptTemplate).toBe("System prompt here");
    expect(result.instructionsContent).toBe("Instructions content");
    expect(result.context).toEqual(ctx.context);
    expect(result.taskType).toBe("bug_fix");
  });

  it("does not modify metrics", () => {
    const ctx = makePipelineContext({
      metrics: {
        originalTokenEstimate: 500,
        compressedTokenEstimate: 250,
        compressionRatio: 0.5,
      },
    });

    const result = reorderForCaching(ctx);

    expect(result.metrics).toEqual({
      originalTokenEstimate: 500,
      compressedTokenEstimate: 250,
      compressionRatio: 0.5,
    });
  });

  it("preserves all fields on the context object", () => {
    const ctx = makePipelineContext({
      agent: {
        id: "agent-2",
        companyId: "company-2",
        name: "Another Agent",
        adapterType: "codex_local",
        adapterConfig: { key: "val" },
        runtimeConfig: { setting: true },
      },
      config: { configKey: "configVal" },
      context: { data: "value" },
      taskType: "feature",
      budget: { maxTokens: 10000, source: "agent", windDownThreshold: 0.9 },
      promptTemplate: "Template",
      instructionsContent: "Instructions",
      issueLabels: ["feature", "priority:high"],
      issue: {
        title: "Feature request",
        description: "Build something",
        comments: [{ id: "c1", body: "Comment", createdAt: "2026-01-01T00:00:00Z" }],
      },
      triggeringCommentId: "c1",
      structuredBrief: {
        issueTitle: "Feature request",
        description: "Build something",
        recentComments: [],
        triggeringComment: "Comment",
        taskType: "feature",
      },
    });

    const result = reorderForCaching(ctx);

    // Deep equality check -- nothing changed
    expect(result).toEqual(ctx);
  });

  it("documents 4-layer cache structure (structural test)", () => {
    // This test exists to document that the 4-layer cache optimization structure
    // is implemented in how heartbeat.ts assembles CLI arguments, not in this processor.
    //
    // Layer 1: Static system prompt (--append-system-prompt-file, stable per agent)
    // Layer 2: Project context / instructions (stable per agent config)
    // Layer 3: Task-type template + issue context (changes per issue, stable within run)
    // Layer 4: Conversation messages (managed by Claude Code, not Paperclip)
    //
    // The reorderForCaching processor returns ctx unchanged because the ordering
    // is structural (how the prompt is assembled) not a per-run transformation.

    const ctx = makePipelineContext();
    const result = reorderForCaching(ctx);
    expect(result).toBe(ctx); // Same reference -- truly a passthrough
  });
});
