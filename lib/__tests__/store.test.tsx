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
});
