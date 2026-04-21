# Export / Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users export their novel as `.md` (readable) or `.json` (full backup), and restore a `.json` backup by replacing the current novel.

**Architecture:** Client-only. A new `lib/io.ts` holds pure serialize/sanitize/parse functions. `lib/store.tsx` reuses the sanitize function for localStorage load and exposes a new `replace(novel)` method. `components/SettingsDrawer.tsx` gains three buttons (Export `.md`, Export backup, Import backup) in its bottom bar that wire up to `lib/io.ts` and `replace()`.

**Tech Stack:** Next.js 15, React 19, TypeScript, Vitest, jsdom, native Blob / FileReader APIs (no new dependencies).

**Spec reference:** `docs/superpowers/specs/2026-04-21-export-import-design.md`

---

## File Structure

- **Create** `lib/io.ts` — pure functions: `sanitizeNovel`, `serializeToJson`, `parseNovelJson`, `serializeToMarkdown`.
- **Create** `lib/__tests__/io.test.ts` — unit tests for `lib/io.ts`.
- **Modify** `lib/store.tsx` — replace in-line validation with `sanitizeNovel`; add `replace(novel)` to the context.
- **Modify** `lib/__tests__/store.test.tsx` — append tests for the new `replace()` method.
- **Modify** `components/SettingsDrawer.tsx` — add Export/Import UI, hidden file input, handlers, error state; expand the bottom bar.

---

## Task 1: `sanitizeNovel` — accept any input, return a valid Novel

**Files:**
- Create: `lib/io.ts`
- Create: `lib/__tests__/io.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/io.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/io.test.ts`
Expected: FAIL — `Cannot find module '../io'` (file does not exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `lib/io.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/__tests__/io.test.ts`
Expected: PASS — 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/io.ts lib/__tests__/io.test.ts
git commit -m "feat: add sanitizeNovel utility in lib/io.ts"
```

---

## Task 2: `serializeToJson` + `parseNovelJson` (round-trip)

**Files:**
- Modify: `lib/io.ts`
- Modify: `lib/__tests__/io.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `lib/__tests__/io.test.ts` (inside the existing file, below the `sanitizeNovel` describe block):

```typescript
import { serializeToJson, parseNovelJson } from "../io";

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/io.test.ts`
Expected: FAIL — `serializeToJson` and `parseNovelJson` are not exported from `../io`.

- [ ] **Step 3: Write minimal implementation**

Append to `lib/io.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/__tests__/io.test.ts`
Expected: PASS — all tests in `io.test.ts` pass (7 + 2 + 4 = 13).

- [ ] **Step 5: Commit**

```bash
git add lib/io.ts lib/__tests__/io.test.ts
git commit -m "feat: add serializeToJson and parseNovelJson round-trip"
```

---

## Task 3: `serializeToMarkdown` — chapters only, in order

**Files:**
- Modify: `lib/io.ts`
- Modify: `lib/__tests__/io.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `lib/__tests__/io.test.ts`:

```typescript
import { serializeToMarkdown } from "../io";

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/io.test.ts`
Expected: FAIL — `serializeToMarkdown` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `lib/io.ts`:

```typescript
export function serializeToMarkdown(novel: Novel): string {
  return novel.chapters
    .map((c, i) => `# Chapter ${i + 1}: ${c.title}\n\n${c.content}`)
    .join("\n\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/__tests__/io.test.ts`
Expected: PASS — all 16 tests in the file pass.

- [ ] **Step 5: Commit**

```bash
git add lib/io.ts lib/__tests__/io.test.ts
git commit -m "feat: add serializeToMarkdown for readable export"
```

---

## Task 4: Refactor `store.load()` to use `sanitizeNovel`

**Files:**
- Modify: `lib/store.tsx`

This task deduplicates validation logic. The existing `store.test.tsx` covers the behavior; no new test needed — existing tests must continue to pass.

- [ ] **Step 1: Confirm existing store tests pass before refactoring**

Run: `npx vitest run lib/__tests__/store.test.tsx`
Expected: PASS — all existing tests pass.

- [ ] **Step 2: Refactor `lib/store.tsx`**

Replace the top of `lib/store.tsx` — everything from the top `"use client";` through the end of the `load()` function (current lines 1–40) — with:

```typescript
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
import { DEFAULT_NOVEL, type Novel } from "./types";
import { sanitizeNovel } from "./io";

export const STORAGE_KEY = "novel-generate:v1";
const DEBOUNCE_MS = 300;

function load(): Novel {
  if (typeof window === "undefined") return DEFAULT_NOVEL;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_NOVEL;
  try {
    return sanitizeNovel(JSON.parse(raw));
  } catch {
    return DEFAULT_NOVEL;
  }
}
```

Key changes:
- Remove the now-unused `Chapter` import and the local `StoredChapter` / `StoredNovel` types.
- `load()` delegates all shape validation to `sanitizeNovel`.

Everything below `load()` (from `type NovelContextValue` onward) stays exactly as it was.

- [ ] **Step 3: Run all tests to verify no regression**

Run: `npx vitest run`
Expected: PASS — all tests in both `io.test.ts` and `store.test.tsx` pass. The existing "migrates legacy stored state" test in `store.test.tsx` confirms `sanitizeNovel` handles legacy localStorage blobs correctly.

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/store.tsx
git commit -m "refactor: store.load uses sanitizeNovel for validation"
```

---

## Task 5: Add `replace(novel)` to the novel store

**Files:**
- Modify: `lib/store.tsx`
- Modify: `lib/__tests__/store.test.tsx`

- [ ] **Step 1: Write the failing test**

Append this test inside the existing `describe("useNovel", ...)` block in `lib/__tests__/store.test.tsx` (before the closing `});`):

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/store.test.tsx`
Expected: FAIL — `result.current.replace is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `lib/store.tsx`, make three changes:

1. Update the `NovelContextValue` type:

```typescript
type NovelContextValue = {
  novel: Novel;
  update: (mutator: (draft: Novel) => void) => void;
  replace: (novel: Novel) => void;
  reset: () => void;
};
```

2. Add the `replace` callback inside `NovelProvider` (place it just after `update`, before `reset`):

```typescript
  const replace = useCallback((n: Novel) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(n));
    setNovel(n);
  }, []);
```

3. Include `replace` in the provider value:

```typescript
    <NovelContext.Provider value={{ novel, update, replace, reset }}>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/__tests__/store.test.tsx`
Expected: PASS — all existing store tests plus the new one pass.

- [ ] **Step 5: Commit**

```bash
git add lib/store.tsx lib/__tests__/store.test.tsx
git commit -m "feat: add replace() method to novel store"
```

---

## Task 6: SettingsDrawer — Export `.md` and `.json` buttons

**Files:**
- Modify: `components/SettingsDrawer.tsx`

No unit test — the logic is already covered by `lib/__tests__/io.test.ts`; this task wires the UI. Manual verification in Task 8.

- [ ] **Step 1: Add imports and helpers at the top of `components/SettingsDrawer.tsx`**

After the existing `"use client";` line, replace the import block through line 6 with:

```typescript
"use client";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useNovel } from "@/lib/store";
import { useReview } from "@/lib/review";
import {
  serializeToJson,
  serializeToMarkdown,
  parseNovelJson,
} from "@/lib/io";
import { Button } from "./ui/Button";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function triggerDownload(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Get `replace` from the store hook and add handlers**

Inside the `SettingsDrawer` component, change this line:

```typescript
  const { novel, update, reset } = useNovel();
```

to:

```typescript
  const { novel, update, replace, reset } = useNovel();
```

Then, right after the existing `onReset` handler, add:

```typescript
  const handleExportMd = () => {
    triggerDownload(`novel-${today()}.md`, serializeToMarkdown(novel), "text/markdown");
  };

  const handleExportJson = () => {
    triggerDownload(
      `novel-backup-${today()}.json`,
      serializeToJson(novel),
      "application/json",
    );
  };
```

(We'll use `replace` in Task 7. TypeScript does not complain about unused destructured values.)

- [ ] **Step 3: Expand the bottom bar with the two Export buttons**

Find the current bottom bar near the end of the component:

```tsx
      <div className="absolute bottom-0 inset-x-0 p-4 border-t border-zinc-800">
        <Button variant="danger" className="w-full" onClick={onReset}>
          Start New Novel (Clear All Data)
        </Button>
      </div>
```

Replace it with:

```tsx
      <div className="absolute bottom-0 inset-x-0 p-4 border-t border-zinc-800 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={handleExportMd}>
            Export as .md
          </Button>
          <Button variant="secondary" onClick={handleExportJson}>
            Export backup
          </Button>
        </div>
        <Button variant="danger" className="w-full" onClick={onReset}>
          Start New Novel (Clear All Data)
        </Button>
      </div>
```

- [ ] **Step 4: Run typecheck and existing tests**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx vitest run`
Expected: PASS — all tests still pass.

- [ ] **Step 5: Commit**

```bash
git add components/SettingsDrawer.tsx
git commit -m "feat: export .md and .json buttons in SettingsDrawer"
```

---

## Task 7: SettingsDrawer — Import button + file input + error state

**Files:**
- Modify: `components/SettingsDrawer.tsx`

- [ ] **Step 1: Add import state and handlers**

Inside the `SettingsDrawer` component, after the existing `useEffect` (the model-migration effect around line 22–26), add:

```typescript
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the user re-pick the same file
    if (!file) return;
    const text = await file.text();
    const result = parseNovelJson(text);
    if (!result.ok) {
      setImportError(result.error);
      return;
    }
    const ok = window.confirm(
      "Import will replace your current novel. This cannot be undone. Continue?",
    );
    if (!ok) return;
    replace(result.novel);
    setImportError(null);
    onClose();
  };
```

- [ ] **Step 2: Add the Import button, error message, and hidden file input to the bottom bar**

Replace the bottom bar block from Task 6:

```tsx
      <div className="absolute bottom-0 inset-x-0 p-4 border-t border-zinc-800 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={handleExportMd}>
            Export as .md
          </Button>
          <Button variant="secondary" onClick={handleExportJson}>
            Export backup
          </Button>
        </div>
        <Button variant="danger" className="w-full" onClick={onReset}>
          Start New Novel (Clear All Data)
        </Button>
      </div>
```

with:

```tsx
      <div className="absolute bottom-0 inset-x-0 p-4 border-t border-zinc-800 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={handleExportMd}>
            Export as .md
          </Button>
          <Button variant="secondary" onClick={handleExportJson}>
            Export backup
          </Button>
        </div>
        <Button variant="secondary" className="w-full" onClick={handleImportClick}>
          Import backup
        </Button>
        {importError && (
          <p className="text-xs text-red-400" aria-live="polite">
            {importError}
          </p>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileSelected}
          className="hidden"
        />
        <Button variant="danger" className="w-full" onClick={onReset}>
          Start New Novel (Clear All Data)
        </Button>
      </div>
```

- [ ] **Step 3: Run typecheck and full test suite**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx vitest run`
Expected: PASS — all tests pass.

- [ ] **Step 4: Commit**

```bash
git add components/SettingsDrawer.tsx
git commit -m "feat: import backup button in SettingsDrawer"
```

---

## Task 8: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Open: `http://localhost:3000`

- [ ] **Step 2: Export `.json` sanity check**

1. Open Settings (gear icon in sidebar).
2. If the novel is empty, add a bit of story context + one chapter first (so there's something to export).
3. Click **Export backup**.
4. A file `novel-backup-YYYY-MM-DD.json` should download.
5. Open it in a text editor — confirm the top-level shape is `{ "version": 1, "novel": { ... } }`, and that `novel.chapters`, `novel.storyContext`, `novel.settings`, `novel.draft`, `novel.lore` are all present.

- [ ] **Step 3: Export `.md` sanity check**

1. Click **Export as .md**.
2. File `novel-YYYY-MM-DD.md` should download.
3. Open it — verify: one `# Chapter N: <title>` heading per saved chapter, in the same order the sidebar shows them, content below each heading. No story context, no lore, no draft text.

- [ ] **Step 4: Successful round-trip import**

1. Click **Import backup** and pick the `.json` file from Step 2.
2. Confirm the dialog ("Import will replace your current novel…").
3. Expected: drawer closes, the story context / chapters / settings match what was in the file.
4. Re-open Settings and click **Import backup** with the same file again — confirm it still works (the `e.target.value = ""` line lets you re-select the same file).

- [ ] **Step 5: Cancelled import leaves state untouched**

1. Change the story context to something distinctive (e.g. `"DO NOT OVERWRITE"`).
2. Click **Import backup** → pick the backup file → press **Cancel** on the confirmation dialog.
3. Expected: story context is still `"DO NOT OVERWRITE"`, no error shown.

- [ ] **Step 6: Malformed JSON shows error inline**

1. In a text editor, create a file `bad.json` with content `this is not json`.
2. Click **Import backup** → pick `bad.json`.
3. Expected: a red error message `File is not valid JSON` appears under the Import button; the current novel is unchanged; no `window.confirm` shows up.

- [ ] **Step 7: JSON-but-not-object shows error**

1. Create a file `array.json` with content `[]`.
2. Click **Import backup** → pick `array.json`.
3. Expected: red error `File does not contain a novel`; novel unchanged.

- [ ] **Step 8: Error clears on a successful import**

1. After Step 6 or 7, without refreshing, click **Import backup** and pick the good backup from Step 2.
2. Confirm the dialog.
3. Expected: drawer closes, error message is gone on next open.

- [ ] **Step 9: Final regression check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all green.

- [ ] **Step 10: Report results**

If any manual step fails, do not mark the feature complete — record which step, what you saw, and fix the underlying issue before committing further.
