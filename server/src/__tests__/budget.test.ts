import { describe, expect, it } from "vitest";
import {
  resolveBudget,
  isBudgetExceeded,
  isWindDownThreshold,
} from "../services/budget.js";

describe("resolveBudget", () => {
  it("returns run override when provided", () => {
    const result = resolveBudget({
      runOverride: 50000,
      agentDefault: 100000,
      projectDefault: 200000,
    });
    expect(result).toEqual({
      maxTokens: 50000,
      source: "run",
      windDownThreshold: 0.9,
    });
  });

  it("falls back to agent default when run override is null", () => {
    const result = resolveBudget({
      runOverride: null,
      agentDefault: 100000,
      projectDefault: 200000,
    });
    expect(result).toEqual({
      maxTokens: 100000,
      source: "agent",
      windDownThreshold: 0.9,
    });
  });

  it("falls back to project default when run and agent are null", () => {
    const result = resolveBudget({
      runOverride: null,
      agentDefault: null,
      projectDefault: 200000,
    });
    expect(result).toEqual({
      maxTokens: 200000,
      source: "project",
      windDownThreshold: 0.9,
    });
  });

  it("returns no-budget config when all are null", () => {
    const result = resolveBudget({
      runOverride: null,
      agentDefault: null,
      projectDefault: null,
    });
    expect(result).toEqual({
      maxTokens: null,
      source: "none",
      windDownThreshold: 0.9,
    });
  });

  it("treats runOverride=0 as not set (falls through)", () => {
    const result = resolveBudget({
      runOverride: 0,
      agentDefault: 100000,
      projectDefault: null,
    });
    expect(result).toEqual({
      maxTokens: 100000,
      source: "agent",
      windDownThreshold: 0.9,
    });
  });

  it("treats negative runOverride as not set (falls through)", () => {
    const result = resolveBudget({
      runOverride: -500,
      agentDefault: null,
      projectDefault: 200000,
    });
    expect(result).toEqual({
      maxTokens: 200000,
      source: "project",
      windDownThreshold: 0.9,
    });
  });

  it("treats agentDefault=0 as not set (falls through)", () => {
    const result = resolveBudget({
      runOverride: null,
      agentDefault: 0,
      projectDefault: 200000,
    });
    expect(result).toEqual({
      maxTokens: 200000,
      source: "project",
      windDownThreshold: 0.9,
    });
  });

  it("treats negative agentDefault as not set (falls through)", () => {
    const result = resolveBudget({
      runOverride: null,
      agentDefault: -100,
      projectDefault: null,
    });
    expect(result).toEqual({
      maxTokens: null,
      source: "none",
      windDownThreshold: 0.9,
    });
  });

  it("treats projectDefault=0 as not set", () => {
    const result = resolveBudget({
      runOverride: null,
      agentDefault: null,
      projectDefault: 0,
    });
    expect(result).toEqual({
      maxTokens: null,
      source: "none",
      windDownThreshold: 0.9,
    });
  });

  it("treats negative projectDefault as not set", () => {
    const result = resolveBudget({
      runOverride: null,
      agentDefault: null,
      projectDefault: -200,
    });
    expect(result).toEqual({
      maxTokens: null,
      source: "none",
      windDownThreshold: 0.9,
    });
  });

  it("per-run override takes precedence over agent default", () => {
    const result = resolveBudget({
      runOverride: 30000,
      agentDefault: 100000,
      projectDefault: null,
    });
    expect(result.maxTokens).toBe(30000);
    expect(result.source).toBe("run");
  });

  it("agent default takes precedence over project default", () => {
    const result = resolveBudget({
      runOverride: null,
      agentDefault: 80000,
      projectDefault: 200000,
    });
    expect(result.maxTokens).toBe(80000);
    expect(result.source).toBe("agent");
  });
});

describe("isBudgetExceeded", () => {
  it("returns true when usedTokens >= maxTokens", () => {
    const budget = { maxTokens: 10000, source: "run" as const, windDownThreshold: 0.9 };
    expect(isBudgetExceeded(budget, 10000)).toBe(true);
  });

  it("returns true when usedTokens > maxTokens", () => {
    const budget = { maxTokens: 10000, source: "run" as const, windDownThreshold: 0.9 };
    expect(isBudgetExceeded(budget, 10001)).toBe(true);
  });

  it("returns false when usedTokens < maxTokens", () => {
    const budget = { maxTokens: 10000, source: "run" as const, windDownThreshold: 0.9 };
    expect(isBudgetExceeded(budget, 9999)).toBe(false);
  });

  it("returns false when maxTokens is null (no budget)", () => {
    const budget = { maxTokens: null, source: "none" as const, windDownThreshold: 0.9 };
    expect(isBudgetExceeded(budget, 999999)).toBe(false);
  });
});

describe("isWindDownThreshold", () => {
  it("returns true when usedTokens >= maxTokens * windDownThreshold", () => {
    const budget = { maxTokens: 10000, source: "run" as const, windDownThreshold: 0.9 };
    // 10000 * 0.9 = 9000
    expect(isWindDownThreshold(budget, 9000)).toBe(true);
  });

  it("returns true when usedTokens above threshold", () => {
    const budget = { maxTokens: 10000, source: "run" as const, windDownThreshold: 0.9 };
    expect(isWindDownThreshold(budget, 9500)).toBe(true);
  });

  it("returns false when usedTokens below threshold", () => {
    const budget = { maxTokens: 10000, source: "run" as const, windDownThreshold: 0.9 };
    expect(isWindDownThreshold(budget, 8999)).toBe(false);
  });

  it("returns false when maxTokens is null (no budget)", () => {
    const budget = { maxTokens: null, source: "none" as const, windDownThreshold: 0.9 };
    expect(isWindDownThreshold(budget, 999999)).toBe(false);
  });
});
