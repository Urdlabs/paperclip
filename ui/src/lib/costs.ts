export interface CacheEfficiencyMetrics {
  uncachedInputTokens: number;
  cachedInputTokens: number;
  totalPromptTokens: number;
  cacheSharePercent: number;
}

export function computeCacheEfficiencyMetrics(
  cachedInputTokens: number,
  inputTokens: number,
): CacheEfficiencyMetrics {
  const safeCached = Math.max(0, cachedInputTokens);
  const safeInput = Math.max(0, inputTokens);
  const totalPromptTokens = safeCached + safeInput;

  const cacheSharePercent =
    totalPromptTokens === 0
      ? 0
      : Number(((safeCached / totalPromptTokens) * 100).toFixed(1));

  return {
    uncachedInputTokens: safeInput,
    cachedInputTokens: safeCached,
    totalPromptTokens,
    cacheSharePercent,
  };
}

export function computeCacheEfficiencyPercent(cachedInputTokens: number, inputTokens: number): number {
  const metrics = computeCacheEfficiencyMetrics(cachedInputTokens, inputTokens);

  return metrics.cacheSharePercent;
}
