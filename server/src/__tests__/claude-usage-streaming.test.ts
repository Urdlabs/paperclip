import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  parseClaudeUsageFromChunk,
  createUsageTracker,
} from "../services/claude-usage-streaming.js";

describe("parseClaudeUsageFromChunk", () => {
  it("extracts input_tokens from message.usage (message_start event)", () => {
    const chunk = JSON.stringify({
      type: "assistant",
      message: { usage: { input_tokens: 1500 } },
    });
    const results = parseClaudeUsageFromChunk(chunk);
    expect(results).toHaveLength(1);
    expect(results[0]!.inputTokens).toBe(1500);
  });

  it("extracts output_tokens from top-level usage (message_delta event)", () => {
    const chunk = JSON.stringify({
      type: "message_delta",
      usage: { output_tokens: 500 },
    });
    const results = parseClaudeUsageFromChunk(chunk);
    expect(results).toHaveLength(1);
    expect(results[0]!.outputTokens).toBe(500);
  });

  it("extracts cache_read_input_tokens from usage objects", () => {
    const chunk = JSON.stringify({
      message: { usage: { input_tokens: 2000, cache_read_input_tokens: 1200 } },
    });
    const results = parseClaudeUsageFromChunk(chunk);
    expect(results).toHaveLength(1);
    expect(results[0]!.inputTokens).toBe(2000);
    expect(results[0]!.cachedInputTokens).toBe(1200);
  });

  it("extracts usage from result events", () => {
    const chunk = JSON.stringify({
      type: "result",
      result: { usage: { input_tokens: 3000, output_tokens: 800, cache_read_input_tokens: 500 } },
    });
    const results = parseClaudeUsageFromChunk(chunk);
    expect(results).toHaveLength(1);
    expect(results[0]!.inputTokens).toBe(3000);
    expect(results[0]!.outputTokens).toBe(800);
    expect(results[0]!.cachedInputTokens).toBe(500);
  });

  it("returns empty array for non-JSON lines", () => {
    const results = parseClaudeUsageFromChunk("this is not json");
    expect(results).toHaveLength(0);
  });

  it("returns empty array for JSON without usage data", () => {
    const chunk = JSON.stringify({ type: "system", subtype: "init" });
    const results = parseClaudeUsageFromChunk(chunk);
    expect(results).toHaveLength(0);
  });

  it("handles multi-line chunks (multiple JSON lines separated by newlines)", () => {
    const line1 = JSON.stringify({ message: { usage: { input_tokens: 1000 } } });
    const line2 = JSON.stringify({ usage: { output_tokens: 200 } });
    const line3 = JSON.stringify({ type: "system" }); // no usage
    const chunk = `${line1}\n${line2}\n${line3}`;
    const results = parseClaudeUsageFromChunk(chunk);
    expect(results).toHaveLength(2);
    expect(results[0]!.inputTokens).toBe(1000);
    expect(results[1]!.outputTokens).toBe(200);
  });

  it("handles empty lines gracefully", () => {
    const line1 = JSON.stringify({ usage: { input_tokens: 100 } });
    const chunk = `\n${line1}\n\n`;
    const results = parseClaudeUsageFromChunk(chunk);
    expect(results).toHaveLength(1);
    expect(results[0]!.inputTokens).toBe(100);
  });
});

describe("createUsageTracker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces: calling processChunk multiple times rapidly only calls the emitter once within the interval", () => {
    const onEmit = vi.fn();
    const tracker = createUsageTracker({ emitIntervalMs: 2000, onEmit });

    // Process multiple chunks rapidly
    tracker.processChunk(JSON.stringify({ message: { usage: { input_tokens: 100 } } }));
    tracker.processChunk(JSON.stringify({ usage: { output_tokens: 50 } }));
    tracker.processChunk(JSON.stringify({ usage: { output_tokens: 100 } }));

    // First processChunk should trigger an emit (first time, no prior emit)
    // But subsequent calls within the interval should not
    expect(onEmit).toHaveBeenCalledTimes(1);
    expect(onEmit).toHaveBeenCalledWith({
      inputTokens: 100,
      outputTokens: 0,
      cachedInputTokens: 0,
    });

    // After the interval, next processChunk should emit
    vi.advanceTimersByTime(2000);
    tracker.processChunk(JSON.stringify({ usage: { output_tokens: 200 } }));
    expect(onEmit).toHaveBeenCalledTimes(2);
    expect(onEmit).toHaveBeenLastCalledWith({
      inputTokens: 100,
      outputTokens: 200,
      cachedInputTokens: 0,
    });
  });

  it("accumulates: cumulative token counts increase monotonically (takes max of current and parsed)", () => {
    const onEmit = vi.fn();
    const tracker = createUsageTracker({ emitIntervalMs: 0, onEmit });

    tracker.processChunk(JSON.stringify({ message: { usage: { input_tokens: 1000 } } }));
    tracker.processChunk(JSON.stringify({ usage: { output_tokens: 500 } }));

    // Now try to "decrease" -- should keep max
    tracker.processChunk(JSON.stringify({ message: { usage: { input_tokens: 800 } } }));

    const current = tracker.getCurrent();
    expect(current.inputTokens).toBe(1000); // kept max
    expect(current.outputTokens).toBe(500);
  });

  it("flush() forces emission of current state regardless of debounce timer", () => {
    const onEmit = vi.fn();
    const tracker = createUsageTracker({ emitIntervalMs: 10000, onEmit });

    tracker.processChunk(JSON.stringify({ message: { usage: { input_tokens: 500 } } }));
    // First call emits immediately
    expect(onEmit).toHaveBeenCalledTimes(1);

    // Process another chunk -- should be debounced
    tracker.processChunk(JSON.stringify({ usage: { output_tokens: 200 } }));
    expect(onEmit).toHaveBeenCalledTimes(1); // still 1 due to debounce

    // Flush should force an emit
    tracker.flush();
    expect(onEmit).toHaveBeenCalledTimes(2);
    expect(onEmit).toHaveBeenLastCalledWith({
      inputTokens: 500,
      outputTokens: 200,
      cachedInputTokens: 0,
    });
  });

  it("flush() does not emit if no usage data has been accumulated", () => {
    const onEmit = vi.fn();
    const tracker = createUsageTracker({ emitIntervalMs: 2000, onEmit });

    tracker.flush();
    expect(onEmit).not.toHaveBeenCalled();
  });

  it("getCurrent() returns the current cumulative state", () => {
    const onEmit = vi.fn();
    const tracker = createUsageTracker({ emitIntervalMs: 2000, onEmit });

    expect(tracker.getCurrent()).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
    });

    tracker.processChunk(
      JSON.stringify({ message: { usage: { input_tokens: 800, cache_read_input_tokens: 300 } } }),
    );
    expect(tracker.getCurrent()).toEqual({
      inputTokens: 800,
      outputTokens: 0,
      cachedInputTokens: 300,
    });
  });

  it("defaults to 2000ms emit interval", () => {
    const onEmit = vi.fn();
    const tracker = createUsageTracker({ onEmit });

    tracker.processChunk(JSON.stringify({ message: { usage: { input_tokens: 100 } } }));
    expect(onEmit).toHaveBeenCalledTimes(1); // first emit is immediate

    // Rapid subsequent calls should be debounced
    tracker.processChunk(JSON.stringify({ usage: { output_tokens: 50 } }));
    expect(onEmit).toHaveBeenCalledTimes(1); // debounced

    // Advance less than 2000ms
    vi.advanceTimersByTime(1999);
    tracker.processChunk(JSON.stringify({ usage: { output_tokens: 100 } }));
    expect(onEmit).toHaveBeenCalledTimes(1); // still debounced

    // Advance to 2000ms total
    vi.advanceTimersByTime(1);
    tracker.processChunk(JSON.stringify({ usage: { output_tokens: 150 } }));
    expect(onEmit).toHaveBeenCalledTimes(2); // now emitted
  });
});

describe("createUsageTracker budget warning", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires onBudgetWarning when cumulative usage crosses 90% threshold", () => {
    const onEmit = vi.fn();
    const onBudgetWarning = vi.fn();
    const tracker = createUsageTracker({
      emitIntervalMs: 0,
      onEmit,
      budget: { maxTokens: 10000, windDownThreshold: 0.9 },
      onBudgetWarning,
    });

    // 5000 input + 4000 output = 9000, which is exactly 90% of 10000
    tracker.processChunk(JSON.stringify({ message: { usage: { input_tokens: 5000 } } }));
    expect(onBudgetWarning).not.toHaveBeenCalled();

    tracker.processChunk(JSON.stringify({ usage: { output_tokens: 4000 } }));
    expect(onBudgetWarning).toHaveBeenCalledTimes(1);
    expect(onBudgetWarning).toHaveBeenCalledWith(
      { inputTokens: 5000, outputTokens: 4000, cachedInputTokens: 0 },
      { maxTokens: 10000, windDownThreshold: 0.9 },
    );
  });

  it("fires onBudgetWarning exactly once even with multiple chunks above threshold", () => {
    const onEmit = vi.fn();
    const onBudgetWarning = vi.fn();
    const tracker = createUsageTracker({
      emitIntervalMs: 0,
      onEmit,
      budget: { maxTokens: 10000, windDownThreshold: 0.9 },
      onBudgetWarning,
    });

    // First chunk crosses threshold: 9500 >= 9000
    tracker.processChunk(JSON.stringify({ message: { usage: { input_tokens: 9500 } } }));
    expect(onBudgetWarning).toHaveBeenCalledTimes(1);

    // Second chunk still above threshold but should NOT fire again
    tracker.processChunk(JSON.stringify({ usage: { output_tokens: 1000 } }));
    expect(onBudgetWarning).toHaveBeenCalledTimes(1);
  });

  it("does not call onBudgetWarning when budget is null", () => {
    const onEmit = vi.fn();
    const onBudgetWarning = vi.fn();
    const tracker = createUsageTracker({
      emitIntervalMs: 0,
      onEmit,
      budget: null,
      onBudgetWarning,
    });

    tracker.processChunk(JSON.stringify({ message: { usage: { input_tokens: 999999 } } }));
    expect(onBudgetWarning).not.toHaveBeenCalled();
  });

  it("does not call onBudgetWarning when budget.maxTokens is null", () => {
    const onEmit = vi.fn();
    const onBudgetWarning = vi.fn();
    const tracker = createUsageTracker({
      emitIntervalMs: 0,
      onEmit,
      budget: { maxTokens: null, windDownThreshold: 0.9 },
      onBudgetWarning,
    });

    tracker.processChunk(JSON.stringify({ message: { usage: { input_tokens: 999999 } } }));
    expect(onBudgetWarning).not.toHaveBeenCalled();
  });

  it("does not call onBudgetWarning when usage is below threshold", () => {
    const onEmit = vi.fn();
    const onBudgetWarning = vi.fn();
    const tracker = createUsageTracker({
      emitIntervalMs: 0,
      onEmit,
      budget: { maxTokens: 10000, windDownThreshold: 0.9 },
      onBudgetWarning,
    });

    // 4000 input + 4999 output = 8999, below 9000 threshold
    tracker.processChunk(JSON.stringify({ message: { usage: { input_tokens: 4000 } } }));
    tracker.processChunk(JSON.stringify({ usage: { output_tokens: 4999 } }));
    expect(onBudgetWarning).not.toHaveBeenCalled();
  });

  it("isWindDownTriggered returns true after warning fires", () => {
    const onEmit = vi.fn();
    const onBudgetWarning = vi.fn();
    const tracker = createUsageTracker({
      emitIntervalMs: 0,
      onEmit,
      budget: { maxTokens: 10000, windDownThreshold: 0.9 },
      onBudgetWarning,
    });

    expect(tracker.isWindDownTriggered()).toBe(false);

    // Cross threshold
    tracker.processChunk(JSON.stringify({ message: { usage: { input_tokens: 9500 } } }));
    expect(tracker.isWindDownTriggered()).toBe(true);
  });

  it("uses inputTokens + outputTokens as total for budget check", () => {
    const onEmit = vi.fn();
    const onBudgetWarning = vi.fn();
    const tracker = createUsageTracker({
      emitIntervalMs: 0,
      onEmit,
      budget: { maxTokens: 10000, windDownThreshold: 0.9 },
      onBudgetWarning,
    });

    // 4500 input alone does not trigger (below 9000)
    tracker.processChunk(JSON.stringify({ message: { usage: { input_tokens: 4500 } } }));
    expect(onBudgetWarning).not.toHaveBeenCalled();

    // 4500 input + 4500 output = 9000, exactly at threshold
    tracker.processChunk(JSON.stringify({ usage: { output_tokens: 4500 } }));
    expect(onBudgetWarning).toHaveBeenCalledTimes(1);
  });

  it("does not call onBudgetWarning when no budget option is provided", () => {
    const onEmit = vi.fn();
    const onBudgetWarning = vi.fn();
    const tracker = createUsageTracker({
      emitIntervalMs: 0,
      onEmit,
      onBudgetWarning,
    });

    tracker.processChunk(JSON.stringify({ message: { usage: { input_tokens: 999999 } } }));
    expect(onBudgetWarning).not.toHaveBeenCalled();
  });
});
