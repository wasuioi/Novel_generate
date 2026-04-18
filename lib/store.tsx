"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_NOVEL, type Chapter, type Novel } from "./types";

export const STORAGE_KEY = "novel-generate:v1";
const DEBOUNCE_MS = 300;

type StoredChapter = Omit<Chapter, "summary"> & { summary?: string };
type StoredNovel = Omit<Partial<Novel>, "chapters"> & { chapters?: StoredChapter[] };

function load(): Novel {
  if (typeof window === "undefined") return DEFAULT_NOVEL;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_NOVEL;
  try {
    const parsed = JSON.parse(raw) as StoredNovel;
    const chapters: Chapter[] = Array.isArray(parsed.chapters)
      ? parsed.chapters.map((c) => ({ ...c, summary: c.summary ?? "" }))
      : DEFAULT_NOVEL.chapters;
    return {
      ...DEFAULT_NOVEL,
      ...parsed,
      chapters,
      lore: Array.isArray(parsed.lore) ? parsed.lore : DEFAULT_NOVEL.lore,
      settings: { ...DEFAULT_NOVEL.settings, ...(parsed.settings ?? {}) },
      draft:    { ...DEFAULT_NOVEL.draft,    ...(parsed.draft    ?? {}) },
    };
  } catch {
    return DEFAULT_NOVEL;
  }
}

type NovelContextValue = {
  novel: Novel;
  update: (mutator: (draft: Novel) => void) => void;
  reset: () => void;
};

const NovelContext = createContext<NovelContextValue | null>(null);

export function NovelProvider({ children }: { children: ReactNode }) {
  const [novel, setNovel] = useState<Novel>(DEFAULT_NOVEL);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setNovel(load());
  }, []);

  const save = useCallback((n: Novel) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(n));
    }, DEBOUNCE_MS);
  }, []);

  const update = useCallback(
    (mutator: (draft: Novel) => void) => {
      setNovel((prev) => {
        const copy = structuredClone(prev);
        mutator(copy);
        save(copy);
        return copy;
      });
    },
    [save],
  );

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    window.localStorage.removeItem(STORAGE_KEY);
    setNovel(DEFAULT_NOVEL);
  }, []);

  return (
    <NovelContext.Provider value={{ novel, update, reset }}>
      {children}
    </NovelContext.Provider>
  );
}

export function useNovel(): NovelContextValue {
  const ctx = useContext(NovelContext);
  if (!ctx) throw new Error("useNovel must be used within a NovelProvider");
  return ctx;
}
