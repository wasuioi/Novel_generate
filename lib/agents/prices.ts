import type { AgentCall, ChapterCost } from "@/lib/types";

// USD per 1M tokens, as listed on OpenRouter. Update when pricing changes.
export const MODEL_PRICES: Record<string, { input: number; output: number }> = {
  "anthropic/claude-sonnet-4.6": { input: 3, output: 15 },
  "anthropic/claude-opus-4.7": { input: 5, output: 25 },
  "anthropic/claude-haiku-4.5": { input: 1, output: 5 },
  "openai/gpt-5.4": { input: 2.5, output: 15 },
  "google/gemini-3-flash-preview": { input: 0.5, output: 3 },
  "google/gemini-3.1-pro-preview": { input: 2, output: 12 },
};

export function computeCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number | null {
  const p = MODEL_PRICES[model];
  if (!p) {
    console.warn(`[cost] no price entry for model "${model}" — cost will be omitted`);
    return null;
  }
  return (promptTokens * p.input + completionTokens * p.output) / 1_000_000;
}

export function buildAgentCall(
  agent: AgentCall["agent"],
  model: string,
  promptTokens: number,
  completionTokens: number,
): AgentCall | null {
  const costUsd = computeCostUsd(model, promptTokens, completionTokens);
  if (costUsd === null) return null;
  return { agent, model, promptTokens, completionTokens, costUsd };
}

export function buildChapterCost(
  calls: (AgentCall | null | undefined)[],
): ChapterCost | undefined {
  const filtered = calls.filter((c): c is AgentCall => Boolean(c));
  if (filtered.length === 0) return undefined;
  const totalUsd = filtered.reduce((sum, c) => sum + c.costUsd, 0);
  return { calls: filtered, totalUsd };
}
