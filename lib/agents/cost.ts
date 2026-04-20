import type { AgentCall } from "@/lib/types";

const OPENROUTER_GENERATION_URL = "https://openrouter.ai/api/v1/generation";
const FETCH_TIMEOUT_MS = 5_000;
const RETRY_DELAYS_MS = [0, 500, 1500];

type RawGeneration = {
  data?: {
    id: string;
    model: string;
    total_cost: number;
    tokens_prompt: number;
    tokens_completion: number;
  };
};

/**
 * Fetches the billed cost for a single OpenRouter generation.
 * The /generation endpoint lags behind the generation itself (100-1500ms),
 * so we retry with escalating delays before giving up. Returns null on any
 * failure so callers can simply omit cost from the chapter.
 */
export async function fetchOpenRouterCost(
  genId: string,
  apiKey: string,
  agent: AgentCall["agent"],
): Promise<AgentCall | null> {
  for (const delayMs of RETRY_DELAYS_MS) {
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    const call = await tryFetch(genId, apiKey, agent);
    if (call) return call;
  }
  console.warn(`[cost] gave up on genId=${genId} agent=${agent}`);
  return null;
}

async function tryFetch(
  genId: string,
  apiKey: string,
  agent: AgentCall["agent"],
): Promise<AgentCall | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const url = `${OPENROUTER_GENERATION_URL}?id=${encodeURIComponent(genId)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as RawGeneration;
    const d = json.data;
    if (!d || typeof d.total_cost !== "number") return null;
    return {
      agent,
      model: d.model,
      promptTokens: d.tokens_prompt ?? 0,
      completionTokens: d.tokens_completion ?? 0,
      costUsd: d.total_cost,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
