import type { Message, Novel } from "./types";
import { SLIDING_WINDOW_FULL_COUNT } from "./agents/config";

const THAI_BLOCK = [
  "You MUST write the story entirely in Thai language.",
  "Use highly natural, elegant, and literary Thai prose (ภาษาบรรยายแบบนิยาย).",
  "Avoid robotic translations or unnatural phrasing.",
  "Ensure the dialogue sounds like real human conversation in Thai.",
].join("\n");

export function buildMessages(novel: Novel): Message[] {
  const fullCount = SLIDING_WINDOW_FULL_COUNT;
  const fullChapters = fullCount > 0 ? novel.chapters.slice(-fullCount) : [];
  const summarizedChapters =
    fullCount > 0 ? novel.chapters.slice(0, -fullCount) : novel.chapters.slice();

  const sections: string[] = ["You are an expert novel writer."];

  if (novel.settings.outputLanguage === "th") {
    sections.push(THAI_BLOCK);
  }

  sections.push("## Core story context and world-bible", novel.storyContext || "(empty)");

  if (novel.lore.length > 0) {
    const loreLines = novel.lore.map((l) => `- ${l.text}`).join("\n");
    sections.push("## Established lore", loreLines);
  }

  if (summarizedChapters.length > 0) {
    const lines = summarizedChapters.map((c, i) => {
      if (c.summary) {
        return `Chapter ${i + 1}: ${c.summary}`;
      }
      // Legacy fallback: include full text when no summary exists.
      return `Chapter ${i + 1} (no summary — full text):\n[${c.title}]\n${c.content}`;
    });
    sections.push("## Story so far (summaries)", lines.join("\n\n"));
  }

  if (fullChapters.length > 0) {
    const lines = fullChapters.map((c) => `[${c.title}]\n${c.content}`);
    sections.push("## Previous chapter (full text, for voice and immediate continuity)", lines.join("\n\n"));
  }

  const system = sections.join("\n\n");

  const targetWords = novel.settings.targetWords;
  const user = [
    `Write the next chapter. The output MUST be approximately ${targetWords} words long.`,
    "Ensure the chapter has a proper beginning, middle, and end.",
    "Do not pad the story unnecessarily, and ensure you finish the final sentence completely before stopping.",
    "Keep pacing tight.",
    "",
    `Guidance: ${novel.draft.prompt}`,
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
