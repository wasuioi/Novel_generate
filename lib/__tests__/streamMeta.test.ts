import { describe, it, expect } from "vitest";
import {
  OR_META_PREFIX,
  OR_META_SUFFIX,
  extractWriterCost,
} from "../agents/streamMeta";
import type { AgentCall } from "../types";

const sampleCall: AgentCall = {
  agent: "writer",
  model: "anthropic/claude-sonnet-4.6",
  promptTokens: 1234,
  completionTokens: 567,
  costUsd: 0.012345,
};

const frame = (call: AgentCall) =>
  `${OR_META_PREFIX}${JSON.stringify(call)}${OR_META_SUFFIX}`;

describe("extractWriterCost", () => {
  it("returns null when the buffer contains no sentinel", () => {
    expect(extractWriterCost("plain chapter text")).toBeNull();
  });

  it("parses the AgentCall from a trailing sentinel", () => {
    const buffer = "chapter text\n\n" + frame(sampleCall);
    expect(extractWriterCost(buffer)).toEqual(sampleCall);
  });

  it("returns null when the prefix is present but the suffix is missing", () => {
    const buffer = `text${OR_META_PREFIX}${JSON.stringify(sampleCall)}`;
    expect(extractWriterCost(buffer)).toBeNull();
  });

  it("returns null when the framed payload is not valid JSON", () => {
    const buffer = `text${OR_META_PREFIX}not-json${OR_META_SUFFIX}`;
    expect(extractWriterCost(buffer)).toBeNull();
  });

  it("returns null for an empty buffer", () => {
    expect(extractWriterCost("")).toBeNull();
  });

  it("extracts the first framed payload when more than one is present", () => {
    const other: AgentCall = { ...sampleCall, promptTokens: 999 };
    const buffer = frame(sampleCall) + frame(other);
    expect(extractWriterCost(buffer)).toEqual(sampleCall);
  });
});
