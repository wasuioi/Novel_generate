import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { useNovel, STORAGE_KEY, NovelProvider } from "../store";
import { DEFAULT_NOVEL } from "../types";

const wrapper = ({ children }: { children: ReactNode }) => (
  <NovelProvider>{children}</NovelProvider>
);

describe("useNovel", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns DEFAULT_NOVEL when nothing is stored", () => {
    const { result } = renderHook(() => useNovel(), { wrapper });
    expect(result.current.novel).toEqual(DEFAULT_NOVEL);
  });

  it("persists updates across hook instances (roundtrip)", async () => {
    const { result } = renderHook(() => useNovel(), { wrapper });
    act(() => {
      result.current.update((n) => { n.storyContext = "A dark forest."; });
    });
    await new Promise((r) => setTimeout(r, 400)); // past the 300ms debounce
    const { result: again } = renderHook(() => useNovel(), { wrapper });
    // second mount reads from localStorage in its mount effect
    await new Promise((r) => setTimeout(r, 0));
    expect(again.current.novel.storyContext).toBe("A dark forest.");
  });

  it("falls back to defaults when stored data is malformed", () => {
    localStorage.setItem(STORAGE_KEY, "not json");
    const { result } = renderHook(() => useNovel(), { wrapper });
    expect(result.current.novel).toEqual(DEFAULT_NOVEL);
  });

  it("falls back to an empty chapters array when stored chapters is not an array", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ chapters: null }));
    const { result } = renderHook(() => useNovel(), { wrapper });
    expect(Array.isArray(result.current.novel.chapters)).toBe(true);
    expect(result.current.novel.chapters).toEqual([]);
  });

  it("reset() clears localStorage and returns to defaults", () => {
    const { result } = renderHook(() => useNovel(), { wrapper });
    act(() => {
      result.current.update((n) => { n.storyContext = "Something."; });
      result.current.reset();
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(result.current.novel).toEqual(DEFAULT_NOVEL);
  });

  it("migrates legacy stored state by filling new fields with defaults", () => {
    const legacy = {
      storyContext: "Old context",
      chapters: [{ id: "c1", title: "Old ch", prompt: "", content: "Body.", createdAt: 1 }],
      draft: { chapterId: null, title: "", prompt: "", output: "" },
      settings: { model: "anthropic/claude-sonnet-4.6", temperature: 0.8 },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));
    const { result } = renderHook(() => useNovel(), { wrapper });
    expect(result.current.novel.lore).toEqual([]);
    expect(result.current.novel.chapters[0].summary).toBe("");
    expect(result.current.novel.settings.targetWords).toBe(1800);
    expect(result.current.novel.settings.outputLanguage).toBe("en");
  });

  it("replace() swaps state and persists immediately", () => {
    const { result } = renderHook(() => useNovel(), { wrapper });
    const incoming = {
      ...DEFAULT_NOVEL,
      storyContext: "Restored from backup.",
      chapters: [
        { id: "c1", title: "Ch", prompt: "", content: "body", summary: "", createdAt: 1 },
      ],
    };
    act(() => { result.current.replace(incoming); });
    expect(result.current.novel).toEqual(incoming);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.storyContext).toBe("Restored from backup.");
    expect(stored.chapters).toHaveLength(1);
  });
});
