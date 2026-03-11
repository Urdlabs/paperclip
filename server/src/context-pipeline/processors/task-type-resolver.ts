import type { TaskType } from "@paperclipai/shared";
import type { PipelineContext } from "../types.js";

/**
 * Default mapping from issue label names to task types.
 */
export const DEFAULT_LABEL_MAPPING: Record<string, TaskType> = {
  bug: "bug_fix",
  fix: "bug_fix",
  feature: "feature",
  enhancement: "feature",
  review: "review",
  "code review": "review",
  refactor: "refactor",
  refactoring: "refactor",
};

/**
 * Infer task type from issue title and description using regex heuristics.
 * Returns null if confidence is low.
 */
export function inferTaskType(
  issue: { title: string; description: string | null },
): TaskType | null {
  const text = `${issue.title} ${issue.description ?? ""}`.toLowerCase();
  if (/\b(bug|fix|error|crash|broken|regression)\b/.test(text)) return "bug_fix";
  if (/\b(add|implement|create|build|new feature)\b/.test(text)) return "feature";
  if (/\b(review|pr|pull request|feedback)\b/.test(text)) return "review";
  if (/\b(refactor|clean up|reorganize|restructure)\b/.test(text)) return "refactor";
  return null;
}

/**
 * Pipeline processor: resolves taskType from issue labels with operator overrides
 * and content-based auto-detection fallback.
 */
export function resolveTaskType(ctx: PipelineContext): PipelineContext {
  // Build effective label mapping: defaults + operator overrides
  const operatorMapping = ctx.agent.runtimeConfig?.labelMapping;
  const effectiveMapping: Record<string, TaskType> = {
    ...DEFAULT_LABEL_MAPPING,
    ...(operatorMapping && typeof operatorMapping === "object" && !Array.isArray(operatorMapping)
      ? (operatorMapping as Record<string, TaskType>)
      : {}),
  };

  // Check issue labels against mapping (case-insensitive, first match wins)
  for (const label of ctx.issueLabels) {
    const normalized = label.toLowerCase();
    if (normalized in effectiveMapping) {
      return { ...ctx, taskType: effectiveMapping[normalized] };
    }
  }

  // Fallback: auto-detect from issue content
  if (ctx.issue) {
    const inferred = inferTaskType(ctx.issue);
    if (inferred) {
      return { ...ctx, taskType: inferred };
    }
  }

  // No match, leave as null (generic template will be used downstream)
  return ctx;
}
