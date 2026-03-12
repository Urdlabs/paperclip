import { describe, expect, it } from "vitest";
import { BUILTIN_SKILL_PROFILE_SLUGS } from "@paperclipai/shared";
import { resolveSkillProfile } from "../context-pipeline/processors/skill-profile-resolver.js";
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

describe("resolveSkillProfile", () => {
  it("returns context unchanged when no skillProfile is set", () => {
    const ctx = makePipelineContext();
    const result = resolveSkillProfile(ctx);
    expect(result.promptTemplate).toBe("You are a helpful assistant.");
  });

  it("returns context unchanged when skillProfile is null", () => {
    const ctx = makePipelineContext({
      skillProfile: null,
    });
    const result = resolveSkillProfile(ctx);
    expect(result.promptTemplate).toBe("You are a helpful assistant.");
  });

  it("appends skill profile section to promptTemplate when profile is resolved", () => {
    const ctx = makePipelineContext({
      skillProfile: {
        name: "Refactor",
        systemPromptAdditions: "Focus on code quality, reduce complexity.",
      },
    });
    const result = resolveSkillProfile(ctx);
    expect(result.promptTemplate).toContain("## Skill Profile: Refactor");
    expect(result.promptTemplate).toContain("Focus on code quality, reduce complexity.");
  });

  it("preserves original promptTemplate content (augments, not replaces)", () => {
    const ctx = makePipelineContext({
      promptTemplate: "You are a helpful assistant.",
      skillProfile: {
        name: "Debugger",
        systemPromptAdditions: "Systematic diagnosis approach.",
      },
    });
    const result = resolveSkillProfile(ctx);
    expect(result.promptTemplate).toContain("You are a helpful assistant.");
    expect(result.promptTemplate).toContain("## Skill Profile: Debugger");
    expect(result.promptTemplate).toContain("Systematic diagnosis approach.");
  });

  it("includes profile name and systemPromptAdditions in the section", () => {
    const ctx = makePipelineContext({
      skillProfile: {
        name: "Test Writer",
        systemPromptAdditions: "Write comprehensive tests.",
      },
    });
    const result = resolveSkillProfile(ctx);
    expect(result.promptTemplate).toMatch(/## Skill Profile: Test Writer\nWrite comprehensive tests\./);
  });

  it("appends outputFormatHints when present", () => {
    const ctx = makePipelineContext({
      skillProfile: {
        name: "Reviewer",
        systemPromptAdditions: "Analyze code for bugs.",
        outputFormatHints: "Use structured feedback with severity levels.",
      },
    });
    const result = resolveSkillProfile(ctx);
    expect(result.promptTemplate).toContain("### Output Format");
    expect(result.promptTemplate).toContain("Use structured feedback with severity levels.");
  });

  it("does not include output format section when outputFormatHints is absent", () => {
    const ctx = makePipelineContext({
      skillProfile: {
        name: "Architect",
        systemPromptAdditions: "Focus on system design.",
      },
    });
    const result = resolveSkillProfile(ctx);
    expect(result.promptTemplate).not.toContain("### Output Format");
  });
});

describe("BUILTIN_SKILL_PROFILE_SLUGS constant", () => {
  it("contains 6 profiles with correct slugs", () => {
    expect(BUILTIN_SKILL_PROFILE_SLUGS).toEqual([
      "refactor",
      "test-writer",
      "reviewer",
      "debugger",
      "architect",
      "documentation-writer",
    ]);
    expect(BUILTIN_SKILL_PROFILE_SLUGS).toHaveLength(6);
  });
});
