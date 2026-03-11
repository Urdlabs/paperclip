import type { PipelineContext, StructuredBrief } from "../types.js";
import { estimateTokens } from "../../services/token-estimation.js";

/**
 * Truncation limits per task type (in characters).
 */
const TRUNCATION_LIMITS: Record<string, { description: number; comment: number }> = {
  bug_fix: { description: 4000, comment: 800 },
  feature: { description: 2000, comment: 500 },
  review: { description: 2000, comment: 500 },
  refactor: { description: 2000, comment: 500 },
  generic: { description: 2000, comment: 500 },
};

/**
 * Truncate text to maxChars, appending "..." if truncated.
 */
function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 3) + "...";
}

/**
 * Keys considered orchestration metadata and safe to strip from context.
 */
const METADATA_KEYS = new Set([
  "createdAt",
  "updatedAt",
  "metadata",
  "internalId",
]);

/**
 * Keys essential to keep even after serialization.
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
 * Pipeline processor: serializes issue context into a compact structured brief
 * with task-type-aware truncation limits.
 */
export function serializeContext(ctx: PipelineContext): PipelineContext {
  if (!ctx.issue) return ctx;

  const limits = TRUNCATION_LIMITS[ctx.taskType ?? "generic"] ?? TRUNCATION_LIMITS.generic;

  // Find triggering comment
  const triggeringComment = ctx.triggeringCommentId
    ? ctx.issue.comments.find((c) => c.id === ctx.triggeringCommentId)
    : null;

  // Get last 3 non-triggering comments
  const otherComments = ctx.issue.comments
    .filter((c) => c.id !== ctx.triggeringCommentId)
    .slice(-3);

  // Build structured brief
  const brief: StructuredBrief = {
    issueTitle: ctx.issue.title,
    description: truncate(ctx.issue.description ?? "", limits.description),
    recentComments: otherComments.map((c) => truncate(c.body, limits.comment)),
    triggeringComment: triggeringComment?.body ?? "",
    taskType: ctx.taskType,
  };

  // Measure original token estimate
  const originalTokenEstimate = estimateTokens(JSON.stringify(ctx.context));

  // Build compacted context: keep essential keys, add brief
  const compacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(ctx.context)) {
    if (ESSENTIAL_KEYS.has(key)) {
      compacted[key] = value;
    }
  }
  compacted._brief = brief;

  // Measure compressed token estimate
  const compressedTokenEstimate = estimateTokens(JSON.stringify(compacted));
  const compressionRatio =
    originalTokenEstimate > 0
      ? compressedTokenEstimate / originalTokenEstimate
      : 1;

  return {
    ...ctx,
    structuredBrief: brief,
    context: compacted,
    metrics: {
      originalTokenEstimate,
      compressedTokenEstimate,
      compressionRatio,
    },
  };
}
