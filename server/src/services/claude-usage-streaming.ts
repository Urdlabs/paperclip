/**
 * Claude stdout usage parsing and debounced emission.
 *
 * Parses Claude CLI `--output-format stream-json` stdout for usage data
 * and emits debounced WebSocket events via a usage tracker.
 */

interface ParsedUsage {
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
}

/**
 * Parse a single JSON line from Claude stream-json for usage data.
 * Looks for usage in:
 *   - event.usage (top-level usage object)
 *   - event.message?.usage (nested in message_start / assistant events)
 *   - event.result?.usage (nested in result events)
 */
function parseClaudeUsageFromLine(line: string): ParsedUsage | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(trimmed);
  } catch {
    return null;
  }

  if (typeof event !== "object" || event === null) return null;

  // Try each location where usage data may appear
  const usageSources: Array<Record<string, unknown> | undefined> = [
    extractUsageObject(event.usage),
    extractUsageObject((event.message as Record<string, unknown> | undefined)?.usage),
    extractUsageObject((event.result as Record<string, unknown> | undefined)?.usage),
  ];

  for (const usage of usageSources) {
    if (usage) {
      const result: ParsedUsage = {};
      if (typeof usage.input_tokens === "number") result.inputTokens = usage.input_tokens;
      if (typeof usage.output_tokens === "number") result.outputTokens = usage.output_tokens;
      if (typeof usage.cache_read_input_tokens === "number")
        result.cachedInputTokens = usage.cache_read_input_tokens;

      // Only return if we found at least one field
      if (result.inputTokens !== undefined || result.outputTokens !== undefined || result.cachedInputTokens !== undefined) {
        return result;
      }
    }
  }

  return null;
}

function extractUsageObject(val: unknown): Record<string, unknown> | undefined {
  if (typeof val === "object" && val !== null) return val as Record<string, unknown>;
  return undefined;
}

/**
 * Parse a chunk (potentially multiple lines) for usage data.
 * Returns all found usage updates.
 */
export function parseClaudeUsageFromChunk(chunk: string): ParsedUsage[] {
  const lines = chunk.split(/\r?\n/);
  const results: ParsedUsage[] = [];
  for (const line of lines) {
    const parsed = parseClaudeUsageFromLine(line);
    if (parsed) results.push(parsed);
  }
  return results;
}

interface UsageTrackerOptions {
  emitIntervalMs?: number; // default 2000
  onEmit: (usage: { inputTokens: number; outputTokens: number; cachedInputTokens: number }) => void;
  budget?: { maxTokens: number | null; windDownThreshold: number } | null;
  onBudgetWarning?: (
    usage: { inputTokens: number; outputTokens: number; cachedInputTokens: number },
    budget: { maxTokens: number; windDownThreshold: number },
  ) => void;
}

interface UsageTracker {
  processChunk: (chunk: string) => void;
  flush: () => void;
  getCurrent: () => { inputTokens: number; outputTokens: number; cachedInputTokens: number };
  isWindDownTriggered: () => boolean;
}

/**
 * Create a debounced usage tracker that parses chunks and emits at intervals.
 *
 * Maintains cumulative usage state. On each processChunk, parses and takes
 * max of current vs parsed (monotonic increase). Uses timestamp check for
 * debouncing: only calls onEmit if >= emitIntervalMs since last emit AND
 * values changed. flush() emits immediately if values > 0.
 */
export function createUsageTracker(opts: UsageTrackerOptions): UsageTracker {
  const emitIntervalMs = opts.emitIntervalMs ?? 2000;
  const { onEmit } = opts;

  let inputTokens = 0;
  let outputTokens = 0;
  let cachedInputTokens = 0;
  let lastEmitTime = 0;
  let hasEmitted = false;
  let windDownTriggered = false;

  function getCurrent() {
    return { inputTokens, outputTokens, cachedInputTokens };
  }

  function shouldEmit(): boolean {
    const now = Date.now();
    if (!hasEmitted) return true; // first emit is always immediate
    return now - lastEmitTime >= emitIntervalMs;
  }

  function emit() {
    if (inputTokens === 0 && outputTokens === 0 && cachedInputTokens === 0) return;
    lastEmitTime = Date.now();
    hasEmitted = true;
    onEmit(getCurrent());
  }

  function checkBudgetWarning() {
    if (windDownTriggered) return;
    if (!opts.budget?.maxTokens) return;

    const totalUsed = inputTokens + outputTokens;
    const threshold = opts.budget.maxTokens * (opts.budget.windDownThreshold ?? 0.9);
    if (totalUsed >= threshold) {
      windDownTriggered = true;
      opts.onBudgetWarning?.(getCurrent(), {
        maxTokens: opts.budget.maxTokens,
        windDownThreshold: opts.budget.windDownThreshold ?? 0.9,
      });
    }
  }

  function processChunk(chunk: string) {
    const updates = parseClaudeUsageFromChunk(chunk);
    let changed = false;
    for (const u of updates) {
      if (u.inputTokens !== undefined && u.inputTokens > inputTokens) {
        inputTokens = u.inputTokens;
        changed = true;
      }
      if (u.outputTokens !== undefined && u.outputTokens > outputTokens) {
        outputTokens = u.outputTokens;
        changed = true;
      }
      if (u.cachedInputTokens !== undefined && u.cachedInputTokens > cachedInputTokens) {
        cachedInputTokens = u.cachedInputTokens;
        changed = true;
      }
    }
    if (changed) {
      checkBudgetWarning();
      if (shouldEmit()) {
        emit();
      }
    }
  }

  function flush() {
    emit();
  }

  function isWindDownTriggered() {
    return windDownTriggered;
  }

  return { processChunk, flush, getCurrent, isWindDownTriggered };
}
