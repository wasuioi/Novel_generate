import { DEFAULT_NOVEL, type Chapter, type Novel } from "./types";

type StoredChapter = Omit<Chapter, "summary"> & { summary?: string };

function unwrap(obj: Record<string, unknown>): Record<string, unknown> {
  if (
    obj.version === 1 &&
    obj.novel &&
    typeof obj.novel === "object" &&
    !Array.isArray(obj.novel)
  ) {
    return obj.novel as Record<string, unknown>;
  }
  return obj;
}

export function sanitizeNovel(raw: unknown): Novel {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return DEFAULT_NOVEL;
  const parsed = unwrap(raw as Record<string, unknown>);
  const rawChapters = parsed.chapters;
  const chapters: Chapter[] = Array.isArray(rawChapters)
    ? (rawChapters as StoredChapter[]).map((c) => ({ ...c, summary: c.summary ?? "" }))
    : DEFAULT_NOVEL.chapters;
  return {
    ...DEFAULT_NOVEL,
    ...(parsed as Partial<Novel>),
    chapters,
    lore: Array.isArray(parsed.lore) ? (parsed.lore as Novel["lore"]) : DEFAULT_NOVEL.lore,
    settings: {
      ...DEFAULT_NOVEL.settings,
      ...((parsed.settings ?? {}) as Partial<Novel["settings"]>),
    },
    draft: {
      ...DEFAULT_NOVEL.draft,
      ...((parsed.draft ?? {}) as Partial<Novel["draft"]>),
    },
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
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "File does not contain a novel" };
  }
  return { ok: true, novel: sanitizeNovel(parsed) };
}
