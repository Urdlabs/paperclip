import { describe, expect, it } from "vitest";
import { deriveSeverity, SEVERITY_LEVELS } from "./severity";

describe("deriveSeverity", () => {
  it('returns "error" for actions containing "failed"', () => {
    expect(deriveSeverity("run.failed")).toBe("error");
  });

  it('returns "error" for actions containing "error"', () => {
    expect(deriveSeverity("run.error")).toBe("error");
  });

  it('returns "warning" for actions containing "budget"', () => {
    expect(deriveSeverity("agent.budget_updated")).toBe("warning");
  });

  it('returns "warning" for actions containing "budget_warning"', () => {
    expect(deriveSeverity("run.budget_warning")).toBe("warning");
  });

  it('returns "info" for "run.started"', () => {
    expect(deriveSeverity("run.started")).toBe("info");
  });

  it('returns "info" for "run.completed"', () => {
    expect(deriveSeverity("run.completed")).toBe("info");
  });

  it('returns "info" for "issue.created"', () => {
    expect(deriveSeverity("issue.created")).toBe("info");
  });

  it('returns "info" for "issue.updated"', () => {
    expect(deriveSeverity("issue.updated")).toBe("info");
  });

  it('returns "info" for "cost.reported"', () => {
    expect(deriveSeverity("cost.reported")).toBe("info");
  });

  it('returns "info" for undefined', () => {
    expect(deriveSeverity(undefined)).toBe("info");
  });

  it('returns "info" for null', () => {
    expect(deriveSeverity(null)).toBe("info");
  });

  it('returns "info" for unknown actions (default)', () => {
    expect(deriveSeverity("unknown.action")).toBe("info");
  });

  it('returns "warning" for actions containing "retry"', () => {
    expect(deriveSeverity("run.retry")).toBe("warning");
  });

  it('returns "warning" for actions containing "slow"', () => {
    expect(deriveSeverity("run.slow_response")).toBe("warning");
  });
});

describe("SEVERITY_LEVELS", () => {
  it("contains info, warning, and error in order", () => {
    expect(SEVERITY_LEVELS).toEqual(["info", "warning", "error"]);
  });
});
