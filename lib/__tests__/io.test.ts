import { describe, it, expect } from "vitest";
import { sanitizeNovel, serializeToJson, parseNovelJson, serializeToMarkdown } from "../io";
import { DEFAULT_NOVEL } from "../types";

describe("sanitizeNovel", () => {
  it("returns DEFAULT_NOVEL when input is null", () => {
    expect(sanitizeNovel(null)).toEqual(DEFAULT_NOVEL);
  });

  it("returns DEFAULT_NOVEL when input is a primitive or array", () => {
    expect(sanitizeNovel("hello")).toEqual(DEFAULT_NOVEL);
    expect(sanitizeNovel(42)).toEqual(DEFAULT_NOVEL);
    expect(sanitizeNovel([])).toEqual(DEFAULT_NOVEL);
  });

  it("accepts an unwrapped Novel-shaped object", () => {
    const input = { storyContext: "A dark forest.", chapters: [] };
    const result = sanitizeNovel(input);
    expect(result.storyContext).toBe("A dark forest.");
    expect(result.chapters).toEqual([]);
    expect(result.settings).toEqual(DEFAULT_NOVEL.settings);
  });

  it("accepts a wrapped { version: 1, novel: {...} } object", () => {
    const input = { version: 1, novel: { storyContext: "Wrapped context." } };
    const result = sanitizeNovel(input);
    expect(result.storyContext).toBe("Wrapped context.");
  });

  it("falls back to [] when chapters is not an array", () => {
    expect(sanitizeNovel({ chapters: null }).chapters).toEqual([]);
    expect(sanitizeNovel({ chapters: "nope" }).chapters).toEqual([]);
  });

  it("falls back to [] when lore is missing or not an array", () => {
    expect(sanitizeNovel({}).lore).toEqual([]);
    expect(sanitizeNovel({ lore: "nope" }).lore).toEqual([]);
  });

  it("merges partial settings with defaults", () => {
    const result = sanitizeNovel({ settings: { temperature: 0.2 } });
    expect(result.settings.temperature).toBe(0.2);
    expect(result.settings.targetWords).toBe(DEFAULT_NOVEL.settings.targetWords);
    expect(result.settings.outputLanguage).toBe(DEFAULT_NOVEL.settings.outputLanguage);
  });

  it("backfills missing chapter.summary with empty string", () => {
    const chapter = { id: "c1", title: "T", prompt: "", content: "body", createdAt: 1 };
    const result = sanitizeNovel({ chapters: [chapter] });
    expect(result.chapters[0].summary).toBe("");
  });

  it("falls back to default draft when draft is not a plain object", () => {
    expect(sanitizeNovel({ draft: "evil" }).draft).toEqual(DEFAULT_NOVEL.draft);
    expect(sanitizeNovel({ draft: 42 }).draft).toEqual(DEFAULT_NOVEL.draft);
    expect(sanitizeNovel({ draft: [1, 2] }).draft).toEqual(DEFAULT_NOVEL.draft);
    expect(sanitizeNovel({ draft: null }).draft).toEqual(DEFAULT_NOVEL.draft);
  });

  it("falls back to default settings when settings is not a plain object", () => {
    expect(sanitizeNovel({ settings: "bad" }).settings).toEqual(DEFAULT_NOVEL.settings);
    expect(sanitizeNovel({ settings: 0 }).settings).toEqual(DEFAULT_NOVEL.settings);
    expect(sanitizeNovel({ settings: [] }).settings).toEqual(DEFAULT_NOVEL.settings);
  });

  it("uses default storyContext when storyContext is not a string", () => {
    expect(sanitizeNovel({ storyContext: 123 }).storyContext).toBe(DEFAULT_NOVEL.storyContext);
    expect(sanitizeNovel({ storyContext: null }).storyContext).toBe(DEFAULT_NOVEL.storyContext);
    expect(sanitizeNovel({ storyContext: {} }).storyContext).toBe(DEFAULT_NOVEL.storyContext);
  });

  it("discards unknown top-level fields", () => {
    const result = sanitizeNovel({ storyContext: "keep", bogus: "drop me" }) as Record<string, unknown>;
    expect(result.bogus).toBeUndefined();
    expect(result.storyContext).toBe("keep");
  });
});

describe("serializeToJson / parseNovelJson round-trip", () => {
  it("round-trips a full Novel via JSON", () => {
    const n = {
      ...DEFAULT_NOVEL,
      storyContext: "Context.",
      chapters: [{ id: "c1", title: "One", prompt: "p", content: "body", summary: "s", createdAt: 1 }],
    };
    const result = parseNovelJson(serializeToJson(n));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.novel).toEqual(n);
  });

  it("serializeToJson output is wrapped with version: 1", () => {
    const raw = serializeToJson(DEFAULT_NOVEL);
    const parsed = JSON.parse(raw);
    expect(parsed.version).toBe(1);
    expect(parsed.novel).toBeDefined();
  });
});

describe("parseNovelJson errors", () => {
  it("rejects invalid JSON", () => {
    const r = parseNovelJson("not json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/valid JSON/i);
  });

  it("rejects JSON null", () => {
    const r = parseNovelJson("null");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/novel/i);
  });

  it("rejects JSON arrays", () => {
    const r = parseNovelJson("[]");
    expect(r.ok).toBe(false);
  });

  it("accepts any JSON object and sanitizes it", () => {
    const r = parseNovelJson('{"weird": "field"}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.novel.chapters).toEqual([]);
  });

  it("accepts an old-shape Draft (missing sceneSuggesterCost)", () => {
    const old = {
      storyContext: "",
      lore: [],
      chapters: [],
      draft: { chapterId: null, title: "", prompt: "", output: "" },
      settings: { model: "x", temperature: 0.5, targetWords: 1200, outputLanguage: "en" },
    };
    const result = parseNovelJson(JSON.stringify(old));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.novel.draft.sceneSuggesterCost ?? null).toBe(null);
    }
  });

  it("rejects wrapped backup with an unsupported version", () => {
    const r = parseNovelJson('{"version": 2, "novel": {}}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/version/i);
  });
});

describe("serializeToMarkdown", () => {
  it("returns empty string when there are no chapters", () => {
    expect(serializeToMarkdown(DEFAULT_NOVEL)).toBe("");
  });

  it("formats each chapter as '# Chapter N: <title>\\n\\n<content>' joined by \\n\\n", () => {
    const n = {
      ...DEFAULT_NOVEL,
      chapters: [
        { id: "c1", title: "One", prompt: "", content: "First body.", summary: "", createdAt: 1 },
        { id: "c2", title: "Two", prompt: "", content: "Second body.", summary: "", createdAt: 2 },
      ],
    };
    expect(serializeToMarkdown(n)).toBe(
      "# Chapter 1: One\n\nFirst body.\n\n# Chapter 2: Two\n\nSecond body.",
    );
  });

  it("does not include storyContext, lore, draft, or settings", () => {
    const n = {
      ...DEFAULT_NOVEL,
      storyContext: "SHOULD NOT APPEAR",
      chapters: [{ id: "c1", title: "T", prompt: "", content: "body", summary: "", createdAt: 1 }],
      lore: [{ id: "l1", text: "SHOULD NOT APPEAR", source: "ai", createdAt: 1 } as const],
      draft: { chapterId: null, title: "", prompt: "SHOULD NOT APPEAR", output: "SHOULD NOT APPEAR" },
    };
    const md = serializeToMarkdown(n);
    expect(md).not.toMatch(/SHOULD NOT APPEAR/);
  });
});
