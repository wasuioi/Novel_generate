import type { AgentCall } from "@/lib/types";

// Name of the HTTP response header that carries the per-request delimiter.
export const COST_DELIMITER_HEADER = "x-cost-delimiter";

// Metadata appended to the writer stream after the chapter text, separated by
// a random nonce delivered via the x-cost-delimiter header. A fresh UUID per
// request is effectively impossible for the model to emit, so it is safe
// against false matches inside generated prose. Carries the cost AND the model's
// finish reason, so the client can tell a finished chapter from a truncated one
// (provider drop, length cap, content filter, …) instead of silently keeping a
// partial draft.
export type WriterMeta = {
  cost: AgentCall | null;
  finishReason: string | null;
  error: string | null;
};

export function extractWriterMeta(buffer: string, delimiter: string): WriterMeta | null {
  if (!delimiter) return null;
  const idx = buffer.indexOf(delimiter);
  if (idx < 0) return null;
  try {
    const parsed = JSON.parse(buffer.slice(idx + delimiter.length)) as Partial<WriterMeta>;
    return {
      cost: parsed.cost ?? null,
      finishReason: parsed.finishReason ?? null,
      error: parsed.error ?? null,
    };
  } catch {
    return null;
  }
}
