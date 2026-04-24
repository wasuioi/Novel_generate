# AI Scene Suggestions

**Date:** 2026-04-24
**Scope:** Single feature. New button + modal + API route + agent + localStorage flag.

## Motivation

From dogfooding feedback:
> "ฟีเจอร์ AI เสนอเนื้อหาของตอนให้เลือก"

When the writer is stuck or wants inspiration, they can ask the AI for 3 distinct directions the next chapter could go. Pick one → it fills in the title + prompt. The writer stays in control (can still edit the prompt before generating) while lowering the blank-page friction.

## UX

### First-time dialog

When the user clicks `💡 ขอไอเดีย` for the very first time, show a browser `confirm()`:

> `ฟีเจอร์ขอไอเดีย: AI จะเสนอไอเดีย 3 แบบสำหรับตอนต่อไป โดยดูจากเนื้อเรื่องและ lore ที่คุณมี เลือกหนึ่งได้ (หรือไม่เลือกก็ได้) ใช้ครั้งละประมาณ $0.0005 (ราคาตามโมเดลที่คุณตั้ง) ใช้เลยไหม?`

- OK → proceed to modal. Remember in `localStorage["sceneSuggest.introSeen"] = "1"` so subsequent uses skip this dialog.
- Cancel → do nothing.

There is a permanent `HelpPopover` next to the 💡 button with the same explanation, so users can re-read it later.

### Modal — layout

When the API returns the 3 suggestions, open a full-screen modal:

- Background: `fixed inset-0 bg-black/60 backdrop-blur-sm` with `z-50`
- Dismissable by `Esc` key or by clicking the backdrop (outside any card) → modal closes, draft title/prompt are not touched, current selection is discarded
- Inside: a 3-column grid of cards (left / middle / right), each card `~28% of viewport width`, with `gap-6` between
- Cards vertically centered with `~8vh` padding top/bottom
- Bottom-right corner (`absolute right-6 bottom-6`): two buttons — `↻ ขอใหม่` (gray, `bg-zinc-600`) and `Confirm` (green, `bg-emerald-600`)

### Card — states

| State | Visual |
|-------|--------|
| Default | `border border-zinc-700 rounded-xl p-6 bg-zinc-900` |
| Hover | Border lightens to `border-zinc-500`, cursor pointer |
| Selected | `border-2 border-emerald-500` + `-translate-y-2 scale-[1.02]` via CSS transition (200ms ease-out), then settles at `-translate-y-1 scale-100` (spring-back). Only one card selected at a time. |
| Content | Title (`text-lg font-semibold` top), then synopsis (`text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap`, 3-5 lines) |

**Bounce animation (CSS + Tailwind only, no new dependency):**
```css
/* globals.css */
@keyframes card-select-bounce {
  0% { transform: translateY(0) scale(1); }
  60% { transform: translateY(-12px) scale(1.02); }
  100% { transform: translateY(-4px) scale(1); }
}
.card-selected { animation: card-select-bounce 220ms ease-out forwards; }
```
Apply `.card-selected` when the card becomes selected. Re-clicking another card applies the animation to the new one; the previously-selected card snaps back to default.

### Buttons

- **Confirm** — disabled until a card is selected. When clicked:
  - If `draft.title` or `draft.prompt` is non-empty: show inline warning text just above the button group (`text-xs text-amber-400`): `⚠️ จะเขียนทับ title / prompt ที่คุณพิมพ์ไว้` — but still only takes ONE click to commit (no second dialog — the modal itself is the gate).
  - Fill `draft.title` with selected card's title; fill `draft.prompt` with selected synopsis.
  - Close modal.
- **↻ ขอใหม่** — discards the 3 current cards, re-calls the API, shows a loading spinner in place of the cards. Selection is cleared.

### The 💡 button itself

Placed inside the existing button row in `ChapterWorkspace.tsx` (next to `Generate ▸`):

```
[💡 ขอไอเดีย]  [Generate ▸]  [Preview prompt]
```

Disabled when:
- Streaming/generating is in progress
- Reviewing (existing lore review flow)
- `storyContext` is empty AND there are zero previous chapters (nothing for AI to base suggestions on)
- Editing an existing chapter (`draft.chapterId !== null`) — suggestions for already-written chapters don't help

### Error handling

- API network failure / timeout (45s) → modal does not open; show inline error under the 💡 button (`text-xs text-red-400`): `ขอไอเดียไม่สำเร็จ: <reason>` — user can click 💡 again to retry.
- JSON parse failure → same error path. Log the raw response to browser console for debugging.
- No response from LLM → same error path.

## Technical

### New files

- `lib/agents/sceneSuggester.ts` — exports `buildSceneSuggestionPrompt(novel)`, `parseSceneSuggestions(text)`, and the JSON schema type.
- `app/api/suggest-scenes/route.ts` — POST handler. Accepts `{ model, temperature, messages }`, calls OpenRouter, returns `{ suggestions: SceneSuggestion[], cost: AgentCall | null }`. No streaming (short response).
- `components/SceneSuggestModal.tsx` — the modal component with the 3-card picker.

### Modified files

- `components/ChapterWorkspace.tsx` — add the 💡 button, modal state, handler that calls the API and opens the modal, confirm-commit logic that fills draft.title and draft.prompt, localStorage check for the first-time dialog.
- `lib/types.ts` — add:
  ```ts
  export type SceneSuggestion = { title: string; synopsis: string };
  export type AgentCall = { agent: "writer" | "summarizer" | "loreKeeper" | "sceneSuggester"; ... }
  ```
- `app/globals.css` — add the `card-select-bounce` keyframe.

### Prompt (sceneSuggester)

System prompt (shared across languages, but language-conditioned):

```
You are a scene-idea brainstormer for a novel in progress.

Given the current story context, established lore, and chapter history,
propose exactly 3 DISTINCT directions for the NEXT chapter.

Each proposal must:
- be a meaningful plot direction, not a minor variation of the others
- be consistent with established lore
- have a concrete hook that makes the reader want the next chapter

Output format — JSON array of 3 objects, no other text, no markdown fence:
[
  { "title": "short chapter title", "synopsis": "3-5 line synopsis: setup, key beats, ending hook" },
  ...
]

Write the title AND synopsis in <Thai|English>.
```

Context blocks reuse the same `storyContext`, `lore` (filtered same as writer), `chapter summaries`, and `previous chapter full text` from `buildMessages()`. Refactor into a shared `buildContextBlocks(novel)` helper in `lib/prompt.ts` so the writer and suggester share the same context assembly logic.

### Parsing

`parseSceneSuggestions(text)`:
1. Strip optional markdown fence (`\`\`\`json ... \`\`\``) — some models still emit it.
2. `JSON.parse`.
3. Validate: array length exactly 3, each item has `title: string` (non-empty, < 200 chars) and `synopsis: string` (non-empty, < 2000 chars).
4. Return `{ ok: true, suggestions }` or `{ ok: false, error }`.

### Cost accounting

- `sceneSuggester` counted as its own `AgentCall.agent` value.
- On commit (user clicks Confirm): the AgentCall from the picked suggestion batch is stored in a new field on `draft`, e.g. `draft.sceneSuggesterCost: AgentCall | null`, and rolled into `ChapterCost.calls` when the chapter is saved.
- If user cancels the modal or discards via `↻ ขอใหม่`: the previous batch's cost is still added — we already paid for it. Only the most recent batch is kept as `draft.sceneSuggesterCost`.
- Pricing for any model already flows through `buildChapterCost` and OpenRouter's standard price map.

## Data model changes

- `AgentCall.agent` literal union gains `"sceneSuggester"`.
- `Draft` type gains `sceneSuggesterCost: AgentCall | null`.
- `Chapter.cost.calls` already accepts any `AgentCall`, so no change there.
- Existing saved novels with the old `Draft` shape — add a migration in `lib/io.ts`'s normalize step: default `sceneSuggesterCost` to `null` when missing. (User Data Sacred — old exports must still import cleanly.)
- localStorage flag: `"sceneSuggest.introSeen"` — value `"1"` once the user accepts the first-time dialog.

## Out of scope

- Prose tuning (#3 ภาษาไม่ธรรมชาติ) — separate work.
- Multi-book, UI i18n — deferred.
- "Partial" suggestions (e.g., regenerate just card 2) — can add later if users ask.
- Streaming the suggestions token-by-token — response is short, batch is fine.

## Risk

- **New API route + new agent** — follows the exact same pattern as `/api/summarize` and `/api/extract-lore`, so architectural risk is low. Code review should verify that `extract-lore`'s error / cost handling is mirrored.
- **JSON parsing fragility** — some models ignore the "no markdown fence" instruction. Mitigated by the strip step. If parse fails, user sees a clear error and can retry — no corruption.
- **Cost surprise** — first-time dialog includes the price estimate; after that, the user is on their own. Default writer model (Gemini 3 flash) is cheap (~$0.0001 per suggestion batch).
- **User Data** — only additive changes to types; import/export already tolerates missing fields via the normalize step. Write a targeted io.test case for the migration.

## Verification

1. `npm run typecheck` passes.
2. `npm run test` passes, including a new test case for `sceneSuggester` parser (good input + malformed input + missing fields).
3. `npm run test` passes a new io.test case: importing a JSON with the old Draft shape (no `sceneSuggesterCost`) succeeds.
4. Manual browser test:
   a. First click on 💡 shows the intro `confirm()`. Accept → modal opens with 3 cards.
   b. Click card 1 → green border + bounce. Click card 2 → card 1 deselects, card 2 selected.
   c. Click `↻ ขอใหม่` → spinner → new 3 cards appear.
   d. Click Confirm → modal closes → title and prompt filled in the draft.
   e. Refresh the page → click 💡 again → NO intro dialog this time (localStorage remembered).
   f. Edit an existing chapter → 💡 is disabled.
   g. Import a backup that was exported before this feature → no error, still works.
