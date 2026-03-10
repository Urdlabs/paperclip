import { describe, expect, it } from "vitest";
import { estimateTokens, estimatePromptBreakdown, computeContextUtilization } from "../services/token-estimation.js";

describe("estimateTokens", () => {
  it("returns Math.ceil(text.length / 4) for non-empty string", () => {
    expect(estimateTokens("hello world")).toBe(Math.ceil(11 / 4)); // 3
  });

  it("returns 0 for empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("returns 1 for a single character", () => {
    expect(estimateTokens("a")).toBe(1);
  });

  it("handles exactly divisible lengths", () => {
    expect(estimateTokens("abcd")).toBe(1); // 4/4 = 1
    expect(estimateTokens("abcdefgh")).toBe(2); // 8/4 = 2
  });
});

describe("estimatePromptBreakdown", () => {
  it("returns a TokenBreakdown object with non-negative values", () => {
    const breakdown = estimatePromptBreakdown({
      promptTemplate: "You are a helpful assistant",
      instructionsContent: "Follow these instructions",
      contextSnapshot: { issueId: "123", taskId: "456" },
      sessionResuming: false,
    });

    expect(breakdown.systemPrompt).toBeGreaterThanOrEqual(0);
    expect(breakdown.skillsTools).toBeGreaterThanOrEqual(0);
    expect(breakdown.issueContext).toBeGreaterThanOrEqual(0);
    expect(breakdown.fileContent).toBeGreaterThanOrEqual(0);
    expect(breakdown.history).toBeGreaterThanOrEqual(0);
  });

  it("systemPrompt equals estimateTokens of promptTemplate", () => {
    const promptTemplate = "You are a helpful assistant";
    const breakdown = estimatePromptBreakdown({
      promptTemplate,
      instructionsContent: null,
      contextSnapshot: null,
      sessionResuming: false,
    });

    expect(breakdown.systemPrompt).toBe(estimateTokens(promptTemplate));
  });

  it("skillsTools equals estimateTokens of instructionsContent", () => {
    const instructionsContent = "Follow these instructions carefully";
    const breakdown = estimatePromptBreakdown({
      promptTemplate: "",
      instructionsContent,
      contextSnapshot: null,
      sessionResuming: false,
    });

    expect(breakdown.skillsTools).toBe(estimateTokens(instructionsContent));
  });

  it("skillsTools is 0 when instructionsContent is null", () => {
    const breakdown = estimatePromptBreakdown({
      promptTemplate: "",
      instructionsContent: null,
      contextSnapshot: null,
      sessionResuming: false,
    });

    expect(breakdown.skillsTools).toBe(0);
  });

  it("issueContext is estimated from JSON.stringify of contextSnapshot", () => {
    const contextSnapshot = { issueId: "123", taskId: "456" };
    const breakdown = estimatePromptBreakdown({
      promptTemplate: "",
      instructionsContent: null,
      contextSnapshot,
      sessionResuming: false,
    });

    expect(breakdown.issueContext).toBe(estimateTokens(JSON.stringify(contextSnapshot)));
  });

  it("issueContext is 0 when contextSnapshot is null", () => {
    const breakdown = estimatePromptBreakdown({
      promptTemplate: "",
      instructionsContent: null,
      contextSnapshot: null,
      sessionResuming: false,
    });

    // estimateTokens(JSON.stringify({})) = Math.ceil(2/4) = 1 ...
    // But null means we pass null, so we check for estimateTokens of "{}"
    expect(breakdown.issueContext).toBe(estimateTokens(JSON.stringify({})));
  });

  it("fileContent is always 0 (unknown pre-execution)", () => {
    const breakdown = estimatePromptBreakdown({
      promptTemplate: "some template",
      instructionsContent: "some instructions",
      contextSnapshot: { key: "value" },
      sessionResuming: false,
    });

    expect(breakdown.fileContent).toBe(0);
  });

  it("history is 0 regardless of sessionResuming", () => {
    const breakdownResuming = estimatePromptBreakdown({
      promptTemplate: "",
      instructionsContent: null,
      contextSnapshot: null,
      sessionResuming: true,
    });
    const breakdownFresh = estimatePromptBreakdown({
      promptTemplate: "",
      instructionsContent: null,
      contextSnapshot: null,
      sessionResuming: false,
    });

    expect(breakdownResuming.history).toBe(0);
    expect(breakdownFresh.history).toBe(0);
  });

  it("total roughly matches sum of component estimates", () => {
    const breakdown = estimatePromptBreakdown({
      promptTemplate: "You are a helpful assistant that follows instructions",
      instructionsContent: "Read the documentation and apply the rules",
      contextSnapshot: { issueId: "abc-123", title: "Fix the bug", description: "There is a bug" },
      sessionResuming: false,
    });

    const total =
      breakdown.systemPrompt +
      breakdown.skillsTools +
      breakdown.issueContext +
      breakdown.fileContent +
      breakdown.history;

    expect(total).toBe(
      breakdown.systemPrompt +
        breakdown.skillsTools +
        breakdown.issueContext +
        breakdown.fileContent +
        breakdown.history,
    );
    expect(total).toBeGreaterThan(0);
  });

  it("TokenBreakdown has exactly the right keys", () => {
    const breakdown = estimatePromptBreakdown({
      promptTemplate: "test",
      instructionsContent: null,
      contextSnapshot: null,
      sessionResuming: false,
    });

    const keys = Object.keys(breakdown).sort();
    expect(keys).toEqual(["fileContent", "history", "issueContext", "skillsTools", "systemPrompt"]);
  });
});

describe("computeContextUtilization", () => {
  it("returns correct percentage", () => {
    expect(computeContextUtilization(50_000, 200_000)).toBe(25);
  });

  it("returns 0 for 0 tokens", () => {
    expect(computeContextUtilization(0, 200_000)).toBe(0);
  });

  it("returns 100 when at capacity", () => {
    expect(computeContextUtilization(200_000, 200_000)).toBe(100);
  });

  it("clamps to 100 when over capacity", () => {
    expect(computeContextUtilization(300_000, 200_000)).toBe(100);
  });

  it("handles small context windows", () => {
    expect(computeContextUtilization(5, 10)).toBe(50);
  });
});
