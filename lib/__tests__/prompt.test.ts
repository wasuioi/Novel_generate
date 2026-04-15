// lib/__tests__/prompt.test.ts
import { describe, it, expect } from "vitest";
import { buildMessages } from "../prompt";
import type { Novel } from "../types";

const base = (): Novel => ({
  storyContext: "Medieval fantasy with dragons.",
  chapters: [],
  draft: { chapterId: null, title: "Ch 1", prompt: "Introduce the hero.", output: "" },
  settings: { model: "anthropic/claude-sonnet-4.6", temperature: 0.8 },
});

describe("buildMessages", () => {
  it("labels the first-chapter case", () => {
    const msgs = buildMessages(base());
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe("system");
    expect(msgs[0].content).toContain("Medieval fantasy with dragons.");
    expect(msgs[0].content).toContain("(none yet — this is the first chapter)");
    expect(msgs[1]).toEqual({
      role: "user",
      content: "Write the next chapter. Guidance:\nIntroduce the hero.",
    });
  });

  it("appends past chapters in order, each labeled with its title", () => {
    const novel = base();
    novel.chapters = [
      { id: "1", title: "Chapter 1 · Arrival", prompt: "", content: "The hero arrives.", createdAt: 1 },
      { id: "2", title: "Chapter 2 · Map",     prompt: "", content: "A map is found.",   createdAt: 2 },
    ];
    const msgs = buildMessages(novel);
    const system = msgs[0].content;
    const arrivalIdx = system.indexOf("Chapter 1 · Arrival");
    const mapIdx = system.indexOf("Chapter 2 · Map");
    expect(arrivalIdx).toBeGreaterThan(-1);
    expect(mapIdx).toBeGreaterThan(arrivalIdx);
    expect(system).toContain("The hero arrives.");
    expect(system).toContain("A map is found.");
  });

  it("still produces a well-formed system message with empty story context", () => {
    const novel = base();
    novel.storyContext = "";
    const msgs = buildMessages(novel);
    expect(msgs[0].content).toContain("You are an expert novel writer.");
    expect(msgs[0].content).toContain("Here is the core story context and world-bible:");
  });
});
