import type { SceneSuggestion, Message, Novel } from "../types";
import { buildContextBlocks } from "../prompt";

const MAX_TITLE = 200;
const MAX_SYNOPSIS = 2000;

export type ParseResult =
  | { ok: true; suggestions: SceneSuggestion[] }
  | { ok: false; error: string };

export function parseSceneSuggestions(raw: string): ParseResult {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return { ok: false, error: "Response was not valid JSON" };
  }
  if (!Array.isArray(parsed) || parsed.length !== 3) {
    return { ok: false, error: "Expected a JSON array of exactly 3 items" };
  }

  const suggestions: SceneSuggestion[] = [];
  for (const item of parsed) {
    if (
      typeof item !== "object" || item === null ||
      typeof (item as Record<string, unknown>).title !== "string" ||
      typeof (item as Record<string, unknown>).synopsis !== "string"
    ) {
      return { ok: false, error: "Each item must have string title + synopsis" };
    }
    const title = (item as { title: string; synopsis: string }).title.trim();
    const synopsis = (item as { title: string; synopsis: string }).synopsis.trim();
    if (!title || !synopsis) {
      return { ok: false, error: "Title and synopsis must be non-empty" };
    }
    if (title.length > MAX_TITLE || synopsis.length > MAX_SYNOPSIS) {
      return { ok: false, error: "Title or synopsis exceeds max length" };
    }
    suggestions.push({ title, synopsis });
  }
  return { ok: true, suggestions };
}

const THAI_LANG = "Write the title AND synopsis in natural Thai (ภาษาไทย).";
const ENGLISH_LANG = "Write the title AND synopsis in natural English.";

const INSTRUCTIONS = [
  "You are a scene-idea brainstormer for a novel in progress.",
  "",
  "Given the current story context, established lore, and chapter history,",
  "propose exactly 3 DISTINCT directions for the NEXT chapter.",
  "",
  "Each proposal must:",
  "- be a meaningful plot direction, not a minor variation of the others",
  "- be consistent with established lore",
  "- have a concrete hook that makes the reader want the next chapter",
  "",
  "Output format — JSON array of 3 objects, no other text, no markdown fence:",
  "[",
  '  { "title": "short chapter title", "synopsis": "3-5 line synopsis: setup, key beats, ending hook" },',
  "  ...",
  "]",
].join("\n");

export function buildSceneSuggestMessages(novel: Novel): Message[] {
  const langLine = novel.settings.outputLanguage === "th" ? THAI_LANG : ENGLISH_LANG;
  const system = [INSTRUCTIONS, "", langLine, "", ...buildContextBlocks(novel)].join("\n\n");
  const user = "Propose 3 distinct directions for the next chapter as JSON.";
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
