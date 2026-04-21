import { describe, it, expect } from "vitest";
import { sanitizeNovel, serializeToJson, parseNovelJson } from "../io";
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
});
