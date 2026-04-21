import { describe, it, expect } from "vitest";
import { sanitizeNovel } from "../io";
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
