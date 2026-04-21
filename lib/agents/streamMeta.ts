import type { AgentCall } from "@/lib/types";

// Name of the HTTP response header that carries the per-request delimiter.
export const COST_DELIMITER_HEADER = "x-cost-delimiter";

// The writer's cost JSON is appended to the stream after the chapter text,
// separated by a random nonce delivered via the x-cost-delimiter header.
// A fresh UUID per request is effectively impossible for the model to emit,
// so this is safe against false matches inside generated prose.
export function extractWriterCost(buffer: string, delimiter: string): AgentCall | null {
  if (!delimiter) return null;
  const idx = buffer.indexOf(delimiter);
  if (idx < 0) return null;
  try {
    return JSON.parse(buffer.slice(idx + delimiter.length)) as AgentCall;
  } catch {
    return null;
  }
}
