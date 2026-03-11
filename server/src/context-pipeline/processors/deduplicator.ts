import type { PipelineContext } from "../types.js";
import { estimateTokens } from "../../services/token-estimation.js";

/**
 * Context keys that are fully captured in the structured brief
 * and can be safely removed from top-level context.
 */
const BRIEF_REDUNDANT_KEYS = new Set([
  "issueTitle",
  "issueDescription",
  "issueBody",
  "comments",
  "recentComments",
  "lastComment",
]);

/**
 * Orchestration metadata keys safe to strip.
 */
const METADATA_KEYS = new Set([
  "createdAt",
  "updatedAt",
  "metadata",
  "internalId",
]);

/**
 * Essential keys that must never be removed.
 */
const ESSENTIAL_KEYS = new Set([
  "issueId",
  "projectId",
  "paperclipWorkspace",
  "paperclipWorkspaces",
  "taskId",
  "_brief",
]);

/**
 * Pipeline processor: removes redundant context fields that are already
 * captured in the structured brief, strips empty values and orchestration metadata.
 */
export function deduplicateContext(ctx: PipelineContext): PipelineContext {
  const cleaned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(ctx.context)) {
    // Always keep essential keys
    if (ESSENTIAL_KEYS.has(key)) {
      cleaned[key] = value;
      continue;
    }

    // Remove keys redundant with structured brief
    if (ctx.structuredBrief && BRIEF_REDUNDANT_KEYS.has(key)) {
      continue;
    }

    // Remove orchestration metadata
    if (METADATA_KEYS.has(key)) {
      continue;
    }

    // Remove empty strings and null values
    if (value === null || value === "") {
      continue;
    }

    cleaned[key] = value;
  }

  // Update compressed token estimate after dedup
  const compressedTokenEstimate = estimateTokens(JSON.stringify(cleaned));
  const compressionRatio =
    ctx.metrics.originalTokenEstimate > 0
      ? compressedTokenEstimate / ctx.metrics.originalTokenEstimate
      : 1;

  return {
    ...ctx,
    context: cleaned,
    metrics: {
      ...ctx.metrics,
      compressedTokenEstimate,
      compressionRatio,
    },
  };
}
