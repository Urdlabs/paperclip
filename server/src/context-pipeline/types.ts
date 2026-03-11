import type { TaskType } from "@paperclipai/shared";

/**
 * A compact representation of issue context for the agent.
 * Produced by the context serializer processor.
 */
export interface StructuredBrief {
  issueTitle: string;
  description: string;
  recentComments: string[];
  triggeringComment: string;
  taskType: TaskType | null;
}

/**
 * The context flowing through the optimization pipeline.
 * Each processor receives this and returns a (potentially modified) copy.
 */
export interface PipelineContext {
  agent: {
    id: string;
    companyId: string;
    name: string;
    adapterType: string;
    adapterConfig: Record<string, unknown>;
    runtimeConfig: Record<string, unknown>;
  };
  config: Record<string, unknown>;
  context: Record<string, unknown>;
  taskType: TaskType | null;
  budget: {
    maxTokens: number | null;
    source: "run" | "agent" | "project" | "none";
    windDownThreshold: number;
  } | null;
  promptTemplate: string;
  instructionsContent: string | null;
  issueLabels: string[];
  issue: {
    title: string;
    description: string | null;
    comments: Array<{ id: string; body: string; createdAt: string }>;
  } | null;
  triggeringCommentId: string | null;
  structuredBrief: StructuredBrief | null;
  metrics: {
    originalTokenEstimate: number;
    compressedTokenEstimate: number;
    compressionRatio: number;
  };
}

/**
 * A pipeline processor function.
 * Takes a PipelineContext and returns a (potentially modified) PipelineContext.
 */
export type Processor = (ctx: PipelineContext) => PipelineContext;
