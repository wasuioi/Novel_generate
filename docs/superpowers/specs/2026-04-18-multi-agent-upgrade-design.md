# Multi-Agent Upgrade — Design

**Date:** 2026-04-18
**Status:** Approved (brainstorming complete)
**Builds on:** `2026-04-15-novel-generate-design.md`

## Motivation

The current app sends every past chapter's full text into the Writer's system prompt. Two problems compound as the novel grows:

1. **Context bloat.** Tokens scale linearly with chapter count. Chapter 10 pays for Chapters 1–9 in every generation.
2. **Length hallucination.** When the input is long, the model assumes the output should be equally long, producing bloated chapters that drift off course.

A third, subtler problem: bare summaries lose small-but-critical facts (new items, character deaths, new world rules), which breaks continuity.

## Goal

Evolve from a single Writer model doing everything into a three-agent pipeline:

- **Writer** — generates chapter prose (existing, upgraded).
- **Summarizer** — compresses saved chapters into a 3–5 line recap.
- **Lore Keeper** — extracts durable world/character facts after each chapter.

Plus explicit length control and Thai output support.

## Architecture

```
User clicks "Send to Chapter History"
            │
            ▼
  ┌─────────────────────┐
  │  /api/summarize     │  ──► cheap/fast model
  │  (Summarizer Agent) │      returns 3-5 line summary
  └──────────┬──────────┘
             │ (in parallel)
  ┌──────────▼──────────┐
  │  /api/extract-lore  │  ──► cheap/fast model
  │  (Lore Keeper)      │      returns bullet list of new facts
  └──────────┬──────────┘
             ▼
  ┌─────────────────────┐
  │  ReviewPanel opens  │  ── rest of UI dimmed/disabled
  │  - edit summary     │
  │  - check lore       │
  │  - Approve / Skip   │
  └──────────┬──────────┘
             ▼
  Chapter committed with:
  - full text (for draft editing)
  - summary (for sliding window)
  - approved lore appended to novel.lore[]
```

### Sliding window for the Writer

When building the Writer's system prompt:

- Chapters `1 .. N-2`: contribute **summary only**.
- Chapter `N-1`: contributes **full text** (preserves voice + immediate continuity).
- Chapters with no summary (legacy chapters from before this upgrade): fall back to full text, so nothing breaks.

Window size is controlled by a single constant (`SLIDING_WINDOW_FULL_COUNT = 1`) so future tuning is a one-line change.

### Agent models (hardcoded)

- **Writer** — user-configurable in Settings (existing dropdown).
- **Summarizer** — `anthropic/claude-haiku-4.5`
- **Lore Keeper** — `anthropic/claude-haiku-4.5`

Extraction tasks don't need a frontier model; hardcoding keeps Settings simple and cost predictable.

## Data model

`lib/types.ts`:

```ts
export type Chapter = {
  id: string;
  title: string;
  prompt: string;
  content: string;        // full chapter text
  summary: string;        // NEW — 3-5 line recap, "" if not yet summarized
  createdAt: number;
};

export type LoreItem = {
  id: string;
  text: string;           // e.g., "Aria now carries a silver dagger."
  source: "ai" | "user";  // AI-extracted vs. hand-added
  chapterId?: string;     // which chapter introduced it (if AI-extracted)
  createdAt: number;
};

export type Settings = {
  model: string;                // Writer model (existing)
  temperature: number;          // existing
  targetWords: number;          // NEW — 500..3000, default 1800
  outputLanguage: "en" | "th";  // NEW — default "en"
};

export type Novel = {
  storyContext: string;   // hand-written world bible (unchanged)
  lore: LoreItem[];       // NEW — extracted/approved facts
  chapters: Chapter[];
  draft: Draft;
  settings: Settings;
};
```

### Migration

`lib/store.tsx` `load()` already does defensive merging with `DEFAULT_NOVEL`. The new fields merge in naturally:

- `novel.lore` undefined → `[]`.
- `chapter.summary` undefined → `""`.
- `settings.targetWords` undefined → `1800`.
- `settings.outputLanguage` undefined → `"en"`.

The Writer treats a chapter with empty `summary` as "use full text for this chapter" (fallback path). Users can regenerate summaries manually later — out of scope for this upgrade.

### Hardcoded constants

`lib/agents/config.ts`:

```ts
export const SUMMARIZER_MODEL = "anthropic/claude-haiku-4.5";
export const LORE_KEEPER_MODEL = "anthropic/claude-haiku-4.5";
export const SLIDING_WINDOW_FULL_COUNT = 1;
export const AGENT_TIMEOUT_MS = 45_000;
```

## Agent prompts

### Summarizer

```
System:
You are a precise story summarizer. Given a novel chapter, produce a 3–5
line recap covering: key events, who did what, what changed in the world
or characters. No flourishes, no analysis — facts only. Output plain text,
one bullet per line starting with "- ". Do not include introductory
phrases like "Here is the summary".

User:
[chapter title]

[chapter full text]
```

### Lore Keeper

```
System:
You extract durable world/character facts from a new chapter. Return ONLY
new, lasting information: items acquired, characters introduced or killed,
world rules revealed, relationships established, locations unlocked. Skip
one-off events, emotions, and transient actions.

Existing lore (do not duplicate):
- {lore item 1}
- {lore item 2}
...

Extract the facts using the same language as the chapter text. Output
format: one fact per line starting with "- ". If nothing new, output
exactly "NONE". Do not add any extra commentary.

User:
[chapter title]

[chapter full text]
```

Client parses lines starting with `- ` into `LoreItem` candidates. Output `NONE` → empty list. Any other non-matching lines are ignored.

### Writer (upgraded `buildMessages(novel)`)

```
System:
You are an expert novel writer.

{{IF outputLanguage === "th":
You MUST write the story entirely in Thai language.
Use highly natural, elegant, and literary Thai prose (ภาษาบรรยายแบบนิยาย).
Avoid robotic translations or unnatural phrasing.
Ensure the dialogue sounds like real human conversation in Thai.
}}

## Core story context and world-bible
{storyContext}

## Established lore
- {lore item 1}
- {lore item 2}
...

## Story so far (summaries)
Chapter 1: {summary}
Chapter 2: {summary}
...
Chapter N-2: {summary}

## Previous chapter (full text, for voice and immediate continuity)
[{chapter N-1 title}]
{chapter N-1 content}

User:
Write the next chapter. The output MUST be approximately {targetWords}
words long. Ensure the chapter has a proper beginning, middle, and end.
Do not pad the story unnecessarily, and ensure you finish the final
sentence completely before stopping. Keep pacing tight.

Guidance: {draft.prompt}
```

### Length control (the "muzzle")

Prompt-level: target word count injected into the user message (above).

API-level: `max_tokens = Math.floor(targetWords * 1.5)` passed into `streamText`.

## UI changes

### StoryContextEditor (extended)

- Top: existing world-bible textarea + word count (unchanged).
- Bottom: new collapsible `<details>` accordion **"📚 Dynamic Lore"**, collapsed by default.
  - Bulleted list of `novel.lore`, each with a small `×` delete button.
  - Inline **"+ Add lore"** button for manual entries (`source: "user"`).

### SettingsDrawer (extended)

- New **"Output language"** — radio: `English` / `ไทย`.
- New **"Target chapter length · {targetWords} words"** — slider `500..3000`, step `100`, default `1800`.

### ReviewPanel (new)

Gatekeeper flow when user clicks **"Send to Chapter History"**:

1. Chapter is *staged* (not yet committed to `novel.chapters`).
2. In parallel: `/api/summarize` and `/api/extract-lore` fire.
3. Below the workspace, `ReviewPanel` slides in (CSS transition).
4. Rest of the page (sidebar, Story Context, workspace inputs, Send button) receives `pointer-events: none` + `opacity-50` until the user Approves or Skips.
5. Panel contents:
   - **Summary** — editable textarea pre-filled with summarizer output.
   - **New lore** — each bullet has a checkbox (default checked) + editable text input.
   - **"Approve & save"** — commits chapter with `summary` + checked lore items appended to `novel.lore`.
   - **"Skip review & save chapter only"** — aborts in-flight agent calls, commits chapter with `summary: ""` and no new lore.
   - Tiny **"Cancel"** link — aborts in-flight agent calls, discards the staged save, returns to editing (no chapter committed).
6. While agents are loading: spinner per section; Approve button disabled until both resolve (success or failure).

### ChapterSidebar

Unchanged. Summary is internal — not shown in the list.

## API routes

### `app/api/generate/route.ts` (changed)

- `Body` schema gains `maxTokens: z.number().int().positive()`.
- Passed through to `streamText` via its `maxTokens` option (field name per ai SDK v4).

### `app/api/summarize/route.ts` (new)

- `Body`: `{ chapterTitle: string, chapterContent: string }`.
- Uses `SUMMARIZER_MODEL`, temperature `0.3` (lower for extraction).
- Returns plain text (non-streaming — `generateText`).
- Logs errors with `[/api/summarize]` prefix.

### `app/api/extract-lore/route.ts` (new)

- `Body`: `{ chapterTitle: string, chapterContent: string, existingLore: string[] }`.
- Uses `LORE_KEEPER_MODEL`, temperature `0.2`.
- Returns plain text.
- Logs errors with `[/api/extract-lore]` prefix.

## Error handling

- Each agent has its own `AbortController` (user Cancel cancels both).
- Per-agent timeout: `AGENT_TIMEOUT_MS = 45_000`.
- **Summarizer fails** → ReviewPanel shows "Summarizer failed — you can still save without a summary" + **Retry** button. Approve enabled, commits with empty summary.
- **Lore Keeper fails** → "Lore extraction failed" + Retry. Approve commits with no new lore.
- **Both succeed but malformed output** (no `- ` lines, empty, model filler) → treat as empty. No crash, no silent pollution.
- Server-side errors are logged, never swallowed (matches existing Writer route pattern).

## File layout

```
lib/
  agents/
    config.ts             NEW — model constants, window size, timeout
    summarizer.ts         NEW — prompt builder + bullet parser
    loreKeeper.ts         NEW — prompt builder + bullet parser (handles NONE)
  prompt.ts               CHANGED — sliding window, length, Thai block
  types.ts                CHANGED — summary, lore, targetWords, outputLanguage
  store.tsx               CHANGED — field migrations in load()

app/api/
  generate/route.ts       CHANGED — accepts maxTokens
  summarize/route.ts      NEW
  extract-lore/route.ts   NEW

components/
  StoryContextEditor.tsx  CHANGED — Lore accordion
  SettingsDrawer.tsx      CHANGED — language + length slider
  ChapterWorkspace.tsx    CHANGED — trigger review flow, stage instead of commit
  ReviewPanel.tsx         NEW — gatekeeper UI
```

## Testing

### Unit tests (Vitest)

- `lib/__tests__/prompt.test.ts` — sliding window with 0 / 1 / 5 chapters; Thai block present when `outputLanguage === "th"` and absent otherwise; `targetWords` appears in the user message.
- `lib/__tests__/agents.test.ts` — bullet parser handles leading `- `, multi-line bullets, `NONE` returning `[]`, malformed outputs returning `[]`, conversational filler ignored.
- `lib/__tests__/store.test.tsx` — migration: loading a v1 novel (no `lore`, no `summary`, no new settings) yields a valid state with defaults filled.

### Manual smoke test

1. Generate Chapter 1, click Send → ReviewPanel slides in, summary + lore shown.
2. Edit summary, uncheck one lore item, Approve → chapter in sidebar, lore accordion shows approved items only.
3. Generate Chapter 2 → (devtools/console) confirm system prompt contains Chapter 1's summary only and no full text if window size > 1, OR Chapter 1 full text if window size is 1 (current default).
4. Toggle Thai mode in Settings, regenerate → output is Thai.
5. Move length slider to 800 words → next generation is close to 800 words.
6. Skip review on a chapter → chapter saved with no summary; next generation uses that chapter's full text as fallback.
7. Reload the page after all of the above → every state change persists.

## Out of scope

- Retroactive summarization of existing legacy chapters (manual regenerate button can come later).
- Model selection for Summarizer/Lore Keeper (hardcoded by design).
- Lore categorization (characters vs. items vs. rules).
- Multiple novels per user (still one-novel-per-localStorage).
- UI translation (only the story output is language-switchable).
