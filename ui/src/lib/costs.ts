export function computeCacheEfficiencyPercent(cachedInputTokens: number, inputTokens: number): number {
  const safeCached = Math.max(0, cachedInputTokens);
  const safeInput = Math.max(0, inputTokens);
  const totalPromptTokens = safeCached + safeInput;

  if (totalPromptTokens === 0) {
    return 0;
  }

  return Number(((safeCached / totalPromptTokens) * 100).toFixed(1));
}
