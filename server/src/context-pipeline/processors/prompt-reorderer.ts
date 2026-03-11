import type { PipelineContext } from "../types.js";

/**
 * Pipeline processor: ensures prompt structure is optimized for Anthropic prefix caching.
 *
 * This processor is structural/documentation rather than a per-run transformation.
 * The actual cache optimization comes from how heartbeat.ts assembles CLI arguments:
 *
 *   Layer 1: Static system prompt (--append-system-prompt-file, stable per agent)
 *   Layer 2: Project context / instructions (stable per agent config)
 *   Layer 3: Task-type template + issue context (changes per issue, stable within run)
 *   Layer 4: Conversation messages (managed by Claude Code, not Paperclip)
 *
 * By keeping layers 1-2 identical across runs for the same agent configuration,
 * Anthropic's automatic prefix caching (5-minute TTL) can match the cached KV
 * representations from previous runs, resulting in ~90% cost reduction on cached input.
 *
 * This processor returns ctx unchanged. The ordering is verified in Plan 03's
 * heartbeat integration.
 */
export function reorderForCaching(ctx: PipelineContext): PipelineContext {
  return ctx;
}
