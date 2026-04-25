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

  it("includes target length, sweet-spot range, and a 'do not pad' instruction", () => {
    const novel = base();
    novel.settings.targetChars = 6000;
    const msgs = buildMessages(novel);
    expect(msgs[1].content).toContain("approximately 6000 Thai characters");
    expect(msgs[1].content).toContain("sweet spot 5400–6600"); // 90%, 110%
    expect(msgs[1].content).toContain("do not pad with filler");
    expect(msgs[1].content).toContain("beginning, middle, and end");
  });

  it("always includes the Thai-language directive", () => {
    const msgs = buildMessages(base());
    expect(msgs[0].content).toContain("write the story entirely in Thai language");
    expect(msgs[0].content).toContain("ภาษาบรรยายแบบนิยาย");
    expect(msgs[0].content).not.toContain("write the story entirely in English");
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

describe("buildMessages when editing an existing chapter", () => {
  const makeNovel = (): Novel => ({
    ...DEFAULT_NOVEL,
    storyContext: "Medieval fantasy.",
    chapters: [
      { id: "c1", title: "Ch1", prompt: "", content: "BODY 1", summary: "Hero arrives.",   createdAt: 1 },
      { id: "c2", title: "Ch2", prompt: "", content: "BODY 2", summary: "Map is found.",   createdAt: 2 },
      { id: "c3", title: "Ch3", prompt: "", content: "BODY 3", summary: "Forest entered.", createdAt: 3 },
      { id: "c4", title: "Ch4", prompt: "", content: "BODY 4", summary: "Cave explored.",  createdAt: 4 },
      { id: "c5", title: "Ch5", prompt: "", content: "BODY 5", summary: "Dragon faced.",   createdAt: 5 },
    ],
    lore: [
      { id: "lA", text: "Hero's sword is Mythril.", source: "ai",   chapterId: "c1", createdAt: 1 },
      { id: "lB", text: "The map is cursed.",       source: "ai",   chapterId: "c2", createdAt: 2 },
      { id: "lC", text: "Forest is haunted.",       source: "ai",   chapterId: "c3", createdAt: 3 },
      { id: "lD", text: "Cave holds crystals.",     source: "ai",   chapterId: "c4", createdAt: 4 },
      { id: "lE", text: "Dragon fears fire.",       source: "ai",   chapterId: "c5", createdAt: 5 },
      { id: "lU", text: "Magic is rare.",           source: "user", createdAt: 1 },
    ],
    draft: { chapterId: "c3", title: "Ch3", prompt: "Rewrite forest scene.", output: "" },
  });

  it("excludes chapters at or after the one being edited from the context", () => {
    const sys = buildMessages(makeNovel())[0].content;
    expect(sys).toContain("Hero arrives.");  // c1 summary kept
    expect(sys).toContain("BODY 2");         // c2 full kept
    expect(sys).not.toContain("BODY 3");
    expect(sys).not.toContain("BODY 4");
    expect(sys).not.toContain("BODY 5");
    expect(sys).not.toContain("Forest entered.");
    expect(sys).not.toContain("Cave explored.");
    expect(sys).not.toContain("Dragon faced.");
  });

  it("excludes lore attached to the edited chapter or later chapters", () => {
    const sys = buildMessages(makeNovel())[0].content;
    expect(sys).toContain("Hero's sword is Mythril."); // c1
    expect(sys).toContain("The map is cursed.");       // c2
    expect(sys).toContain("Magic is rare.");           // user lore
    expect(sys).not.toContain("Forest is haunted.");   // c3 (being edited)
    expect(sys).not.toContain("Cave holds crystals."); // c4
    expect(sys).not.toContain("Dragon fears fire.");   // c5
  });

  it("instructs the model to rewrite the chosen chapter, not continue past the latest", () => {
    const user = buildMessages(makeNovel())[1].content;
    expect(user).toContain("Rewrite chapter 3");
    expect(user).not.toContain("Write the next chapter");
    expect(user).toContain("Rewrite forest scene."); // guidance preserved
  });

  it("when editing the first chapter, omits story-so-far and previous-chapter sections", () => {
    const novel = makeNovel();
    novel.draft.chapterId = "c1";
    const msgs = buildMessages(novel);
    expect(msgs[0].content).not.toContain("Story so far");
    expect(msgs[0].content).not.toContain("Previous chapter");
    expect(msgs[1].content).toContain("Rewrite chapter 1");
  });
});
