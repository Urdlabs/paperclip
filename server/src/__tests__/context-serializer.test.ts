import { describe, expect, it } from "vitest";
import { serializeContext } from "../context-pipeline/processors/context-serializer.js";
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

describe("serializeContext", () => {
  it("returns ctx unchanged when issue is null", () => {
    const ctx = makePipelineContext({ issue: null });
    const result = serializeContext(ctx);
    expect(result).toEqual(ctx);
  });

  it("produces a StructuredBrief from issue data", () => {
    const ctx = makePipelineContext({
      issue: {
        title: "Fix the login bug",
        description: "Users cannot log in",
        comments: [
          { id: "c1", body: "First comment", createdAt: "2026-01-01T00:00:00Z" },
        ],
      },
      triggeringCommentId: null,
    });
    const result = serializeContext(ctx);

    expect(result.structuredBrief).not.toBeNull();
    expect(result.structuredBrief!.issueTitle).toBe("Fix the login bug");
    expect(result.structuredBrief!.description).toBe("Users cannot log in");
  });

  it("truncates description to ~2K chars for non-bug tasks", () => {
    const longDescription = "x".repeat(3000);
    const ctx = makePipelineContext({
      taskType: "feature",
      issue: {
        title: "Add feature",
        description: longDescription,
        comments: [],
      },
    });
    const result = serializeContext(ctx);

    expect(result.structuredBrief!.description.length).toBeLessThanOrEqual(2000);
    expect(result.structuredBrief!.description).toMatch(/\.\.\.$/);
  });

  it("truncates description to ~4K chars for bug_fix tasks", () => {
    const longDescription = "x".repeat(5000);
    const ctx = makePipelineContext({
      taskType: "bug_fix",
      issue: {
        title: "Fix crash",
        description: longDescription,
        comments: [],
      },
    });
    const result = serializeContext(ctx);

    expect(result.structuredBrief!.description.length).toBeLessThanOrEqual(4000);
    expect(result.structuredBrief!.description).toMatch(/\.\.\.$/);
  });

  it("does not truncate description under the limit", () => {
    const shortDescription = "Short description";
    const ctx = makePipelineContext({
      taskType: "feature",
      issue: {
        title: "Add feature",
        description: shortDescription,
        comments: [],
      },
    });
    const result = serializeContext(ctx);

    expect(result.structuredBrief!.description).toBe("Short description");
  });

  it("truncates comments to ~500 chars for non-bug tasks", () => {
    const longComment = "y".repeat(800);
    const ctx = makePipelineContext({
      taskType: "feature",
      issue: {
        title: "Feature",
        description: null,
        comments: [
          { id: "c1", body: longComment, createdAt: "2026-01-01T00:00:00Z" },
        ],
      },
    });
    const result = serializeContext(ctx);

    expect(result.structuredBrief!.recentComments[0].length).toBeLessThanOrEqual(500);
    expect(result.structuredBrief!.recentComments[0]).toMatch(/\.\.\.$/);
  });

  it("truncates comments to ~800 chars for bug_fix tasks", () => {
    const longComment = "y".repeat(1000);
    const ctx = makePipelineContext({
      taskType: "bug_fix",
      issue: {
        title: "Fix bug",
        description: null,
        comments: [
          { id: "c1", body: longComment, createdAt: "2026-01-01T00:00:00Z" },
        ],
      },
    });
    const result = serializeContext(ctx);

    expect(result.structuredBrief!.recentComments[0].length).toBeLessThanOrEqual(800);
    expect(result.structuredBrief!.recentComments[0]).toMatch(/\.\.\.$/);
  });

  it("only keeps last 3 non-triggering comments", () => {
    const ctx = makePipelineContext({
      issue: {
        title: "Issue",
        description: null,
        comments: [
          { id: "c1", body: "Comment 1", createdAt: "2026-01-01T00:00:00Z" },
          { id: "c2", body: "Comment 2", createdAt: "2026-01-02T00:00:00Z" },
          { id: "c3", body: "Comment 3", createdAt: "2026-01-03T00:00:00Z" },
          { id: "c4", body: "Comment 4", createdAt: "2026-01-04T00:00:00Z" },
          { id: "c5", body: "Triggering", createdAt: "2026-01-05T00:00:00Z" },
        ],
      },
      triggeringCommentId: "c5",
    });
    const result = serializeContext(ctx);

    expect(result.structuredBrief!.recentComments).toHaveLength(3);
    // Last 3 non-triggering: c2, c3, c4
    expect(result.structuredBrief!.recentComments[0]).toBe("Comment 2");
    expect(result.structuredBrief!.recentComments[1]).toBe("Comment 3");
    expect(result.structuredBrief!.recentComments[2]).toBe("Comment 4");
  });

  it("preserves triggering comment in full", () => {
    const longTrigger = "z".repeat(2000);
    const ctx = makePipelineContext({
      issue: {
        title: "Issue",
        description: null,
        comments: [
          { id: "c1", body: longTrigger, createdAt: "2026-01-01T00:00:00Z" },
        ],
      },
      triggeringCommentId: "c1",
    });
    const result = serializeContext(ctx);

    expect(result.structuredBrief!.triggeringComment).toBe(longTrigger);
    expect(result.structuredBrief!.triggeringComment.length).toBe(2000);
  });

  it("sets triggeringComment to empty string when no triggering comment", () => {
    const ctx = makePipelineContext({
      issue: {
        title: "Issue",
        description: null,
        comments: [
          { id: "c1", body: "Comment", createdAt: "2026-01-01T00:00:00Z" },
        ],
      },
      triggeringCommentId: null,
    });
    const result = serializeContext(ctx);

    expect(result.structuredBrief!.triggeringComment).toBe("");
  });

  it("replaces context with compacted version containing _brief", () => {
    const ctx = makePipelineContext({
      issue: {
        title: "Issue",
        description: "Description",
        comments: [],
      },
      context: {
        issueId: "issue-1",
        projectId: "proj-1",
        issueTitle: "Issue",
        issueDescription: "Description",
        randomField: "value",
        paperclipWorkspace: "/workspace",
      },
    });
    const result = serializeContext(ctx);

    // Essential keys preserved
    expect(result.context).toHaveProperty("issueId", "issue-1");
    expect(result.context).toHaveProperty("projectId", "proj-1");
    expect(result.context).toHaveProperty("paperclipWorkspace", "/workspace");

    // Brief added
    expect(result.context).toHaveProperty("_brief");

    // Non-essential keys removed
    expect(result.context).not.toHaveProperty("randomField");
    expect(result.context).not.toHaveProperty("issueTitle");
    expect(result.context).not.toHaveProperty("issueDescription");
  });

  it("measures compression ratio correctly", () => {
    const ctx = makePipelineContext({
      issue: {
        title: "Issue",
        description: "A".repeat(5000),
        comments: [
          { id: "c1", body: "B".repeat(2000), createdAt: "2026-01-01T00:00:00Z" },
          { id: "c2", body: "C".repeat(2000), createdAt: "2026-01-02T00:00:00Z" },
        ],
      },
      context: {
        issueId: "issue-1",
        issueTitle: "Issue",
        issueDescription: "A".repeat(5000),
        comments: "B".repeat(2000) + "C".repeat(2000),
        lotsOfData: "D".repeat(3000),
      },
    });
    const result = serializeContext(ctx);

    expect(result.metrics.originalTokenEstimate).toBeGreaterThan(0);
    expect(result.metrics.compressedTokenEstimate).toBeGreaterThan(0);
    expect(result.metrics.compressionRatio).toBeLessThan(1);
    expect(result.metrics.compressionRatio).toBeGreaterThan(0);
  });

  it("handles null description in issue", () => {
    const ctx = makePipelineContext({
      issue: {
        title: "No description issue",
        description: null,
        comments: [],
      },
    });
    const result = serializeContext(ctx);

    expect(result.structuredBrief!.description).toBe("");
  });

  it("sets taskType on the structured brief", () => {
    const ctx = makePipelineContext({
      taskType: "bug_fix",
      issue: {
        title: "Fix bug",
        description: null,
        comments: [],
      },
    });
    const result = serializeContext(ctx);

    expect(result.structuredBrief!.taskType).toBe("bug_fix");
  });

  it("uses generic truncation limits when taskType is null", () => {
    const longDescription = "x".repeat(3000);
    const ctx = makePipelineContext({
      taskType: null,
      issue: {
        title: "Some issue",
        description: longDescription,
        comments: [],
      },
    });
    const result = serializeContext(ctx);

    // Generic uses 2K limit
    expect(result.structuredBrief!.description.length).toBeLessThanOrEqual(2000);
  });
});
