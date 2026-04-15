"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_NOVEL, type Novel } from "./types";

export const STORAGE_KEY = "novel-generate:v1";
const DEBOUNCE_MS = 300;

function load(): Novel {
  if (typeof window === "undefined") return DEFAULT_NOVEL;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_NOVEL;
  try {
    const parsed = JSON.parse(raw) as Partial<Novel>;
    return {
      ...DEFAULT_NOVEL,
      ...parsed,
      settings: { ...DEFAULT_NOVEL.settings, ...(parsed.settings ?? {}) },
      draft:    { ...DEFAULT_NOVEL.draft,    ...(parsed.draft    ?? {}) },
    };
  } catch {
    return DEFAULT_NOVEL;
  }
}

export function useNovel() {
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

  return { novel, update, reset };
}
