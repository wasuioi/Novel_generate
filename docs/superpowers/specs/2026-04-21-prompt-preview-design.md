# Prompt Preview — Design

**Date:** 2026-04-21
**Status:** Approved (brainstorming complete)
**Builds on:** `2026-04-18-multi-agent-upgrade-design.md`

## Motivation

Users can't see what is actually being sent to the Writer model before pressing Generate. The assembled prompt is non-trivial — it combines story context, lore, the summary of earlier chapters, the previous chapter's full text, and the chapter-specific guidance. When a generation produces unexpected output, there's no way to verify whether the input was correct.

Showing the user the exact messages before generating makes the system transparent and helps them catch prompt mistakes (e.g. stale story context, duplicated lore, wrong chapter prompt) before spending tokens.

## Goal

Add an optional **Preview prompt** button next to the existing **Generate** button. Clicking it opens a modal that displays the exact `system` and `user` messages that would be POSTed to `/api/generate` with the current state.

Out of scope: editing the prompt in the modal, token counting, syntax highlighting, persisting preview state, exporting/copying.

## Architecture

Single UI addition. No new API routes, no store changes, no type changes.

```
[Chapter prompt textarea]
         │
         ▼
[Generate ▸]  [Preview prompt]   ← new button, same enablement as Generate
                     │
                     ▼ (on click)
              ┌────────────────────────┐
              │ PromptPreviewModal     │
              │  - backdrop (click →   │
              │    close)              │
              │  - Esc → close         │
              │  - X button → close    │
              │  - two <pre> blocks:   │
              │    System, User        │
              └────────────────────────┘
```

The modal calls `buildMessages(novel)` at render time. No memoization — re-running it is cheap and guarantees the preview matches the novel/draft at the moment the modal is opened.

## Components

### New file: `components/PromptPreviewModal.tsx`

Props:
```ts
type Props = {
  open: boolean;
  onClose: () => void;
  messages: Message[];  // what buildMessages returned
};
```

Renders:
- Backdrop `<div>` (fixed, semi-transparent, `onClick={onClose}`)
- Dialog container (stop propagation so inner clicks don't close)
- Header: "Prompt preview" + close "✕" button
- Sub-line: "This is exactly what will be sent to the model when you click Generate."
- For each message: label ("System message" / "User message") + a scrollable `<pre>` showing `content` verbatim with `whitespace-pre-wrap` so long lines wrap
- Keyboard: `useEffect` attaches a `keydown` listener while `open` is true; Esc calls `onClose`

### Edit: `components/ChapterWorkspace.tsx`

- Add local state: `const [previewOpen, setPreviewOpen] = useState(false);`
- Add a second button next to Generate:
  ```tsx
  <Button variant="secondary" onClick={() => setPreviewOpen(true)} disabled={!canGenerate}>
    Preview prompt
  </Button>
  ```
  (hidden while streaming, same as Generate, so we only render when `!streaming`)
- Mount `<PromptPreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} messages={buildMessages(novel)} />` at the end of the component's JSX

No changes to `lib/prompt.ts`, `lib/types.ts`, `lib/store.tsx`, or any API route.

## Data flow

1. User types/edits story context, lore, chapter prompt, etc. → zustand store updates
2. User clicks "Preview prompt" → `setPreviewOpen(true)`
3. Modal mounts; on each render (open or closed) React calls `buildMessages(novel)` — but the cost is negligible (a few string joins) and only the result for the *current* novel is ever passed in. Alternative: compute inside the modal when opened. Either is fine; start with the simpler "compute in parent" approach.
4. User closes → `setPreviewOpen(false)` → modal unmounts

## Error handling

None needed. `buildMessages` is pure and cannot throw for valid inputs. The modal has no async work.

## Testing

Add one Vitest test file: `lib/__tests__/PromptPreviewModal.test.tsx` (if using RTL is overkill, can skip — the modal is thin).

Realistically the existing `prompt.test.ts` already covers what goes into the messages. The modal is presentational. Manual smoke test (open, verify content matches what Generate would send, close via each of: X, Esc, backdrop click) is enough for a first pass.

## Non-goals

- Editing prompts in the modal (users edit via the normal inputs)
- Token-count estimates (would need a tokenizer; defer)
- A "Generate from here" button inside the modal (keeps the preview-vs-generate flows cleanly separate)
- Saving/exporting the prompt
