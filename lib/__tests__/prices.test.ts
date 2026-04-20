import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  MODEL_PRICES,
  computeCostUsd,
  buildAgentCall,
  buildChapterCost,
} from "../agents/prices";
import type { AgentCall } from "../types";

describe("computeCostUsd", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("computes cost from prompt + completion tokens × price per 1M", () => {
    const model = "anthropic/claude-haiku-4.5"; // input 1, output 5
    // 1M input × $1 + 1M output × $5 = $6
    expect(computeCostUsd(model, 1_000_000, 1_000_000)).toBeCloseTo(6, 10);
  });

  it("handles zero tokens", () => {
    expect(computeCostUsd("anthropic/claude-haiku-4.5", 0, 0)).toBe(0);
  });

  it("returns null and warns for an unknown model", () => {
    expect(computeCostUsd("unknown/model", 1000, 1000)).toBeNull();
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain("unknown/model");
  });

  it("covers every model exposed in MODEL_PRICES", () => {
    for (const model of Object.keys(MODEL_PRICES)) {
      expect(computeCostUsd(model, 100, 100)).not.toBeNull();
    }
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe("buildAgentCall", () => {
  it("returns a full AgentCall for a known model", () => {
    const call = buildAgentCall("writer", "anthropic/claude-haiku-4.5", 1000, 500);
    expect(call).toEqual({
      agent: "writer",
      model: "anthropic/claude-haiku-4.5",
      promptTokens: 1000,
      completionTokens: 500,
      costUsd: (1000 * 1 + 500 * 5) / 1_000_000,
    });
  });

  it("returns null for an unknown model", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(buildAgentCall("writer", "unknown/model", 100, 100)).toBeNull();
    warnSpy.mockRestore();
  });
});

describe("buildChapterCost", () => {
  const callA: AgentCall = {
    agent: "writer",
    model: "m",
    promptTokens: 1,
    completionTokens: 1,
    costUsd: 0.01,
  };
  const callB: AgentCall = {
    agent: "summarizer",
    model: "m",
    promptTokens: 1,
    completionTokens: 1,
    costUsd: 0.02,
  };

  it("returns undefined when no valid calls are present", () => {
    expect(buildChapterCost([])).toBeUndefined();
    expect(buildChapterCost([null, undefined])).toBeUndefined();
  });

  it("filters null/undefined and sums the remaining calls", () => {
    const result = buildChapterCost([callA, null, callB, undefined]);
    expect(result).toEqual({ calls: [callA, callB], totalUsd: 0.03 });
  });

  it("preserves call ordering", () => {
    const result = buildChapterCost([callB, callA]);
    expect(result?.calls[0]).toBe(callB);
    expect(result?.calls[1]).toBe(callA);
  });
});
