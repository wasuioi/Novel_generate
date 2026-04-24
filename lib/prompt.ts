import type { Message, Novel } from "./types";
import { SLIDING_WINDOW_FULL_COUNT } from "./agents/config";

const THAI_BLOCK = [
  "You MUST write the story entirely in Thai language.",
  "Use highly natural, elegant, and literary Thai prose (ภาษาบรรยายแบบนิยาย).",
  "Avoid robotic translations or unnatural phrasing.",
  "Ensure the dialogue sounds like real human conversation in Thai.",
].join("\n");

const ENGLISH_BLOCK = [
  "You MUST write the story entirely in English.",
  "Even if the user's guidance, story context, or established lore contains other languages,",
  "the prose must be in natural, literary English. Translate proper nouns or terms when needed for clarity.",
].join("\n");

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
  sections.push(novel.settings.outputLanguage === "th" ? THAI_BLOCK : ENGLISH_BLOCK);
  sections.push(...buildContextBlocks(novel));
  const system = sections.join("\n\n");

  const targetWords = novel.settings.targetWords;
  const minWords = Math.floor(targetWords * 0.8);
  const openingLine = isEditing
    ? `Rewrite chapter ${editIndex + 1}. Target length: approximately ${targetWords} words.`
    : `Write the next chapter. Target length: approximately ${targetWords} words.`;
  const user = [
    openingLine,
    `Develop the scene fully — do NOT stop short. Continue writing until you have covered the entire arc described in the guidance and reached at least ${minWords} words.`,
    "Do not pad with filler, but ensure the chapter has a proper beginning, middle, and end.",
    "Finish the final sentence completely before stopping. Keep pacing tight.",
    "",
    `Guidance: ${novel.draft.prompt}`,
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
