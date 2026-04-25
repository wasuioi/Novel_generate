import type { Message } from "../types";

const LANGUAGE_DIRECTIVE =
  "CRITICAL: You MUST write every fact in Thai (ภาษาไทย). Do not use English or any other language. Character names and proper nouns may stay as-is.";

function buildSystem(existingLore: string[]): string {
  const loreList =
    existingLore.length > 0
      ? existingLore.map((l) => `- ${l}`).join("\n")
      : "(none)";
  return [
    "You extract durable world/character facts from a new chapter. Return ONLY",
    "new, lasting information: items acquired, characters introduced or killed,",
    "world rules revealed, relationships established, locations unlocked. Skip",
    "one-off events, emotions, and transient actions.",
    "",
    "Existing lore (do not duplicate):",
    loreList,
    "",
    "Output format: one fact per line starting with \"- \".",
    "If nothing new, output exactly \"NONE\". Do not add any extra commentary.",
    "",
    LANGUAGE_DIRECTIVE,
  ].join("\n");
}

export function buildLoreKeeperMessages(
  chapterTitle: string,
  chapterContent: string,
  existingLore: string[],
): Message[] {
  return [
    { role: "system", content: buildSystem(existingLore) },
    { role: "user", content: `${chapterTitle}\n\n${chapterContent}` },
  ];
}

export function parseLoreKeeperOutput(text: string): string[] {
  if (text.trim().toUpperCase() === "NONE") return [];
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter((line) => line.length > 0);
}
