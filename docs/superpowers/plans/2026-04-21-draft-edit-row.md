# Draft Edit Row Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a dedicated `▸ Draft edit — <title>` row in the sidebar immediately below the chapter being edited, and split selection highlighting so viewing the original and being in the edit-draft editor are distinct sidebar states.

**Architecture:** Purely a rendering change. No new data, no new API routes, no storage migration. `components/ChapterSidebar.tsx` gets the row rendering and highlight split; `components/ChapterWorkspace.tsx`'s `editViewedChapter` gets two extra guards (same-chapter re-click no-op, dirty-edit-draft confirm). One new Vitest file covers the sidebar rendering.

**Tech Stack:** Next.js 15 (App Router), React 19 with client components, Tailwind CSS, TypeScript. Tests run on Vitest with `jsdom` and `@testing-library/react`, same setup as `lib/__tests__/store.test.tsx`.

**Spec:** `docs/superpowers/specs/2026-04-21-draft-edit-row-design.md`

---

## Task 1: Write ChapterSidebar tests (TDD red)

**Files:**
- Create: `lib/__tests__/ChapterSidebar.test.tsx`

Five tests cover the spec's sidebar contract: no draft edit row when nothing is being edited, row placed directly after the edited chapter, and the three highlight states (viewing original, in editor for edit draft, plus the click handler on the draft edit row).

The tests seed `localStorage` with the STORAGE_KEY before rendering so that `NovelProvider`'s mount-effect `load()` populates the store — this matches how `lib/__tests__/store.test.tsx` seeds legacy state. `ChapterSidebar` depends on both `useNovel` and `useReview`, so the wrapper provides both providers.

- [ ] **Step 1: Write the test file**

Create `lib/__tests__/ChapterSidebar.test.tsx` with this exact content:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { ChapterSidebar } from "@/components/ChapterSidebar";
import { NovelProvider, STORAGE_KEY } from "@/lib/store";
import { ReviewProvider } from "@/lib/review";
import { DEFAULT_NOVEL, type Chapter, type Draft } from "@/lib/types";

function makeChapter(id: string, title: string, content = `${title} body.`): Chapter {
  return { id, title, prompt: "", content, summary: "", createdAt: 1 };
}

function seed(chapters: Chapter[], draft: Partial<Draft> = {}) {
  const state = {
    ...DEFAULT_NOVEL,
    chapters,
    draft: { ...DEFAULT_NOVEL.draft, ...draft },
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <NovelProvider>
    <ReviewProvider>{children}</ReviewProvider>
  </NovelProvider>
);

const noop = () => {};

function renderSidebar(
  overrides: Partial<Parameters<typeof ChapterSidebar>[0]> = {},
) {
  return render(
    <ChapterSidebar
      viewingId={null}
      onView={noop}
      draftActive={false}
      onStartDraft={noop}
      onOpenSettings={noop}
      {...overrides}
    />,
    { wrapper },
  );
}

describe("ChapterSidebar draft edit row", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("does not render a draft edit row when draft.chapterId is null", async () => {
    seed([makeChapter("a", "Alpha"), makeChapter("b", "Beta")]);
    renderSidebar();
    // Wait for NovelProvider's mount effect to populate state.
    expect(await screen.findByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByText(/Draft edit/i)).toBeNull();
  });

  it("renders a draft edit row immediately after the chapter being edited", async () => {
    const chapters = [
      makeChapter("a", "Alpha"),
      makeChapter("b", "Beta"),
      makeChapter("c", "Gamma"),
    ];
    seed(chapters, {
      chapterId: "b",
      title: "Beta",
      prompt: "",
      output: "edited body preview",
    });
    renderSidebar();
    await screen.findByText("Alpha");

    const text = document.body.textContent ?? "";
    const posBeta = text.indexOf("Beta");
    const posDraftEdit = text.indexOf("Draft edit");
    const posGamma = text.indexOf("Gamma");
    expect(posBeta).toBeGreaterThanOrEqual(0);
    expect(posDraftEdit).toBeGreaterThan(posBeta);
    expect(posGamma).toBeGreaterThan(posDraftEdit);
  });

  it("highlights the original row when viewing that chapter, not the draft edit row", async () => {
    seed([makeChapter("a", "Alpha"), makeChapter("b", "Beta")], {
      chapterId: "b",
      title: "Beta",
      prompt: "",
      output: "edited body",
    });
    renderSidebar({ viewingId: "b" });
    const betaButton = (await screen.findByText("Beta")).closest("button");
    const draftEditButton = screen.getByText(/Draft edit/i).closest("button");
    expect(betaButton?.className).toContain("bg-zinc-800");
    expect(draftEditButton?.className).not.toContain("bg-zinc-800");
  });

  it("highlights the draft edit row when the editor is open (viewingId=null)", async () => {
    seed([makeChapter("a", "Alpha"), makeChapter("b", "Beta")], {
      chapterId: "b",
      title: "Beta",
      prompt: "",
      output: "edited body",
    });
    renderSidebar({ viewingId: null });
    const betaButton = (await screen.findByText("Beta")).closest("button");
    const draftEditButton = screen.getByText(/Draft edit/i).closest("button");
    expect(draftEditButton?.className).toContain("bg-zinc-800");
    expect(betaButton?.className).not.toContain("bg-zinc-800");
  });

  it("clicking the draft edit row calls onView(null)", async () => {
    seed([makeChapter("a", "Alpha"), makeChapter("b", "Beta")], {
      chapterId: "b",
      title: "Beta",
      prompt: "",
      output: "edited body",
    });
    const calls: Array<string | null> = [];
    const onView = (id: string | null) => calls.push(id);
    renderSidebar({ viewingId: "b", onView });
    const draftEditButton = (await screen.findByText(/Draft edit/i)).closest(
      "button",
    ) as HTMLButtonElement;
    draftEditButton.click();
    expect(calls).toEqual([null]);
  });
});
```

- [ ] **Step 2: Run the new tests and verify they fail**

Run: `npx vitest run lib/__tests__/ChapterSidebar.test.tsx`

Expected: the first test ("does not render a draft edit row...") passes, but the other four fail because there is no "Draft edit" text rendered anywhere and the highlight still uses the combined condition. Confirm the failures mention missing "Draft edit" text before continuing.

- [ ] **Step 3: Commit the failing tests**

```bash
git add lib/__tests__/ChapterSidebar.test.tsx
git commit -m "test: add sidebar tests for draft edit row (failing)"
```

---

## Task 2: Render the draft edit row in `ChapterSidebar`

**Files:**
- Modify: `components/ChapterSidebar.tsx`

Add the draft edit row directly after the chapter whose id matches `draft.chapterId`, split the highlight expression so the original row and the draft edit row each own their own selection, and import `Fragment` so a chapter + its (optional) draft edit row share a single keyed slot in the map.

- [ ] **Step 1: Import `Fragment`**

In `components/ChapterSidebar.tsx`, at the top of the file, add React's `Fragment` to the existing imports. The file currently has no React import; add one:

```tsx
"use client";
import { Fragment } from "react";
import { useNovel } from "@/lib/store";
import { useReview } from "@/lib/review";
import { Button } from "./ui/Button";
```

- [ ] **Step 2: Replace the chapters `.map(...)` block with the split rendering**

In `components/ChapterSidebar.tsx`, find the block (currently lines 46-68) that starts with `{chapters.map((c) => {` and ends with the closing `})}`. Replace it entirely with:

```tsx
{chapters.map((c) => {
  const chapterHighlight = viewingId === c.id;
  const draftEditHighlight = viewingId === null && draft.chapterId === c.id;
  const draftEditTitle = draft.title || c.title || "(untitled)";
  return (
    <Fragment key={c.id}>
      <button
        onClick={() => onView(c.id)}
        className={`w-full text-left p-3 border-b border-zinc-900 hover:bg-zinc-800 ${
          chapterHighlight ? "bg-zinc-800" : ""
        }`}
      >
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-sm font-medium truncate">{c.title || "(untitled)"}</div>
          {c.cost && (
            <div className="text-[10px] font-mono text-zinc-500 shrink-0">
              ${c.cost.totalUsd.toFixed(4)}
            </div>
          )}
        </div>
        <div className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{preview(c.content)}</div>
      </button>
      {draft.chapterId === c.id && (
        <button
          onClick={() => onView(null)}
          className={`w-full text-left p-3 border-b border-zinc-900 hover:bg-zinc-800 ${
            draftEditHighlight ? "bg-zinc-800" : ""
          }`}
        >
          <div className="text-sm font-medium text-emerald-400">
            ▸ Draft edit — {draftEditTitle}
          </div>
          <div className="text-xs text-zinc-500 mt-0.5 line-clamp-2">
            {preview(draft.output) || "(empty)"}
          </div>
        </button>
      )}
    </Fragment>
  );
})}
```

The bottom `{showDraftRow && (...)}` block stays as-is — it continues to render only for new-chapter drafts (`draft.chapterId === null`).

- [ ] **Step 3: Run the sidebar tests and verify they pass**

Run: `npx vitest run lib/__tests__/ChapterSidebar.test.tsx`

Expected: all five tests pass.

- [ ] **Step 4: Run the full test suite and typecheck**

Run: `npx tsc --noEmit && npx vitest run`

Expected: typecheck exits 0; every Vitest test passes (no regressions in `store`, `prompt`, `prices`, `streamMeta`, `agents`).

- [ ] **Step 5: Commit**

```bash
git add components/ChapterSidebar.tsx
git commit -m "feat: render draft edit row and split sidebar highlight"
```

---

## Task 3: Guard `editViewedChapter` against clobbering an edit draft

**Files:**
- Modify: `components/ChapterWorkspace.tsx`

`editViewedChapter` currently only confirms when a **new-chapter** draft would be discarded. With edit drafts now visible in the sidebar, the same guard must apply to edit drafts, and clicking Edit on the chapter already being edited should be a no-op (otherwise the user's in-progress edits get reset from the original chapter content).

- [ ] **Step 1: Replace `editViewedChapter` with the new implementation**

In `components/ChapterWorkspace.tsx`, find the existing `editViewedChapter` function (currently lines 342-361). Replace the entire function with:

```tsx
const editViewedChapter = () => {
  if (!viewedChapter) return;

  if (draft.chapterId === viewedChapter.id) {
    onClearView();
    return;
  }

  if (
    draft.chapterId === null &&
    draft.output.trim() &&
    !window.confirm("You have an unsaved new draft. Loading this chapter will discard it. Continue?")
  ) {
    return;
  }

  if (draft.chapterId !== null && draft.chapterId !== viewedChapter.id) {
    const origin = novel.chapters.find((c) => c.id === draft.chapterId);
    const dirty =
      !!origin &&
      (draft.title !== origin.title ||
        draft.prompt !== origin.prompt ||
        draft.output !== origin.content);
    if (
      dirty &&
      !window.confirm(
        `You have unsaved changes in your edit of "${origin!.title || "(untitled)"}". Loading this chapter will discard them. Continue?`,
      )
    ) {
      return;
    }
  }

  update((n) => {
    n.draft = {
      chapterId: viewedChapter.id,
      title: viewedChapter.title,
      prompt: viewedChapter.prompt,
      output: viewedChapter.content,
      writerCost: null,
    };
  });
  onClearView();
};
```

- [ ] **Step 2: Run typecheck and the full test suite**

Run: `npx tsc --noEmit && npx vitest run`

Expected: typecheck exits 0; all tests still pass. No regression in any existing test because this function is only exercised by manual clicks on "✎ Edit this chapter".

- [ ] **Step 3: Commit**

```bash
git add components/ChapterWorkspace.tsx
git commit -m "feat: guard edit draft against accidental overwrite"
```

---

## Task 4: Manual smoke test

No automated test covers the end-to-end click behaviour of "✎ Edit this chapter" or the confirm dialogs. Run the dev server and verify the scenarios below.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: Next.js prints `Ready in <N>ms`, app reachable at the URL it prints (usually `http://localhost:3000`).

- [ ] **Step 2: Set up at least two saved chapters**

In the browser:
1. Open the app.
2. Write story context, write a chapter prompt, Generate (or paste into the Output textarea), Send to Chapter History, Approve. Repeat so you have three chapters: Ch.1, Ch.2, Ch.3.

- [ ] **Step 3: Verify the draft edit row appears in the right place**

1. Click Ch.2 in the sidebar → viewer opens.
2. Click "✎ Edit this chapter".
3. Sidebar now shows (top to bottom): Ch.1, Ch.2, `▸ Draft edit — <Ch.2 title>` (emerald), Ch.3. The draft edit row is immediately below Ch.2.
4. The `▸ Draft edit` row is highlighted (grey background); Ch.2's row is not.

- [ ] **Step 4: Verify highlight toggles with viewing**

1. With the editor open from Step 3, click Ch.2 in the sidebar. Viewer reopens showing frozen original content. Ch.2 row becomes highlighted; `▸ Draft edit` row loses its highlight.
2. Click the `▸ Draft edit` row. Editor reopens with the edit draft. Highlight swaps back.

- [ ] **Step 5: Verify "Edit this chapter" on the currently-edited chapter is a no-op**

1. From the editor, type an extra sentence into the Output textarea of the edit draft.
2. Click Ch.2 row → viewer opens (showing frozen original, NOT your edits).
3. Click "✎ Edit this chapter" again. You should land back in the editor with your extra sentence still intact (NOT reset to the original content). No confirm dialog.

- [ ] **Step 6: Verify dirty-edit-draft confirm when switching chapters**

1. While editing Ch.2 (with unsaved edits from Step 5), click Ch.3 in the sidebar → viewer opens.
2. Click "✎ Edit this chapter" on Ch.3.
3. A confirm dialog appears: `You have unsaved changes in your edit of "<Ch.2 title>". Loading this chapter will discard them. Continue?`
4. Click Cancel → nothing changes; Ch.2 edit draft is still the active draft, sidebar row still below Ch.2.
5. Re-trigger the flow, this time click OK → edit draft switches to Ch.3; sidebar row now sits below Ch.3.

- [ ] **Step 7: Verify no confirm when the edit draft is clean**

1. Click the `▸ Draft edit — <Ch.3 title>` row → editor shows Ch.3's content. Do NOT type anything.
2. Click Ch.2 → viewer opens. Click "✎ Edit this chapter".
3. No confirm dialog appears (because the Ch.3 edit draft matches the original content exactly). Edit draft switches to Ch.2.

- [ ] **Step 8: Verify new-chapter draft still lives at the bottom**

1. Discard the current edit draft (click Discard, confirm).
2. Click "+ New chapter" in the sidebar.
3. Bottom `▸ Draft` row still appears at the bottom of the list (behaviour unchanged from before this feature).

- [ ] **Step 9: Verify approve still overwrites the original chapter**

1. Click "✎ Edit this chapter" on Ch.2. Replace the output content with something recognizable like "REWRITTEN.". Send to Chapter History, Approve.
2. Sidebar's `▸ Draft edit` row disappears; Ch.2's row preview now shows "REWRITTEN.".
3. Click Ch.2 in the sidebar — viewer shows "REWRITTEN." as the full content.

- [ ] **Step 10: Stop the dev server**

Ctrl+C in the terminal running `npm run dev`.

No additional commit — the manual-test task produces no code changes.

---

## Summary of files

| File | Change |
|------|--------|
| `components/ChapterSidebar.tsx` | **Modify** — add `Fragment` import, split chapter-row highlight, render draft edit row after the edited chapter |
| `components/ChapterWorkspace.tsx` | **Modify** — add same-chapter no-op and dirty-edit-draft confirm to `editViewedChapter` |
| `lib/__tests__/ChapterSidebar.test.tsx` | **Create** — five Vitest + RTL tests covering row placement, highlight states, and click handler |

No changes to: `lib/types.ts`, `lib/store.tsx`, `lib/prompt.ts`, `lib/review.tsx`, any file under `app/`, or any existing test file.
