import { describe, it, expect } from "vitest";
import { parseSceneSuggestions, buildSceneSuggestMessages } from "../agents/sceneSuggester";
import { DEFAULT_NOVEL } from "../types";

describe("parseSceneSuggestions", () => {
  it("parses a clean JSON array of 3 suggestions", () => {
    const raw = JSON.stringify([
      { title: "A", synopsis: "one" },
      { title: "B", synopsis: "two" },
      { title: "C", synopsis: "three" },
    ]);
    const result = parseSceneSuggestions(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.suggestions).toHaveLength(3);
      expect(result.suggestions[0]).toEqual({ title: "A", synopsis: "one" });
    }
  });

  it("strips markdown fence before parsing", () => {
    const raw = "```json\n" + JSON.stringify([
      { title: "A", synopsis: "one" },
      { title: "B", synopsis: "two" },
      { title: "C", synopsis: "three" },
    ]) + "\n```";
    const result = parseSceneSuggestions(raw);
    expect(result.ok).toBe(true);
  });

  it("fails when the array has != 3 items", () => {
    const raw = JSON.stringify([{ title: "A", synopsis: "a" }]);
    const result = parseSceneSuggestions(raw);
    expect(result.ok).toBe(false);
  });

  it("fails on missing title or synopsis", () => {
    const raw = JSON.stringify([
      { title: "A" },
      { title: "B", synopsis: "two" },
      { title: "C", synopsis: "three" },
    ]);
    const result = parseSceneSuggestions(raw);
    expect(result.ok).toBe(false);
  });

  it("fails on empty title or synopsis", () => {
    const raw = JSON.stringify([
      { title: "", synopsis: "one" },
      { title: "B", synopsis: "two" },
      { title: "C", synopsis: "three" },
    ]);
    const result = parseSceneSuggestions(raw);
    expect(result.ok).toBe(false);
  });

  it("fails on invalid JSON", () => {
    const result = parseSceneSuggestions("not json at all");
    expect(result.ok).toBe(false);
  });
});

describe("buildSceneSuggestMessages", () => {
  it("includes the story context and the Thai language instruction", () => {
    const novel = structuredClone(DEFAULT_NOVEL);
    novel.storyContext = "A fantasy kingdom at war.";
    const messages = buildSceneSuggestMessages(novel);
    const system = messages.find((m) => m.role === "system")!.content;
    expect(system).toContain("A fantasy kingdom at war.");
    expect(system).toContain("ภาษาไทย");
    expect(system).toContain("JSON array of 3 objects");
  });
});
