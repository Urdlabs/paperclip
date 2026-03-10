import { describe, expect, it } from "vitest";
import { getContextWindowSize, MODEL_CONTEXT_LIMITS, DEFAULT_CONTEXT_LIMIT } from "@paperclipai/shared";

describe("getContextWindowSize", () => {
  it("returns 200_000 for claude-sonnet-4-6", () => {
    expect(getContextWindowSize("claude-sonnet-4-6")).toBe(200_000);
  });

  it("returns 200_000 for claude-opus-4-6", () => {
    expect(getContextWindowSize("claude-opus-4-6")).toBe(200_000);
  });

  it("returns 200_000 for claude-3-5-sonnet-20241022", () => {
    expect(getContextWindowSize("claude-3-5-sonnet-20241022")).toBe(200_000);
  });

  it("returns 200_000 for claude-3-5-haiku-20241022", () => {
    expect(getContextWindowSize("claude-3-5-haiku-20241022")).toBe(200_000);
  });

  it("returns 200_000 for claude-3-opus-20240229", () => {
    expect(getContextWindowSize("claude-3-opus-20240229")).toBe(200_000);
  });

  it("returns 200_000 for aliases (sonnet, opus, haiku)", () => {
    expect(getContextWindowSize("sonnet")).toBe(200_000);
    expect(getContextWindowSize("opus")).toBe(200_000);
    expect(getContextWindowSize("haiku")).toBe(200_000);
  });

  it("returns DEFAULT_CONTEXT_LIMIT for unknown models", () => {
    expect(getContextWindowSize("unknown-model")).toBe(DEFAULT_CONTEXT_LIMIT);
    expect(getContextWindowSize("gpt-4")).toBe(DEFAULT_CONTEXT_LIMIT);
  });

  it("handles case-insensitive lookup", () => {
    expect(getContextWindowSize("Claude-Sonnet-4-6")).toBe(200_000);
    expect(getContextWindowSize("CLAUDE-OPUS-4-6")).toBe(200_000);
    expect(getContextWindowSize("Sonnet")).toBe(200_000);
  });

  it("handles whitespace in model name", () => {
    expect(getContextWindowSize("  claude-sonnet-4-6  ")).toBe(200_000);
  });
});

describe("MODEL_CONTEXT_LIMITS", () => {
  it("is a record with string keys and number values", () => {
    expect(typeof MODEL_CONTEXT_LIMITS).toBe("object");
    for (const [key, value] of Object.entries(MODEL_CONTEXT_LIMITS)) {
      expect(typeof key).toBe("string");
      expect(typeof value).toBe("number");
    }
  });

  it("contains all expected Claude model entries", () => {
    const expectedModels = [
      "claude-opus-4-6",
      "claude-sonnet-4-6",
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
      "claude-3-opus-20240229",
      "claude-3-sonnet-20240229",
      "claude-3-haiku-20240307",
      "sonnet",
      "opus",
      "haiku",
    ];
    for (const model of expectedModels) {
      expect(MODEL_CONTEXT_LIMITS).toHaveProperty(model);
    }
  });
});

describe("DEFAULT_CONTEXT_LIMIT", () => {
  it("is 200_000", () => {
    expect(DEFAULT_CONTEXT_LIMIT).toBe(200_000);
  });
});
