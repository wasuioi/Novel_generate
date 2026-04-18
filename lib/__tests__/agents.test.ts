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

import { buildLoreKeeperMessages, parseLoreKeeperOutput } from "../agents/loreKeeper";

describe("buildLoreKeeperMessages", () => {
  it("includes the chapter content and existing lore for de-duplication", () => {
    const msgs = buildLoreKeeperMessages(
      "Chapter 2 · The Sword",
      "Aria pulled a silver dagger from the cloak.",
      ["Aria is the protagonist.", "The forest is haunted."],
    );
    expect(msgs[0].role).toBe("system");
    expect(msgs[0].content).toContain("Aria is the protagonist.");
    expect(msgs[0].content).toContain("The forest is haunted.");
    expect(msgs[0].content).toContain("same language as the chapter text");
    expect(msgs[0].content).toContain("If nothing new, output exactly \"NONE\"");
    expect(msgs[1].content).toContain("Chapter 2 · The Sword");
    expect(msgs[1].content).toContain("silver dagger");
  });

  it("handles empty existing lore gracefully", () => {
    const msgs = buildLoreKeeperMessages("T", "C", []);
    expect(msgs[0].content).toContain("Existing lore (do not duplicate):");
  });
});

describe("parseLoreKeeperOutput", () => {
  it("returns each bullet as a fact string", () => {
    const out = "- Aria carries a silver dagger.\n- The cloak is enchanted.";
    expect(parseLoreKeeperOutput(out)).toEqual([
      "Aria carries a silver dagger.",
      "The cloak is enchanted.",
    ]);
  });

  it("returns [] when the model outputs NONE", () => {
    expect(parseLoreKeeperOutput("NONE")).toEqual([]);
    expect(parseLoreKeeperOutput("  NONE  ")).toEqual([]);
  });

  it("returns [] for malformed output", () => {
    expect(parseLoreKeeperOutput("I don't see anything new")).toEqual([]);
    expect(parseLoreKeeperOutput("")).toEqual([]);
  });

  it("ignores filler before bullets", () => {
    const out = "Here are the new facts:\n- Aria has a sword.\nThanks!";
    expect(parseLoreKeeperOutput(out)).toEqual(["Aria has a sword."]);
  });
});
