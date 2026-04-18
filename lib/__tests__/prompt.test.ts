import { describe, it, expect } from "vitest";
import { buildMessages } from "../prompt";
import { DEFAULT_NOVEL, type Novel } from "../types";

const base = (): Novel => ({
  ...DEFAULT_NOVEL,
  storyContext: "Medieval fantasy with dragons.",
  draft: { chapterId: null, title: "Ch 1", prompt: "Introduce the hero.", output: "" },
});

describe("buildMessages", () => {
  it("produces system + user messages", () => {
    const msgs = buildMessages(base());
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe("system");
    expect(msgs[1].role).toBe("user");
  });

  it("includes the story context and the user guidance", () => {
    const msgs = buildMessages(base());
    expect(msgs[0].content).toContain("Medieval fantasy with dragons.");
    expect(msgs[1].content).toContain("Introduce the hero.");
  });

  it("injects the target word count into the user message", () => {
    const novel = base();
    novel.settings.targetWords = 1200;
    const msgs = buildMessages(novel);
    expect(msgs[1].content).toContain("approximately 1200 words");
    expect(msgs[1].content).toContain("beginning, middle, and end");
  });

  it("omits the Thai block when outputLanguage is en", () => {
    const msgs = buildMessages(base());
    expect(msgs[0].content).not.toContain("Thai");
    expect(msgs[0].content).not.toContain("ภาษาบรรยาย");
  });

  it("includes the Thai block when outputLanguage is th", () => {
    const novel = base();
    novel.settings.outputLanguage = "th";
    const msgs = buildMessages(novel);
    expect(msgs[0].content).toContain("write the story entirely in Thai language");
    expect(msgs[0].content).toContain("ภาษาบรรยายแบบนิยาย");
  });

  it("includes established lore when present", () => {
    const novel = base();
    novel.lore = [
      { id: "l1", text: "Aria carries a silver dagger.", source: "ai", createdAt: 1 },
      { id: "l2", text: "The cloak is enchanted.", source: "user", createdAt: 2 },
    ];
    const msgs = buildMessages(novel);
    expect(msgs[0].content).toContain("Established lore");
    expect(msgs[0].content).toContain("Aria carries a silver dagger.");
    expect(msgs[0].content).toContain("The cloak is enchanted.");
  });

  it("omits the lore section when there is no lore", () => {
    const msgs = buildMessages(base());
    expect(msgs[0].content).not.toContain("Established lore");
  });

  it("with one chapter, treats it as the previous-chapter full text (no summaries)", () => {
    const novel = base();
    novel.chapters = [
      { id: "c1", title: "Chapter 1 · Arrival", prompt: "", content: "Hero arrived.", summary: "Hero arrived.", createdAt: 1 },
    ];
    const msgs = buildMessages(novel);
    expect(msgs[0].content).toContain("Previous chapter");
    expect(msgs[0].content).toContain("Chapter 1 · Arrival");
    expect(msgs[0].content).toContain("Hero arrived.");
    expect(msgs[0].content).not.toContain("Story so far");
  });

  it("with three chapters, summarizes 1..N-2 and keeps N-1 full", () => {
    const novel = base();
    novel.chapters = [
      { id: "c1", title: "Ch1", prompt: "", content: "FULL CH1 BODY", summary: "Hero arrives.", createdAt: 1 },
      { id: "c2", title: "Ch2", prompt: "", content: "FULL CH2 BODY", summary: "Map found.",     createdAt: 2 },
      { id: "c3", title: "Ch3", prompt: "", content: "FULL CH3 BODY", summary: "Forest entered.", createdAt: 3 },
    ];
    const msgs = buildMessages(novel);
    const sys = msgs[0].content;
    expect(sys).toContain("Story so far");
    expect(sys).toContain("Hero arrives.");
    expect(sys).toContain("Map found.");
    expect(sys).not.toContain("FULL CH1 BODY");
    expect(sys).not.toContain("FULL CH2 BODY");
    expect(sys).toContain("Previous chapter");
    expect(sys).toContain("FULL CH3 BODY");
  });

  it("falls back to full text for summarized-slot chapters that have no summary (legacy)", () => {
    const novel = base();
    novel.chapters = [
      { id: "c1", title: "Ch1", prompt: "", content: "LEGACY FULL CH1", summary: "", createdAt: 1 },
      { id: "c2", title: "Ch2", prompt: "", content: "FULL CH2",        summary: "", createdAt: 2 },
    ];
    const msgs = buildMessages(novel);
    expect(msgs[0].content).toContain("LEGACY FULL CH1");
    expect(msgs[0].content).toContain("FULL CH2");
  });

  it("with no chapters, omits both Story-so-far and Previous-chapter sections", () => {
    const msgs = buildMessages(base());
    expect(msgs[0].content).not.toContain("Story so far");
    expect(msgs[0].content).not.toContain("Previous chapter");
  });
});
