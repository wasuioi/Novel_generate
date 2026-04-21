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
