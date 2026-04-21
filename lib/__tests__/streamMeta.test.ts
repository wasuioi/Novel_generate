import { describe, it, expect } from "vitest";
import { extractWriterCost } from "../agents/streamMeta";
import type { AgentCall } from "../types";

const DELIMITER = "550e8400-e29b-41d4-a716-446655440000";

const sampleCall: AgentCall = {
  agent: "writer",
  model: "anthropic/claude-sonnet-4.6",
  promptTokens: 1234,
  completionTokens: 567,
  costUsd: 0.012345,
};

describe("extractWriterCost", () => {
  it("returns null when the buffer contains no delimiter", () => {
    expect(extractWriterCost("plain chapter text", DELIMITER)).toBeNull();
  });

  it("returns null when the delimiter is an empty string", () => {
    expect(extractWriterCost("any text", "")).toBeNull();
  });

  it("parses the AgentCall from a trailing delimiter", () => {
    const buffer = "chapter text\n\n" + DELIMITER + JSON.stringify(sampleCall);
    expect(extractWriterCost(buffer, DELIMITER)).toEqual(sampleCall);
  });

  it("returns null when bytes after the delimiter are not valid JSON", () => {
    const buffer = `text${DELIMITER}not-json`;
    expect(extractWriterCost(buffer, DELIMITER)).toBeNull();
  });

  it("returns null for an empty buffer", () => {
    expect(extractWriterCost("", DELIMITER)).toBeNull();
  });
});
