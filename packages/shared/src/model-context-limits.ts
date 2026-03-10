/** Context window sizes in tokens for known models */
export const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  // Claude 4 family
  "claude-opus-4-6": 200_000,
  "claude-sonnet-4-6": 200_000,
  // Claude 3.5 family
  "claude-3-5-sonnet-20241022": 200_000,
  "claude-3-5-haiku-20241022": 200_000,
  // Claude 3 family
  "claude-3-opus-20240229": 200_000,
  "claude-3-sonnet-20240229": 200_000,
  "claude-3-haiku-20240307": 200_000,
  // Aliases used in config
  sonnet: 200_000,
  opus: 200_000,
  haiku: 200_000,
};

/** Default context window size when model is unknown */
export const DEFAULT_CONTEXT_LIMIT = 200_000;

/** Look up context window size for a model, falling back to DEFAULT_CONTEXT_LIMIT */
export function getContextWindowSize(model: string): number {
  const normalized = model.toLowerCase().trim();
  return MODEL_CONTEXT_LIMITS[normalized] ?? DEFAULT_CONTEXT_LIMIT;
}
