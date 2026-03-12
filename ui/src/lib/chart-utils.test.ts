import { describe, expect, it } from "vitest";
import { formatChartDate, formatTokenCount, formatCostCents } from "./chart-utils";

describe("formatChartDate", () => {
  it("formats ISO date to Mon DD format", () => {
    expect(formatChartDate("2026-03-01T00:00:00.000Z")).toBe("Mar 1");
  });

  it("formats December date correctly", () => {
    expect(formatChartDate("2026-12-25T00:00:00.000Z")).toBe("Dec 25");
  });
});

describe("formatTokenCount", () => {
  it("returns '0' for zero", () => {
    expect(formatTokenCount(0)).toBe("0");
  });

  it("returns raw number for values under 1000", () => {
    expect(formatTokenCount(500)).toBe("500");
  });

  it("returns K format for thousands", () => {
    expect(formatTokenCount(1500)).toBe("1.5K");
  });

  it("returns M format for millions", () => {
    expect(formatTokenCount(1500000)).toBe("1.5M");
  });
});

describe("formatCostCents", () => {
  it("returns '$0.00' for zero", () => {
    expect(formatCostCents(0)).toBe("$0.00");
  });

  it("formats cents to dollars", () => {
    expect(formatCostCents(150)).toBe("$1.50");
  });

  it("formats large cent amounts", () => {
    expect(formatCostCents(12345)).toBe("$123.45");
  });
});
