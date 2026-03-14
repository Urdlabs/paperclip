import { describe, expect, it } from "vitest";
import { computeCacheEfficiencyPercent } from "./costs";

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
