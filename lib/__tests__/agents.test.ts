import { describe, it, expect } from "vitest";
import { buildSummarizerMessages, parseSummarizerOutput } from "../agents/summarizer";

describe("buildSummarizerMessages", () => {
  it("returns a system + user message with the chapter title and content", () => {
    const msgs = buildSummarizerMessages("Chapter 1 · Arrival", "The hero stepped off the boat.");
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe("system");
    expect(msgs[0].content).toContain("precise story summarizer");
    expect(msgs[0].content).toContain("Do not include introductory phrases");
    expect(msgs[1].role).toBe("user");
    expect(msgs[1].content).toContain("Chapter 1 · Arrival");
    expect(msgs[1].content).toContain("The hero stepped off the boat.");
  });
});

describe("parseSummarizerOutput", () => {
  it("returns bullet lines stripped of the leading '- '", () => {
    const out = "- Hero arrived.\n- Sword found.\n- Map opened.";
    expect(parseSummarizerOutput(out)).toEqual([
      "Hero arrived.",
      "Sword found.",
      "Map opened.",
    ]);
  });

  it("ignores conversational filler lines that don't start with '- '", () => {
    const out = "Here is the summary:\n- Hero arrived.\nThanks!";
    expect(parseSummarizerOutput(out)).toEqual(["Hero arrived."]);
  });

  it("returns an empty array when there are no bullets", () => {
    expect(parseSummarizerOutput("Sorry, I cannot help.")).toEqual([]);
  });

  it("trims whitespace inside each bullet", () => {
    expect(parseSummarizerOutput("-   Hero arrived.   ")).toEqual(["Hero arrived."]);
  });
});
