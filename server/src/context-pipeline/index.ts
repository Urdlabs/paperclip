import type { PipelineContext, Processor } from "./types.js";
import { resolveTaskType } from "./processors/task-type-resolver.js";
import { serializeContext } from "./processors/context-serializer.js";
import { deduplicateContext } from "./processors/deduplicator.js";
import { reorderForCaching } from "./processors/prompt-reorderer.js";

/**
 * Run the context optimization pipeline.
 * Applies processors in order using reduce pattern.
 */
export function runContextPipeline(
  input: PipelineContext,
  processors: Processor[],
): PipelineContext {
  return processors.reduce((ctx, proc) => proc(ctx), input);
}

/**
 * Default processor chain for context optimization.
 * Order matters: resolve task type first, then serialize, deduplicate, reorder.
 */
export const defaultProcessors: Processor[] = [
  resolveTaskType,
  serializeContext,
  deduplicateContext,
  reorderForCaching,
];

// Re-export types and processors for convenient imports
export type { PipelineContext, Processor, StructuredBrief } from "./types.js";
export { resolveTaskType, inferTaskType, DEFAULT_LABEL_MAPPING } from "./processors/task-type-resolver.js";
export { serializeContext } from "./processors/context-serializer.js";
export { deduplicateContext } from "./processors/deduplicator.js";
export { reorderForCaching } from "./processors/prompt-reorderer.js";
