# Draft Edit Row — Design

**Date:** 2026-04-21
**Status:** Approved (brainstorming complete)
**Builds on:** `2026-04-15-novel-generate-design.md`

## Motivation

When a user clicks "✎ Edit this chapter" on an existing chapter, the draft is loaded into the single `draft` slot (with `draft.chapterId` set), but the sidebar gives no visual indication that an edit draft exists — it only highlights the original chapter row.

This is confusing in two ways:

1. Clicking the highlighted chapter row takes the user to the **viewer** (showing the frozen original content), not back to their edit-in-progress. To return to editing they must press "← Back to draft" in the viewer.
2. There is no persistent indicator in the sidebar that an edit draft is in flight for a specific chapter — a user who scrolls away or opens other chapters can lose track of which chapter they were editing.

A new-chapter draft already gets its own `▸ Draft` row at the bottom of the sidebar. Edit drafts deserve the same treatment, anchored to the chapter they target.

## Goal

Add a visible `▸ Draft edit — <title>` row in the sidebar that appears immediately below the chapter being edited, and split selection highlighting so viewing the original and being in the edit-draft editor are distinct sidebar states.

Out of scope: allowing a new-chapter draft and an edit draft to coexist; multiple concurrent edit drafts; any changes to the commit/approve behavior (approving still overwrites the original chapter as it does today).

## Architecture

No data model changes, no new API routes, no storage migration. The `draft: { chapterId, title, prompt, output, writerCost }` shape stays the same, and drafts remain mutually exclusive (one draft at a time — either new-chapter or edit, not both).

All changes are in two component files plus a new test file:

- `components/ChapterSidebar.tsx` — add the draft-edit row; split highlight logic.
- `components/ChapterWorkspace.tsx` — adjust `editViewedChapter` to handle re-clicks on the already-edited chapter and to confirm before replacing a dirty edit draft.
- `lib/__tests__/ChapterSidebar.test.tsx` (new) — covers row placement and highlight states.

## Sidebar rendering

When iterating `novel.chapters`, for each chapter `c`:

1. Render the original chapter row (same as today).
2. If `draft.chapterId === c.id`, render a **draft edit row** immediately after it:
   - Label: `▸ Draft edit — <draft.title or chapter.title or "(untitled)">`
   - Preview body: first two lines of `draft.output` (same `preview()` helper used elsewhere).
   - Color: same emerald accent used for the existing `▸ Draft` row so the two "draft" concepts look like a family.
   - Click handler: `onView(null)` (returns user to the editor, same behavior as the new-chapter Draft row).

The existing bottom-of-list `▸ Draft` row for new-chapter drafts is unchanged.

## Highlight logic

Today, a chapter row is highlighted when **either** the user is viewing that chapter **or** they are in the editor for an edit draft of that chapter. Split these two conditions so each row owns one state:

| Condition | Row highlighted |
|---|---|
| `viewingId === c.id` | Original chapter row |
| `viewingId === null && draft.chapterId === c.id` | Draft edit row (not the original) |
| `viewingId === null && draft.chapterId === null` and new-chapter draft is active or has content | Bottom `▸ Draft` row (unchanged) |

Concretely in `ChapterSidebar.tsx`:

```ts
// was:
const highlight = viewingId === c.id || (viewingId === null && draft.chapterId === c.id);

// becomes:
const chapterHighlight = viewingId === c.id;
const draftEditHighlight = viewingId === null && draft.chapterId === c.id;
```

## Click behavior

- Click original chapter row → `onView(c.id)` → read-only viewer with frozen original (unchanged).
- Click draft edit row → `onView(null)` → editor with the in-progress edit draft.
- Click bottom `▸ Draft` row (new chapter) → `onView(null)` → editor with the new-chapter draft (unchanged).

## "Edit this chapter" button

In `components/ChapterWorkspace.tsx`, `editViewedChapter` currently only guards against losing a **new-chapter** draft:

```ts
if (
  draft.chapterId === null &&
  draft.output.trim() &&
  !window.confirm("You have an unsaved new draft. Loading this chapter will discard it. Continue?")
) {
  return;
}
```

Add two branches:

1. **Same chapter re-click.** If `draft.chapterId === viewedChapter.id`, do **not** reload the draft from the chapter — that would discard the user's in-progress edits. Just call `onClearView()` so they land back in the editor. No confirm needed.
2. **Different chapter with dirty edit draft.** If `draft.chapterId` is set and is not the viewed chapter's id, compute:
   ```ts
   const origin = novel.chapters.find((c) => c.id === draft.chapterId);
   const dirty =
     !!origin &&
     (draft.title !== origin.title ||
      draft.prompt !== origin.prompt ||
      draft.output !== origin.content);
   ```
   If `dirty`, confirm with:
   > "You have unsaved changes in your edit of "<origin.title>". Loading this chapter will discard them. Continue?"

   If the user cancels, `return`. Otherwise proceed to load the new edit draft.

The existing `chapterId === null && draft.output.trim()` confirmation stays as-is.

## Data flow

1. User views chapter 3 → clicks "✎ Edit this chapter" → `draft` is populated with chapter 3's data, `chapterId = 3.id`.
2. Sidebar re-renders: chapter 3 row shown (not highlighted), `▸ Draft edit — Chapter 3` row shown directly below it (highlighted, because `viewingId === null`).
3. User clicks chapter 3 row → viewer opens showing frozen original. Chapter 3 row becomes highlighted, draft edit row drops its highlight.
4. User clicks draft edit row → viewer closes, editor reappears with the edit draft. Highlight moves back to the draft edit row.
5. User hits Send → Approve → `commitChapter` overwrites chapter 3 with draft contents, draft is cleared. Sidebar re-renders with only the updated chapter 3 row — no draft edit row.

## Error handling

None needed. All changes are pure rendering + local component state; no new async work, no new storage, no I/O.

## Testing

Add `lib/__tests__/ChapterSidebar.test.tsx` (Vitest + React Testing Library, matching the pattern in `store.test.tsx`):

1. **No draft edit row when `draft.chapterId === null`.** Render sidebar with two chapters and a null-chapterId draft; assert no "Draft edit" text is present.
2. **Draft edit row position.** Render with chapters `[A, B, C]` and `draft.chapterId = B.id`; assert the rendered order of rows is `A, B, Draft edit, C`.
3. **Highlight — viewing original.** `viewingId = B.id`, `draft.chapterId = B.id`; the B row has the highlight class, the draft edit row does not.
4. **Highlight — in editor with edit draft.** `viewingId = null`, `draft.chapterId = B.id`; the draft edit row has the highlight class, the B row does not.
5. **Click draft edit row calls `onView(null)`.** Simulate click; assert the `onView` prop was called with `null`.

Manual smoke test:
- Start a new chapter draft → verify bottom Draft row still appears.
- Click Edit on chapter N → verify new row appears directly after chapter N with emerald label.
- Click chapter N → viewer opens, highlight moves to chapter N row.
- Click draft edit row → editor reopens, highlight moves back.
- Click Edit on another chapter M with unsaved edits on chapter N → verify confirm dialog.
- Click Edit on the chapter currently being edited → verify no reload (edits preserved).
- Approve the edit → verify draft edit row disappears and chapter N row shows the new content.

## Non-goals

- Allowing a new-chapter draft and an edit draft to coexist (keeps state model simple; one draft at a time matches the current mental model).
- Multiple concurrent edit drafts across chapters.
- Changing the commit behavior (edit still overwrites the original on approve; this spec is purely about visibility and navigation).
- Auto-saving edit drafts separately from the single `draft` slot.
- Showing a visual "dirty" indicator on the draft edit row (the dirty check is only used internally for the confirm dialog).
