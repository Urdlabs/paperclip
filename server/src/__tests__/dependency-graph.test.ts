import { describe, expect, it } from "vitest";
import {
  topologicalSort,
  validateNoCycle,
  getExecutionWaves,
} from "../services/dependency-graph.js";

describe("topologicalSort", () => {
  it("returns correct order for linear chain A->B->C", () => {
    const ids = ["A", "B", "C"];
    // A depends on nothing, B depends on A, C depends on B
    const edges = [
      { issueId: "B", dependsOnId: "A" },
      { issueId: "C", dependsOnId: "B" },
    ];
    const result = topologicalSort(ids, edges);
    expect(result).toEqual(["A", "B", "C"]);
  });

  it("returns valid order for diamond graph (A->B, A->C, B->D, C->D)", () => {
    const ids = ["A", "B", "C", "D"];
    const edges = [
      { issueId: "B", dependsOnId: "A" },
      { issueId: "C", dependsOnId: "A" },
      { issueId: "D", dependsOnId: "B" },
      { issueId: "D", dependsOnId: "C" },
    ];
    const result = topologicalSort(ids, edges);
    // A must come first, D must come last, B and C in between
    expect(result.indexOf("A")).toBe(0);
    expect(result.indexOf("D")).toBe(3);
    expect(result.indexOf("B")).toBeGreaterThan(result.indexOf("A"));
    expect(result.indexOf("C")).toBeGreaterThan(result.indexOf("A"));
    expect(result.indexOf("B")).toBeLessThan(result.indexOf("D"));
    expect(result.indexOf("C")).toBeLessThan(result.indexOf("D"));
  });

  it("throws 'Cycle detected' for A->B->C->A", () => {
    const ids = ["A", "B", "C"];
    const edges = [
      { issueId: "B", dependsOnId: "A" },
      { issueId: "C", dependsOnId: "B" },
      { issueId: "A", dependsOnId: "C" },
    ];
    expect(() => topologicalSort(ids, edges)).toThrow(
      "Cycle detected in subtask dependencies",
    );
  });

  it("handles single node with no edges", () => {
    const result = topologicalSort(["A"], []);
    expect(result).toEqual(["A"]);
  });

  it("handles disconnected components", () => {
    const ids = ["A", "B", "C", "D"];
    // Two disconnected pairs: A->B and C->D
    const edges = [
      { issueId: "B", dependsOnId: "A" },
      { issueId: "D", dependsOnId: "C" },
    ];
    const result = topologicalSort(ids, edges);
    expect(result).toHaveLength(4);
    expect(result.indexOf("A")).toBeLessThan(result.indexOf("B"));
    expect(result.indexOf("C")).toBeLessThan(result.indexOf("D"));
  });
});

describe("validateNoCycle", () => {
  it("returns true for valid DAG", () => {
    const ids = ["A", "B", "C"];
    const edges = [
      { issueId: "B", dependsOnId: "A" },
      { issueId: "C", dependsOnId: "B" },
    ];
    expect(validateNoCycle(ids, edges)).toBe(true);
  });

  it("returns false for cycle", () => {
    const ids = ["A", "B", "C"];
    const edges = [
      { issueId: "B", dependsOnId: "A" },
      { issueId: "C", dependsOnId: "B" },
      { issueId: "A", dependsOnId: "C" },
    ];
    expect(validateNoCycle(ids, edges)).toBe(false);
  });
});

describe("getExecutionWaves", () => {
  it("groups independent tasks into parallel waves", () => {
    const ids = ["A", "B", "C", "D"];
    const edges = [
      { issueId: "B", dependsOnId: "A" },
      { issueId: "C", dependsOnId: "A" },
      { issueId: "D", dependsOnId: "B" },
      { issueId: "D", dependsOnId: "C" },
    ];
    const waves = getExecutionWaves(ids, edges);
    expect(waves).toHaveLength(3);
    // Wave 1: A (no deps)
    expect(waves[0]).toEqual(["A"]);
    // Wave 2: B and C (both depend only on A)
    expect(waves[1]!.sort()).toEqual(["B", "C"]);
    // Wave 3: D (depends on B and C)
    expect(waves[2]).toEqual(["D"]);
  });

  it("returns single wave when no dependencies", () => {
    const ids = ["A", "B", "C"];
    const waves = getExecutionWaves(ids, []);
    expect(waves).toHaveLength(1);
    expect(waves[0]!.sort()).toEqual(["A", "B", "C"]);
  });

  it("returns each node in own wave for linear chain", () => {
    const ids = ["A", "B", "C"];
    const edges = [
      { issueId: "B", dependsOnId: "A" },
      { issueId: "C", dependsOnId: "B" },
    ];
    const waves = getExecutionWaves(ids, edges);
    expect(waves).toEqual([["A"], ["B"], ["C"]]);
  });

  it("throws for cycles", () => {
    const ids = ["A", "B"];
    const edges = [
      { issueId: "A", dependsOnId: "B" },
      { issueId: "B", dependsOnId: "A" },
    ];
    expect(() => getExecutionWaves(ids, edges)).toThrow(
      "Cycle detected in subtask dependencies",
    );
  });
});
