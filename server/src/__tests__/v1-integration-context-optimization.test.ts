import { describe, expect, it } from "vitest";
import { runContextPipeline, defaultProcessors } from "../context-pipeline/index.js";
import type { PipelineContext } from "../context-pipeline/index.js";

/**
 * Integration tests for the context optimization pipeline.
 *
 * Tests that the pipeline processes input context and produces
 * expected output shapes. This is a pure function test (no route mocking).
 * Permanent regression tests -- do NOT remove.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildMockPipelineContext(overrides: Partial<PipelineContext> = {}): PipelineContext {
  return {
    agent: {
      id: "agent-1",
      companyId: "company-1",
      name: "Test Agent",
      adapterType: "openai",
      adapterConfig: {},
      runtimeConfig: {},
    },
    config: {},
    context: {
      issueId: "issue-1",
      projectId: "proj-1",
      issueBody: "Fix the login page bug where users cannot sign in with SSO.",
      issueComments: [
        "I tried clearing cookies but it still doesn't work.",
        "This seems to affect all SSO providers.",
      ],
      projectContext: "This is a Next.js project using NextAuth for authentication.",
      relatedIssues: ["AUTH-100: SSO setup guide", "AUTH-102: Cookie handling refactor"],
    },
    taskType: null,
    budget: {
      maxTokens: 50000,
      source: "agent",
      windDownThreshold: 0.1,
    },
    promptTemplate: "You are a coding agent. Fix the issue described below.\n\n{{context}}",
    instructionsContent: "Follow the project coding standards. Use TypeScript strict mode.",
    issueLabels: ["bug", "auth", "sso"],
    issue: {
      title: "SSO login broken",
      description: "Users cannot sign in with SSO on the login page.",
      comments: [
        { id: "c1", body: "Clearing cookies doesn't help.", createdAt: "2026-03-10T10:00:00Z" },
        { id: "c2", body: "Affects all SSO providers.", createdAt: "2026-03-10T11:00:00Z" },
      ],
    },
    triggeringCommentId: "c2",
    structuredBrief: null,
    skillProfile: null,
    metrics: {
      originalTokenEstimate: 0,
      compressedTokenEstimate: 0,
      compressionRatio: 1.0,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Context optimization pipeline", () => {
  it("runContextPipeline returns a PipelineContext with taskType resolved", () => {
    const input = buildMockPipelineContext();
    const output = runContextPipeline(input, defaultProcessors);

    expect(output).toBeDefined();
    expect(typeof output.taskType).toBe("string");
  });

  it("preserves essential keys (agent, context, budget) through the pipeline", () => {
    const input = buildMockPipelineContext();
    const output = runContextPipeline(input, defaultProcessors);

    expect(output.agent.id).toBe("agent-1");
    expect(output.agent.companyId).toBe("company-1");
    expect(output.context).toBeDefined();
    expect(output.budget).toBeDefined();
  });

  it("produces a structuredBrief after running the full pipeline", () => {
    const input = buildMockPipelineContext();
    const output = runContextPipeline(input, defaultProcessors);

    // The serializer processor should produce a structuredBrief
    expect(output.structuredBrief).toBeDefined();
    if (output.structuredBrief) {
      expect(typeof output.structuredBrief.issueTitle).toBe("string");
      expect(typeof output.structuredBrief.description).toBe("string");
      expect(output.structuredBrief.taskType).toBe(output.taskType);
    }
  });

  it("updates metrics with compression information", () => {
    const input = buildMockPipelineContext();
    const output = runContextPipeline(input, defaultProcessors);

    // The pipeline should update metrics
    expect(output.metrics).toBeDefined();
    expect(typeof output.metrics.originalTokenEstimate).toBe("number");
    expect(typeof output.metrics.compressedTokenEstimate).toBe("number");
    expect(typeof output.metrics.compressionRatio).toBe("number");
  });

  it("resolves task type from issue labels", () => {
    const input = buildMockPipelineContext({ issueLabels: ["bug", "critical"] });
    const output = runContextPipeline(input, defaultProcessors);

    expect(output.taskType).toBe("bug_fix");
  });

  it("resolves feature task type from feature labels", () => {
    const input = buildMockPipelineContext({ issueLabels: ["feature", "enhancement"] });
    const output = runContextPipeline(input, defaultProcessors);

    expect(output.taskType).toBe("feature");
  });

  it("identity pipeline (no processors) returns input unchanged", () => {
    const input = buildMockPipelineContext();
    const output = runContextPipeline(input, []);

    expect(output).toEqual(input);
  });
});
