/**
 * Task type classification for agent prompt routing.
 * Used by the context optimization pipeline to select task-appropriate templates
 * and truncation limits.
 */
export type TaskType = "bug_fix" | "feature" | "review" | "refactor" | "generic";

/**
 * All valid task types as a runtime array.
 */
export const TASK_TYPES: TaskType[] = [
  "bug_fix",
  "feature",
  "review",
  "refactor",
  "generic",
];

/**
 * Configuration for task-type-specific prompt templates and truncation.
 */
export interface TaskTypeTemplateConfig {
  taskType: TaskType;
  promptTemplate: string;
  truncationLimits: {
    description: number;
    comment: number;
  };
}

/**
 * Mapping from label names to task types.
 * Used by operators to override default label-to-task-type resolution.
 */
export type LabelMapping = Record<string, TaskType>;
