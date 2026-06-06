import type { Message, Novel } from "./types";
import { SLIDING_WINDOW_FULL_COUNT } from "./agents/config";
import { activeDetailPreset } from "./detailPresets";

const THAI_BLOCK = [
  "You MUST write the story entirely in Thai language.",
  "Write clear, modern, accessible Thai prose — like contemporary novels, not classical literature (วรรณคดี). Use short, direct sentences and choose the simpler word: \"มอง\" not \"ทัศนา\", \"เดิน\" not \"ดำเนิน\".",
  "Do NOT personify nature, time, silence, light, or sound. Avoid patterns like \"ลมหายใจของโลก\", \"ความเงียบที่จดจำได้\", \"แสงที่กระซิบ\" — describe things literally and physically.",
  "Dialogue should sound like how Thai people actually talk today, not formal or วรรณคดี.",
  "The user's chapter Guidance overrides these defaults whenever they conflict.",
].join("\n");

// Per-level writing instruction, derived from the chosen detail preset. Makes
// "กระชับ vs ละเอียด" actually change the prose density, not just a number.
function detailInstruction(targetChars: number): string {
  switch (activeDetailPreset(targetChars)) {
    case "concise":
      return "Detail level — concise: move briskly through the events with only essential description.";
    case "detailed":
      return "Detail level — detailed: fully develop every beat with concrete sensory detail, the characters' inner thoughts and feelings, and complete dialogue; immerse the reader and build a long, richly developed chapter.";
    default:
      return "Detail level — balanced: develop the main beats with description, emotion, and dialogue where they matter.";
  }
}

export function buildContextBlocks(novel: Novel): string[] {
  const editIndex = novel.draft.chapterId
    ? novel.chapters.findIndex((c) => c.id === novel.draft.chapterId)
    : -1;
  const isEditing = editIndex >= 0;

  const contextChapters = isEditing
    ? novel.chapters.slice(0, editIndex)
    : novel.chapters;

  const fullCount = SLIDING_WINDOW_FULL_COUNT;
  const fullChapters = fullCount > 0 ? contextChapters.slice(-fullCount) : [];
  const summarizedChapters =
    fullCount > 0 ? contextChapters.slice(0, -fullCount) : contextChapters.slice();

  const chapterIndex = new Map(novel.chapters.map((c, i) => [c.id, i]));
  const visibleLore = isEditing
    ? novel.lore.filter((l) => {
        if (!l.chapterId) return true;
        const idx = chapterIndex.get(l.chapterId);
        return idx !== undefined && idx < editIndex;
      })
    : novel.lore;

  const sections: string[] = [];
  sections.push("## Core story context and world-bible", novel.storyContext || "(empty)");

  if (visibleLore.length > 0) {
    const loreLines = visibleLore.map((l) => `- ${l.text}`).join("\n");
    sections.push("## Established lore", loreLines);
  }

  if (summarizedChapters.length > 0) {
    const lines = summarizedChapters.map((c, i) => {
      if (c.summary) {
        return `Chapter ${i + 1}: ${c.summary}`;
      }
      return `Chapter ${i + 1} (no summary — full text):\n[${c.title}]\n${c.content}`;
    });
    sections.push("## Story so far (summaries)", lines.join("\n\n"));
  }

  if (fullChapters.length > 0) {
    const lines = fullChapters.map((c) => `[${c.title}]\n${c.content}`);
    sections.push("## Previous chapter (full text, for voice and immediate continuity)", lines.join("\n\n"));
  }

  return sections;
}

export function buildMessages(novel: Novel): Message[] {
  const editIndex = novel.draft.chapterId
    ? novel.chapters.findIndex((c) => c.id === novel.draft.chapterId)
    : -1;
  const isEditing = editIndex >= 0;

  const sections: string[] = ["You are an expert novel writer."];
  sections.push(THAI_BLOCK);
  sections.push(...buildContextBlocks(novel));
  const system = sections.join("\n\n");

  const targetChars = novel.settings.targetChars;
  const minChars = Math.floor(targetChars * 0.9);
  const maxChars = Math.floor(targetChars * 1.1);
  const openingLine = isEditing
    ? `Rewrite chapter ${editIndex + 1}. Target length: approximately ${targetChars} Thai characters including spaces (sweet spot ${minChars}–${maxChars}).`
    : `Write the next chapter. Target length: approximately ${targetChars} Thai characters including spaces (sweet spot ${minChars}–${maxChars}).`;
  const user = [
    openingLine,
    detailInstruction(targetChars),
    `Develop the scene fully so it covers the entire arc described in the guidance. Once the arc completes, finish the sentence and stop — do not pad with filler.`,
    "Ensure the chapter has a proper beginning, middle, and end.",
    "",
    `Guidance: ${novel.draft.prompt}`,
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
