import { describe, expect, it } from "vitest";
import { deduplicateContext } from "../context-pipeline/processors/deduplicator.js";
import type { PipelineContext, StructuredBrief } from "../context-pipeline/types.js";

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
      originalTokenEstimate: 100,
      compressedTokenEstimate: 100,
      compressionRatio: 1,
    },
    ...overrides,
  };
}

const sampleBrief: StructuredBrief = {
  issueTitle: "Test Issue",
  description: "Test description",
  recentComments: ["comment 1"],
  triggeringComment: "trigger",
  taskType: "bug_fix",
};

describe("deduplicateContext", () => {
  it("removes keys redundant with structured brief", () => {
    const ctx = makePipelineContext({
      structuredBrief: sampleBrief,
      context: {
        issueId: "issue-1",
        issueTitle: "Test Issue",
        issueDescription: "Test description",
        issueBody: "Test body",
        comments: ["comment 1"],
        recentComments: ["comment 1"],
        lastComment: "last",
        _brief: sampleBrief,
      },
    });
    const result = deduplicateContext(ctx);

    expect(result.context).not.toHaveProperty("issueTitle");
    expect(result.context).not.toHaveProperty("issueDescription");
    expect(result.context).not.toHaveProperty("issueBody");
    expect(result.context).not.toHaveProperty("comments");
    expect(result.context).not.toHaveProperty("recentComments");
    expect(result.context).not.toHaveProperty("lastComment");
  });

  it("preserves essential keys", () => {
    const ctx = makePipelineContext({
      structuredBrief: sampleBrief,
      context: {
        issueId: "issue-1",
        projectId: "proj-1",
        paperclipWorkspace: "/workspace",
        paperclipWorkspaces: ["/ws1", "/ws2"],
        taskId: "task-1",
        _brief: sampleBrief,
      },
    });
    const result = deduplicateContext(ctx);

    expect(result.context).toHaveProperty("issueId", "issue-1");
    expect(result.context).toHaveProperty("projectId", "proj-1");
    expect(result.context).toHaveProperty("paperclipWorkspace", "/workspace");
    expect(result.context).toHaveProperty("paperclipWorkspaces");
    expect(result.context).toHaveProperty("taskId", "task-1");
    expect(result.context).toHaveProperty("_brief");
  });

  it("removes empty string values", () => {
    const ctx = makePipelineContext({
      context: {
        issueId: "issue-1",
        emptyField: "",
        anotherEmpty: "",
      },
    });
    const result = deduplicateContext(ctx);

    expect(result.context).not.toHaveProperty("emptyField");
    expect(result.context).not.toHaveProperty("anotherEmpty");
    expect(result.context).toHaveProperty("issueId", "issue-1");
  });

  it("removes null values", () => {
    const ctx = makePipelineContext({
      context: {
        issueId: "issue-1",
        nullField: null,
        anotherNull: null,
      },
    });
    const result = deduplicateContext(ctx);

    expect(result.context).not.toHaveProperty("nullField");
    expect(result.context).not.toHaveProperty("anotherNull");
    expect(result.context).toHaveProperty("issueId", "issue-1");
  });

  it("removes orchestration metadata keys", () => {
    const ctx = makePipelineContext({
      context: {
        issueId: "issue-1",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-02",
        metadata: { internal: true },
        internalId: "int-123",
      },
    });
    const result = deduplicateContext(ctx);

    expect(result.context).not.toHaveProperty("createdAt");
    expect(result.context).not.toHaveProperty("updatedAt");
    expect(result.context).not.toHaveProperty("metadata");
    expect(result.context).not.toHaveProperty("internalId");
  });

  it("preserves non-essential, non-redundant, non-empty keys", () => {
    const ctx = makePipelineContext({
      context: {
        issueId: "issue-1",
        customField: "value",
        anotherField: 42,
        nestedObj: { key: "val" },
      },
    });
    const result = deduplicateContext(ctx);

    expect(result.context).toHaveProperty("customField", "value");
    expect(result.context).toHaveProperty("anotherField", 42);
    expect(result.context).toHaveProperty("nestedObj");
  });

  it("works without structured brief (does not remove brief-redundant keys)", () => {
    const ctx = makePipelineContext({
      structuredBrief: null,
      context: {
        issueId: "issue-1",
        issueTitle: "Title",
        issueDescription: "Description",
        comments: ["c1"],
      },
    });
    const result = deduplicateContext(ctx);

    // Without brief, these are not considered redundant
    expect(result.context).toHaveProperty("issueTitle", "Title");
    expect(result.context).toHaveProperty("issueDescription", "Description");
    expect(result.context).toHaveProperty("comments");
  });

  it("updates compressedTokenEstimate after dedup", () => {
    const ctx = makePipelineContext({
      context: {
        issueId: "issue-1",
        bigField: "x".repeat(5000),
        emptyField: "",
        nullField: null,
        createdAt: "2026-01-01",
      },
      metrics: {
        originalTokenEstimate: 2000,
        compressedTokenEstimate: 2000,
        compressionRatio: 1,
      },
    });
    const result = deduplicateContext(ctx);

    // After removing empty, null, and metadata fields, compressed estimate should change
    expect(result.metrics.compressedTokenEstimate).toBeGreaterThan(0);
    expect(result.metrics.compressionRatio).toBeLessThan(1);
  });

  it("handles empty context object", () => {
    const ctx = makePipelineContext({
      context: {},
      metrics: {
        originalTokenEstimate: 100,
        compressedTokenEstimate: 100,
        compressionRatio: 1,
      },
    });
    const result = deduplicateContext(ctx);

    expect(Object.keys(result.context)).toHaveLength(0);
  });

  it("handles context with only essential keys", () => {
    const ctx = makePipelineContext({
      context: {
        issueId: "issue-1",
        projectId: "proj-1",
      },
    });
    const result = deduplicateContext(ctx);

    expect(result.context).toHaveProperty("issueId", "issue-1");
    expect(result.context).toHaveProperty("projectId", "proj-1");
    expect(Object.keys(result.context)).toHaveLength(2);
  });
});
