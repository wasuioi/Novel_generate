import type { AgentCall } from "@/lib/types";

export const OR_META_PREFIX = "\u0000__OR_META:";
export const OR_META_SUFFIX = "__\u0000";

export function extractWriterCost(buffer: string): AgentCall | null {
  const metaIdx = buffer.indexOf(OR_META_PREFIX);
  if (metaIdx < 0) return null;
  const tail = buffer.slice(metaIdx + OR_META_PREFIX.length);
  const sufIdx = tail.indexOf(OR_META_SUFFIX);
  if (sufIdx < 0) return null;
  try {
    return JSON.parse(tail.slice(0, sufIdx)) as AgentCall;
  } catch {
    return null;
  }
}
