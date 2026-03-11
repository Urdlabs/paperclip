import { describe, expect, it } from "vitest";
import {
  resolveTaskType,
  inferTaskType,
  DEFAULT_LABEL_MAPPING,
} from "../context-pipeline/processors/task-type-resolver.js";
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

describe("DEFAULT_LABEL_MAPPING", () => {
  it("maps 'bug' to 'bug_fix'", () => {
    expect(DEFAULT_LABEL_MAPPING.bug).toBe("bug_fix");
  });

  it("maps 'fix' to 'bug_fix'", () => {
    expect(DEFAULT_LABEL_MAPPING.fix).toBe("bug_fix");
  });

  it("maps 'feature' to 'feature'", () => {
    expect(DEFAULT_LABEL_MAPPING.feature).toBe("feature");
  });

  it("maps 'enhancement' to 'feature'", () => {
    expect(DEFAULT_LABEL_MAPPING.enhancement).toBe("feature");
  });

  it("maps 'review' to 'review'", () => {
    expect(DEFAULT_LABEL_MAPPING.review).toBe("review");
  });

  it("maps 'code review' to 'review'", () => {
    expect(DEFAULT_LABEL_MAPPING["code review"]).toBe("review");
  });

  it("maps 'refactor' to 'refactor'", () => {
    expect(DEFAULT_LABEL_MAPPING.refactor).toBe("refactor");
  });

  it("maps 'refactoring' to 'refactor'", () => {
    expect(DEFAULT_LABEL_MAPPING.refactoring).toBe("refactor");
  });
});

describe("inferTaskType", () => {
  it("detects bug_fix from 'fix crash' in title", () => {
    expect(inferTaskType({ title: "fix crash on startup", description: null })).toBe("bug_fix");
  });

  it("detects bug_fix from 'bug' in description", () => {
    expect(inferTaskType({ title: "Issue", description: "There is a bug" })).toBe("bug_fix");
  });

  it("detects bug_fix from 'error' in title", () => {
    expect(inferTaskType({ title: "error in login flow", description: null })).toBe("bug_fix");
  });

  it("detects bug_fix from 'broken' in title", () => {
    expect(inferTaskType({ title: "broken tests", description: null })).toBe("bug_fix");
  });

  it("detects bug_fix from 'regression' in description", () => {
    expect(inferTaskType({ title: "Issue", description: "This is a regression" })).toBe("bug_fix");
  });

  it("detects feature from 'add new feature'", () => {
    expect(inferTaskType({ title: "add new feature for auth", description: null })).toBe("feature");
  });

  it("detects feature from 'implement' in title", () => {
    expect(inferTaskType({ title: "implement API endpoint", description: null })).toBe("feature");
  });

  it("detects feature from 'create' in title", () => {
    expect(inferTaskType({ title: "create user dashboard", description: null })).toBe("feature");
  });

  it("detects feature from 'build' in title", () => {
    expect(inferTaskType({ title: "build notification system", description: null })).toBe("feature");
  });

  it("detects review from 'review PR'", () => {
    expect(inferTaskType({ title: "review PR #42", description: null })).toBe("review");
  });

  it("detects review from 'pull request' in description", () => {
    expect(inferTaskType({ title: "Check this", description: "pull request needs review" })).toBe("review");
  });

  it("detects review from 'feedback' in title", () => {
    expect(inferTaskType({ title: "feedback on design", description: null })).toBe("review");
  });

  it("detects refactor from 'refactor' in title", () => {
    expect(inferTaskType({ title: "refactor auth module", description: null })).toBe("refactor");
  });

  it("detects refactor from 'clean up' in description", () => {
    expect(inferTaskType({ title: "Code", description: "clean up the utils" })).toBe("refactor");
  });

  it("detects refactor from 'reorganize' in title", () => {
    expect(inferTaskType({ title: "reorganize project structure", description: null })).toBe("refactor");
  });

  it("detects refactor from 'restructure' in title", () => {
    expect(inferTaskType({ title: "restructure components", description: null })).toBe("refactor");
  });

  it("returns null for ambiguous content", () => {
    expect(inferTaskType({ title: "Update documentation", description: "Some notes" })).toBeNull();
  });

  it("returns null for empty content", () => {
    expect(inferTaskType({ title: "", description: null })).toBeNull();
  });
});

describe("resolveTaskType", () => {
  it("resolves 'bug' label to 'bug_fix'", () => {
    const ctx = makePipelineContext({ issueLabels: ["bug"] });
    const result = resolveTaskType(ctx);
    expect(result.taskType).toBe("bug_fix");
  });

  it("resolves 'feature' label to 'feature'", () => {
    const ctx = makePipelineContext({ issueLabels: ["feature"] });
    const result = resolveTaskType(ctx);
    expect(result.taskType).toBe("feature");
  });

  it("resolves 'review' label to 'review'", () => {
    const ctx = makePipelineContext({ issueLabels: ["review"] });
    const result = resolveTaskType(ctx);
    expect(result.taskType).toBe("review");
  });

  it("resolves 'code review' label to 'review'", () => {
    const ctx = makePipelineContext({ issueLabels: ["code review"] });
    const result = resolveTaskType(ctx);
    expect(result.taskType).toBe("review");
  });

  it("resolves 'refactor' label to 'refactor'", () => {
    const ctx = makePipelineContext({ issueLabels: ["refactor"] });
    const result = resolveTaskType(ctx);
    expect(result.taskType).toBe("refactor");
  });

  it("resolves 'refactoring' label to 'refactor'", () => {
    const ctx = makePipelineContext({ issueLabels: ["refactoring"] });
    const result = resolveTaskType(ctx);
    expect(result.taskType).toBe("refactor");
  });

  it("is case-insensitive for label matching", () => {
    const ctx = makePipelineContext({ issueLabels: ["BUG"] });
    const result = resolveTaskType(ctx);
    expect(result.taskType).toBe("bug_fix");
  });

  it("is case-insensitive: mixed case", () => {
    const ctx = makePipelineContext({ issueLabels: ["Feature"] });
    const result = resolveTaskType(ctx);
    expect(result.taskType).toBe("feature");
  });

  it("first matching label wins when multiple labels present", () => {
    const ctx = makePipelineContext({ issueLabels: ["feature", "bug"] });
    const result = resolveTaskType(ctx);
    expect(result.taskType).toBe("feature");
  });

  it("skips unknown labels and matches known ones", () => {
    const ctx = makePipelineContext({ issueLabels: ["priority:high", "bug"] });
    const result = resolveTaskType(ctx);
    expect(result.taskType).toBe("bug_fix");
  });

  it("falls back to auto-detection when no labels match", () => {
    const ctx = makePipelineContext({
      issueLabels: ["priority:high"],
      issue: {
        title: "Fix crash on login",
        description: null,
        comments: [],
      },
    });
    const result = resolveTaskType(ctx);
    expect(result.taskType).toBe("bug_fix");
  });

  it("returns null taskType when no labels and null issue", () => {
    const ctx = makePipelineContext({
      issueLabels: [],
      issue: null,
    });
    const result = resolveTaskType(ctx);
    expect(result.taskType).toBeNull();
  });

  it("returns null taskType when no labels and ambiguous issue content", () => {
    const ctx = makePipelineContext({
      issueLabels: [],
      issue: {
        title: "Update documentation",
        description: "Some general notes",
        comments: [],
      },
    });
    const result = resolveTaskType(ctx);
    expect(result.taskType).toBeNull();
  });

  it("operator override via runtimeConfig.labelMapping overrides default", () => {
    const ctx = makePipelineContext({
      agent: {
        id: "agent-1",
        companyId: "company-1",
        name: "Test Agent",
        adapterType: "claude_local",
        adapterConfig: {},
        runtimeConfig: {
          labelMapping: {
            bug: "feature", // Override: "bug" label now maps to "feature"
          },
        },
      },
      issueLabels: ["bug"],
    });
    const result = resolveTaskType(ctx);
    expect(result.taskType).toBe("feature");
  });

  it("operator override adds new label mappings", () => {
    const ctx = makePipelineContext({
      agent: {
        id: "agent-1",
        companyId: "company-1",
        name: "Test Agent",
        adapterType: "claude_local",
        adapterConfig: {},
        runtimeConfig: {
          labelMapping: {
            hotfix: "bug_fix", // New mapping not in defaults
          },
        },
      },
      issueLabels: ["hotfix"],
    });
    const result = resolveTaskType(ctx);
    expect(result.taskType).toBe("bug_fix");
  });

  it("operator override does not remove default mappings", () => {
    const ctx = makePipelineContext({
      agent: {
        id: "agent-1",
        companyId: "company-1",
        name: "Test Agent",
        adapterType: "claude_local",
        adapterConfig: {},
        runtimeConfig: {
          labelMapping: {
            hotfix: "bug_fix",
          },
        },
      },
      issueLabels: ["feature"],
    });
    const result = resolveTaskType(ctx);
    expect(result.taskType).toBe("feature");
  });

  it("ignores non-object labelMapping in runtimeConfig", () => {
    const ctx = makePipelineContext({
      agent: {
        id: "agent-1",
        companyId: "company-1",
        name: "Test Agent",
        adapterType: "claude_local",
        adapterConfig: {},
        runtimeConfig: {
          labelMapping: "invalid",
        },
      },
      issueLabels: ["bug"],
    });
    const result = resolveTaskType(ctx);
    expect(result.taskType).toBe("bug_fix");
  });

  it("ignores array labelMapping in runtimeConfig", () => {
    const ctx = makePipelineContext({
      agent: {
        id: "agent-1",
        companyId: "company-1",
        name: "Test Agent",
        adapterType: "claude_local",
        adapterConfig: {},
        runtimeConfig: {
          labelMapping: ["bug", "feature"],
        },
      },
      issueLabels: ["bug"],
    });
    const result = resolveTaskType(ctx);
    expect(result.taskType).toBe("bug_fix");
  });
});
