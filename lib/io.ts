import { DEFAULT_NOVEL, type Chapter, type Novel } from "./types";

type StoredChapter = Omit<Chapter, "summary"> & { summary?: string };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function unwrap(obj: Record<string, unknown>): Record<string, unknown> {
  if (obj.version === 1 && isPlainObject(obj.novel)) {
    return obj.novel;
  }
  return obj;
}

function migrateSettings(raw: Record<string, unknown>): Partial<Novel["settings"]> {
  const out: Partial<Novel["settings"]> = {};
  if (typeof raw.model === "string") out.model = raw.model;
  if (typeof raw.temperature === "number") out.temperature = raw.temperature;
  if (typeof raw.targetChars === "number") {
    out.targetChars = raw.targetChars;
  } else if (typeof raw.targetWords === "number") {
    const migrated = Math.round(raw.targetWords * 4.5);
    out.targetChars = Math.max(3000, Math.min(20000, migrated));
  }
  return out;
}

export function sanitizeNovel(raw: unknown): Novel {
  if (!isPlainObject(raw)) return DEFAULT_NOVEL;
  const parsed = unwrap(raw);
  const chapters: Chapter[] = Array.isArray(parsed.chapters)
    ? (parsed.chapters as StoredChapter[]).map((c) => ({ ...c, summary: c.summary ?? "" }))
    : DEFAULT_NOVEL.chapters;
  return {
    storyContext:
      typeof parsed.storyContext === "string" ? parsed.storyContext : DEFAULT_NOVEL.storyContext,
    chapters,
    lore: Array.isArray(parsed.lore) ? (parsed.lore as Novel["lore"]) : DEFAULT_NOVEL.lore,
    settings: isPlainObject(parsed.settings)
      ? { ...DEFAULT_NOVEL.settings, ...migrateSettings(parsed.settings) }
      : DEFAULT_NOVEL.settings,
    draft: isPlainObject(parsed.draft)
      ? { ...DEFAULT_NOVEL.draft, ...(parsed.draft as Partial<Novel["draft"]>) }
      : DEFAULT_NOVEL.draft,
  };
}

export function serializeToJson(novel: Novel): string {
  return JSON.stringify({ version: 1, novel }, null, 2);
}

export function parseNovelJson(
  raw: string,
): { ok: true; novel: Novel } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "File is not valid JSON" };
  }
  if (!isPlainObject(parsed)) {
    return { ok: false, error: "File does not contain a novel" };
  }
  if ("version" in parsed && parsed.version !== 1) {
    return { ok: false, error: `Unsupported backup version: ${String(parsed.version)}` };
  }
  return { ok: true, novel: sanitizeNovel(parsed) };
}

export function serializeToMarkdown(novel: Novel): string {
  return novel.chapters
    .map((c, i) => `# Chapter ${i + 1}: ${c.title}\n\n${c.content}`)
    .join("\n\n");
}
