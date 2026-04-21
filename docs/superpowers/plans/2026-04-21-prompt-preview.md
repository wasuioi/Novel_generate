# Prompt Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Preview prompt" button next to "Generate ▸" that opens a modal showing the exact system and user messages that would be sent to `/api/generate`.

**Architecture:** One new presentational React component (`PromptPreviewModal`) and a small wiring change in `ChapterWorkspace.tsx`. No store, type, or API changes. The modal calls the existing pure `buildMessages(novel)` — all data flows remain unchanged.

**Tech Stack:** Next.js 14 (App Router), React 18 with client components, Tailwind CSS, TypeScript. Matches the patterns already used by `SettingsDrawer.tsx` and `ReviewPanel.tsx`.

**Spec:** `docs/superpowers/specs/2026-04-21-prompt-preview-design.md`

---

## Task 1: Create the `PromptPreviewModal` component

**Files:**
- Create: `components/PromptPreviewModal.tsx`

The modal is presentational. It accepts `open`, `onClose`, and `messages` (already-computed `Message[]`) as props. It renders a backdrop + centered dialog with two labeled `<pre>` blocks for the system and user message content, and closes on X button, Esc, or backdrop click.

- [ ] **Step 1: Write the component**

Create `components/PromptPreviewModal.tsx` with this exact content:

```tsx
"use client";
import { useEffect } from "react";
import type { Message } from "@/lib/types";
import { Button } from "./ui/Button";

type Props = {
  open: boolean;
  onClose: () => void;
  messages: Message[];
};

export function PromptPreviewModal({ open, onClose, messages }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const labelFor = (role: Message["role"]) =>
    role === "system" ? "System message" : role === "user" ? "User message" : "Assistant message";

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Prompt preview"
    >
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 flex items-center justify-between border-b border-zinc-800">
          <div>
            <h2 className="font-semibold">Prompt preview</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              This is exactly what will be sent to the model when you click Generate.
            </p>
          </div>
          <Button variant="ghost" onClick={onClose} aria-label="Close preview">✕</Button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4">
          {messages.map((m, i) => (
            <div key={i} className="space-y-1">
              <div className="text-xs uppercase text-zinc-500">{labelFor(m.role)}</div>
              <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed border border-zinc-800 rounded p-3 bg-zinc-950 text-zinc-200">
                {m.content}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run the TypeScript compiler to verify no type errors**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add components/PromptPreviewModal.tsx
git commit -m "feat: add PromptPreviewModal component"
```

---

## Task 2: Wire the modal into `ChapterWorkspace`

**Files:**
- Modify: `components/ChapterWorkspace.tsx`

Add:
1. An import of `PromptPreviewModal`.
2. Local state `previewOpen` (boolean).
3. A new "Preview prompt" button next to "Generate ▸" in the `editorSection`, with the same `disabled={!canGenerate}` guard.
4. Mount `<PromptPreviewModal ... messages={buildMessages(novel)} />` at the bottom of the returned `<section>`, after `{reviewing && <ReviewPanel ... />}`.

- [ ] **Step 1: Add the import**

In `components/ChapterWorkspace.tsx`, add the import right below the existing `import { ReviewPanel } from "./ReviewPanel";` line:

```tsx
import { PromptPreviewModal } from "./PromptPreviewModal";
```

- [ ] **Step 2: Add the `previewOpen` state**

Inside the `ChapterWorkspace` function, near the other `useState` calls (around the existing `const [streaming, setStreaming] = useState(false);` line), add:

```tsx
const [previewOpen, setPreviewOpen] = useState(false);
```

- [ ] **Step 3: Add the "Preview prompt" button**

In the JSX where the Generate button is rendered (inside `editorSection`, the block that currently reads):

```tsx
<div>
  {streaming ? (
    <Button variant="danger" onClick={stop}>■ Stop generating</Button>
  ) : (
    <Button
      onClick={generate}
      disabled={!canGenerate}
      title={canGenerate ? "" : "Write some guidance first"}
    >
      Generate ▸
    </Button>
  )}
</div>
```

Replace it with:

```tsx
<div className="flex gap-2">
  {streaming ? (
    <Button variant="danger" onClick={stop}>■ Stop generating</Button>
  ) : (
    <>
      <Button
        onClick={generate}
        disabled={!canGenerate}
        title={canGenerate ? "" : "Write some guidance first"}
      >
        Generate ▸
      </Button>
      <Button
        variant="secondary"
        onClick={() => setPreviewOpen(true)}
        disabled={!canGenerate}
        title={canGenerate ? "" : "Write some guidance first"}
      >
        Preview prompt
      </Button>
    </>
  )}
</div>
```

- [ ] **Step 4: Mount the modal**

At the very end of the returned JSX, inside the `<section>`, add the modal mount after the existing `{reviewing && <ReviewPanel ... />}` block. The section should end like this:

```tsx
      {reviewing && (
        <ReviewPanel
          isEditing={isEditingExisting}
          onApprove={onApprove}
          onSkip={onSkip}
          onCancel={onCancel}
          onRetrySummary={onRetrySummary}
          onRetryLore={onRetryLore}
        />
      )}

      <PromptPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        messages={buildMessages(novel)}
      />
    </section>
  );
}
```

- [ ] **Step 5: Run typecheck and tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: typecheck exits 0, all vitest tests pass (should still be 51 passing — no new tests, no regressions).

- [ ] **Step 6: Commit**

```bash
git add components/ChapterWorkspace.tsx
git commit -m "feat: wire Preview prompt button into ChapterWorkspace"
```

---

## Task 3: Manual smoke test

No automated test covers this behaviour (the modal is presentational and `buildMessages` is already covered by `lib/__tests__/prompt.test.ts`). Run the dev server and verify the feature end-to-end.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: Next.js logs `▲ Next.js <version> Ready`, app reachable at the URL it prints.

- [ ] **Step 2: Verify the preview button appears and is disabled with no guidance**

In the browser:
1. Open the app.
2. Clear the story context and the chapter prompt (so both are empty).
3. Confirm the "Preview prompt" button is visible next to "Generate ▸" and both are disabled (greyed out).

- [ ] **Step 3: Verify the modal opens and shows the correct content**

1. Type something into the story context (e.g. "Medieval fantasy.").
2. Type something into the chapter prompt (e.g. "Introduce the hero.").
3. Click "Preview prompt".
4. A centered modal appears with:
   - Header "Prompt preview"
   - A System message block containing the story context
   - A User message block containing the chapter guidance

- [ ] **Step 4: Verify the three close paths**

From an open modal:
1. Press `Esc` → modal closes. Reopen.
2. Click the backdrop (the dimmed area outside the dialog) → modal closes. Reopen.
3. Click the `✕` button → modal closes.

- [ ] **Step 5: Verify preview reflects edits live**

1. Open the modal, note the chapter prompt content in the User message.
2. Close the modal, change the chapter prompt, open the modal again.
3. The User message now reflects the new prompt.

- [ ] **Step 6: Verify preview works in "edit old chapter" mode**

1. Save at least two chapters.
2. Open an older chapter and click "✎ Edit this chapter".
3. Click "Preview prompt".
4. The User message says "Rewrite chapter K" (not "Write the next chapter") and the System message does NOT contain later-chapter content.

- [ ] **Step 7: Stop the dev server**

Ctrl+C in the terminal running `npm run dev`.

No additional commit — the manual-test task produces no code changes.

---

## Summary of files

| File | Change |
|------|--------|
| `components/PromptPreviewModal.tsx` | **Create** — new presentational modal |
| `components/ChapterWorkspace.tsx` | **Modify** — add import, state, button, modal mount |

No changes to: `lib/prompt.ts`, `lib/types.ts`, `lib/store.tsx`, any file under `app/api/`, or existing tests.
