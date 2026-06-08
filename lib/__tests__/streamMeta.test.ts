import { describe, it, expect } from "vitest";
import { extractWriterMeta } from "../agents/streamMeta";
import type { AgentCall } from "../types";

const DELIMITER = "550e8400-e29b-41d4-a716-446655440000";

const sampleCost: AgentCall = {
  agent: "writer",
  model: "anthropic/claude-sonnet-4.6",
  promptTokens: 1234,
  completionTokens: 567,
  costUsd: 0.012345,
};

describe("extractWriterMeta", () => {
  it("returns null when the buffer contains no delimiter", () => {
    expect(extractWriterMeta("plain chapter text", DELIMITER)).toBeNull();
  });

  it("returns null when the delimiter is an empty string", () => {
    expect(extractWriterMeta("any text", "")).toBeNull();
  });

  it("parses cost, finishReason and error from a trailing delimiter", () => {
    const meta = { cost: sampleCost, finishReason: "stop", error: null };
    const buffer = "chapter text\n\n" + DELIMITER + JSON.stringify(meta);
    expect(extractWriterMeta(buffer, DELIMITER)).toEqual(meta);
  });

  it("surfaces a non-stop finish reason (truncation)", () => {
    const buffer = `cut text${DELIMITER}${JSON.stringify({ cost: null, finishReason: "length", error: null })}`;
    expect(extractWriterMeta(buffer, DELIMITER)).toEqual({
      cost: null,
      finishReason: "length",
      error: null,
    });
  });

  it("defaults missing fields to null", () => {
    const buffer = `text${DELIMITER}${JSON.stringify({ finishReason: "error" })}`;
    expect(extractWriterMeta(buffer, DELIMITER)).toEqual({
      cost: null,
      finishReason: "error",
      error: null,
    });
  });

  it("returns null when bytes after the delimiter are not valid JSON", () => {
    expect(extractWriterMeta(`text${DELIMITER}not-json`, DELIMITER)).toBeNull();
  });

  it("returns null for an empty buffer", () => {
    expect(extractWriterMeta("", DELIMITER)).toBeNull();
  });
});
