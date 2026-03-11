import { describe, expect, it } from "vitest";
import {
  runContextPipeline,
  defaultProcessors,
} from "../context-pipeline/index.js";
import type { PipelineContext, Processor } from "../context-pipeline/types.js";
import { TASK_TYPES } from "@paperclipai/shared";

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

describe("TASK_TYPES", () => {
  it("contains all 5 task types", () => {
    expect(TASK_TYPES).toHaveLength(5);
    expect(TASK_TYPES).toContain("bug_fix");
    expect(TASK_TYPES).toContain("feature");
    expect(TASK_TYPES).toContain("review");
    expect(TASK_TYPES).toContain("refactor");
    expect(TASK_TYPES).toContain("generic");
  });
});

describe("runContextPipeline", () => {
  it("returns input unchanged with empty processors", () => {
    const input = makePipelineContext();
    const result = runContextPipeline(input, []);
    expect(result).toEqual(input);
  });

  it("applies processors in order", () => {
    const input = makePipelineContext({
      context: { step: 0 },
    });

    const proc1: Processor = (ctx) => ({
      ...ctx,
      context: { ...ctx.context, step: 1 },
    });
    const proc2: Processor = (ctx) => ({
      ...ctx,
      context: { ...ctx.context, step: (ctx.context.step as number) + 1 },
    });

    const result = runContextPipeline(input, [proc1, proc2]);
    expect(result.context.step).toBe(2);
  });

  it("metrics.compressionRatio defaults to 1 (no compression)", () => {
    const input = makePipelineContext();
    expect(input.metrics.compressionRatio).toBe(1);
  });
});

describe("defaultProcessors", () => {
  it("has 4 entries", () => {
    expect(defaultProcessors).toHaveLength(4);
  });

  it("full pipeline integration: label 'bug' -> bug_fix -> structured brief with 4K limit -> dedup -> reorder", () => {
    // Create a realistic context with a bug issue
    const longDescription = "x".repeat(5000); // longer than 4K to test truncation
    const input = makePipelineContext({
      issueLabels: ["bug"],
      issue: {
        title: "App crashes on login",
        description: longDescription,
        comments: [
          { id: "c1", body: "First comment", createdAt: "2026-01-01T00:00:00Z" },
          { id: "c2", body: "Second comment", createdAt: "2026-01-02T00:00:00Z" },
          { id: "c3", body: "Third comment", createdAt: "2026-01-03T00:00:00Z" },
          { id: "c4", body: "Triggering: please fix this crash", createdAt: "2026-01-04T00:00:00Z" },
        ],
      },
      triggeringCommentId: "c4",
      context: {
        issueId: "issue-123",
        projectId: "proj-1",
        issueTitle: "App crashes on login",
        issueDescription: longDescription,
        comments: "some comments",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-02",
        emptyField: "",
        nullField: null,
        paperclipWorkspace: "/workspace",
      },
    });

    const result = runContextPipeline(input, defaultProcessors);

    // Task type resolved from "bug" label
    expect(result.taskType).toBe("bug_fix");

    // Structured brief exists
    expect(result.structuredBrief).not.toBeNull();
    expect(result.structuredBrief!.issueTitle).toBe("App crashes on login");
    expect(result.structuredBrief!.taskType).toBe("bug_fix");

    // Bug fix gets 4K description limit (4000 - 3 for "...")
    expect(result.structuredBrief!.description.length).toBeLessThanOrEqual(4000);

    // Triggering comment preserved in full
    expect(result.structuredBrief!.triggeringComment).toBe(
      "Triggering: please fix this crash",
    );

    // Deduplicator removed redundant keys
    expect(result.context).not.toHaveProperty("issueTitle");
    expect(result.context).not.toHaveProperty("issueDescription");
    expect(result.context).not.toHaveProperty("comments");

    // Deduplicator removed metadata keys
    expect(result.context).not.toHaveProperty("createdAt");
    expect(result.context).not.toHaveProperty("updatedAt");

    // Deduplicator removed empty/null values
    expect(result.context).not.toHaveProperty("emptyField");
    expect(result.context).not.toHaveProperty("nullField");

    // Essential keys preserved
    expect(result.context).toHaveProperty("issueId", "issue-123");
    expect(result.context).toHaveProperty("projectId", "proj-1");
    expect(result.context).toHaveProperty("paperclipWorkspace", "/workspace");

    // Brief is in context
    expect(result.context).toHaveProperty("_brief");

    // Compression ratio is measured
    expect(result.metrics.originalTokenEstimate).toBeGreaterThan(0);
    expect(result.metrics.compressedTokenEstimate).toBeGreaterThan(0);
    expect(result.metrics.compressionRatio).toBeLessThan(1);
  });
});
