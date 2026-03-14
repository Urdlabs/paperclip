import { describe, expect, it } from "vitest";
import { computeCacheEfficiencyMetrics, computeCacheEfficiencyPercent } from "./costs";

describe("computeCacheEfficiencyMetrics", () => {
  it("returns uncached/cached totals with cache share percent", () => {
    expect(computeCacheEfficiencyMetrics(400, 1000)).toEqual({
      uncachedInputTokens: 1000,
      cachedInputTokens: 400,
      totalPromptTokens: 1400,
      cacheSharePercent: 28.6,
    });
  });

  it("keeps cached-heavy scenarios understandable", () => {
    expect(computeCacheEfficiencyMetrics(11800000, 1600)).toEqual({
      uncachedInputTokens: 1600,
      cachedInputTokens: 11800000,
      totalPromptTokens: 11801600,
      cacheSharePercent: 100.0,
    });
  });

  it("clamps negative values to zero", () => {
    expect(computeCacheEfficiencyMetrics(-100, 1000)).toEqual({
      uncachedInputTokens: 1000,
      cachedInputTokens: 0,
      totalPromptTokens: 1000,
      cacheSharePercent: 0,
    });
  });
});

describe("computeCacheEfficiencyPercent", () => {
  it("returns 0 when both input and cached are zero", () => {
    expect(computeCacheEfficiencyPercent(0, 0)).toBe(0);
  });

  it("uses total prompt tokens as denominator", () => {
    expect(computeCacheEfficiencyPercent(400, 1000)).toBe(28.6);
  });

  it("stays bounded when cached tokens exceed uncached input", () => {
    expect(computeCacheEfficiencyPercent(39200000, 13100)).toBe(100.0);
  });

  it("clamps negative values to zero", () => {
    expect(computeCacheEfficiencyPercent(-100, 1000)).toBe(0);
    expect(computeCacheEfficiencyPercent(1000, -100)).toBe(100.0);
  });
});
