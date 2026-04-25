import type { Message } from "../types";

const BASE = [
  "You are a precise story summarizer. Given a novel chapter, produce a 3–5 line",
  "recap covering: key events, who did what, what changed in the world or characters.",
  "No flourishes, no analysis — facts only. Output plain text, one bullet per line",
  "starting with \"- \". Do not include introductory phrases like \"Here is the summary\".",
].join(" ");

const LANGUAGE_DIRECTIVE =
  "CRITICAL: You MUST write every bullet in Thai (ภาษาไทย). Do not use English or any other language. Character names and proper nouns may stay as-is.";

export function buildSummarizerMessages(
  chapterTitle: string,
  chapterContent: string,
): Message[] {
  const system = `${BASE}\n\n${LANGUAGE_DIRECTIVE}`;
  return [
    { role: "system", content: system },
    { role: "user", content: `${chapterTitle}\n\n${chapterContent}` },
  ];
}

export function parseSummarizerOutput(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter((line) => line.length > 0);
}
