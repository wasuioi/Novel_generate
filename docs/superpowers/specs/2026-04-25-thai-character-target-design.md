# Thai-only chapter target measured in characters

**Date:** 2026-04-25
**Scope:** Single PR.

## Motivation

From owner dogfooding (2026-04-25):

- Owner sets `targetWords = 2200`, but `gemini-3-flash-preview` produces only 1,400–1,600 words. ChatGPT-5.4 honors the same target (2,800 words).
- Two compounding problems:
  1. **Word counting is fuzzy in Thai.** Thai prose has no inter-word spaces, so `s.split(/\s+/)` actually counts phrases (chunks separated by spaces), not words. Owner's "1,400 words" is ambiguous between Word-style segmentation and our regex split.
  2. **Thai online novel platforms** (ธัญวลัย, readAwrite, Fictionlog, Joylada) measure chapter length in **characters with spaces** — what Microsoft Word calls *Characters (with spaces)*. Standard buckets:
     - ตอนสั้น 3,000–5,000
     - ตอนกลาง 5,000–8,000
     - ตอนยาว 8,000–12,000

The app should match the unit owner thinks in. Switching to characters also removes ambiguity from the prompt to the model.

Owner also requested removing the English-language path entirely. The app has had no English users; the dual-language code in `prompt.ts` and `config.ts` is dead weight per "ลบโค้ดที่ไม่ได้ใช้" / Feature = Pet, Not Trophy.

## Changes

### Schema (`lib/types.ts`)

```ts
type Settings = {
  model: string;
  temperature: number;
  targetChars: number;     // was: targetWords
  // outputLanguage removed — Thai only
};

DEFAULT_NOVEL.settings = {
  model: "google/gemini-3-flash-preview",
  temperature: 0.8,
  targetChars: 6000,       // mid-range "ตอนกลาง"
};
```

### Migration (`lib/io.ts` + `lib/store.tsx`)

Inline migration when loading old data (localStorage hydration **and** JSON import):

- If `settings.targetWords` exists → `targetChars = clamp(targetWords * 4, 3000, 12000)`, then drop `targetWords`.
  - 1800 (old default) → 7200 (mid "ตอนกลาง")
  - 500 → 3000 (clamp floor)
  - 4000 (old max) → 12000 (clamp ceiling)
- If `settings.outputLanguage` exists → drop it (everyone is Thai).
- Chapter content untouched.

The factor 4 is a rough average for Thai prose: a "word" from `split(/\s+/)` is typically a multi-character phrase. Empirically chosen to land owner's prior 1800-default setting in the middle of the new "ตอนกลาง" range.

### Settings UI (`components/SettingsDrawer.tsx`)

- Slider: `min=3000`, `max=12000`, `step=500`, label `Target chapter length · {N} characters`.
- Help popover replaced with Thai-platform reference: "ตอนสั้น 3,000–5,000 · ตอนกลาง 5,000–8,000 · ตอนยาว 8,000–12,000 (นับตัวอักษรรวมช่องว่าง — เกณฑ์ที่ ธัญวลัย / readAwrite / Fictionlog ใช้)".
- Output language radio + its help popover removed entirely.
- `MODEL_OPTIONS` and migration `useEffect` for stale model slugs unchanged.

### Prompt (`lib/prompt.ts`)

- Delete `ENGLISH_BLOCK`. Keep `THAI_BLOCK` as the only language block (no toggle, always included).
- Replace word-based wording with character-based:
  - `Target length: approximately {N} Thai characters (including spaces).`
  - `Continue writing until you have covered the entire arc described in the guidance and reached at least {minChars} characters.`
- `minChars = Math.floor(targetChars * 0.8)` — same 80% floor as before, just in chars.
- `buildContextBlocks` unchanged.

### maxTokens (`components/ChapterWorkspace.tsx`)

```ts
maxTokens: Math.min(settings.targetChars * 2, MAX_OUTPUT_TOKENS)
```

Replaces the `targetWords * TOKENS_PER_WORD[lang]` formula. Thai consumes roughly 0.5–1 token per character in modern tokenizers; ×2 gives ~50–100% headroom so the cap never truncates a prose run that's near target. `MAX_OUTPUT_TOKENS=28000` already comfortably covers the new 12,000-char ceiling (24,000 < 28,000).

### Config (`lib/agents/config.ts`)

- Delete `TOKENS_PER_WORD` constant and its comment.
- Remove the `import { TOKENS_PER_WORD }` from `ChapterWorkspace.tsx`.
- `MAX_OUTPUT_TOKENS`, `SUMMARIZER_MODEL`, etc. unchanged.

### Word counter (`components/StoryContextEditor.tsx`)

- Rename `wordCount(s)` → `charCount(s)`, body becomes `s.length`.
- Label: `{N} characters` (was `{N} words`).
- No min/max here — just an info display.

### Tests

- `lib/__tests__/prompt.test.ts`: update expectations for new prompt text and removal of English/Thai toggle.
- `lib/__tests__/io.test.ts`: add cases — old JSON with `targetWords`+`outputLanguage` round-trips through `parseNovelJson` to the new shape; clamp boundaries verified.
- `lib/__tests__/store.test.tsx`: update default settings shape; verify hydration migrates a stored old-shape novel.

## Out of scope

- Auto-continuation when output falls short of `minChars`. Discussed and deferred — adds complexity per "Boring > Shiny"; the prompt floor + Pro-model fallback is enough for now.
- Per-chapter character budget (vs. global). The single global slider stays.
- Re-introducing English. If ever wanted, it returns as new feature work, not a hidden flag.
- Word/character counter on existing saved chapters (we only count `storyContext`).
- Renaming the variable in old saved JSON exports owners hold offline — those are read through `parseNovelJson`, which migrates on import.

## Risk

- **User Data is Sacred.** Migration runs on load and on JSON import. Chapter `content` / `summary` / `lore` / `storyContext` are not touched. The only mutated fields are `settings.targetWords` (renamed) and `settings.outputLanguage` (dropped).
- Failure mode if migration regresses: slider snaps to `targetChars=6000` default — annoying but recoverable, no content loss.
- Tests cover both migration paths (localStorage hydration and JSON import).

## Verification

1. `npm run typecheck` passes.
2. `npm run test` passes.
3. Manual:
   - Load an existing browser session that has old `targetWords=2200, outputLanguage="en"` → slider shows ~8800 characters, no crash, language UI gone.
   - Import a JSON backup with old shape → same outcome, novel content intact.
   - New install: slider defaults to 6,000.
   - Generate a Thai chapter, paste output into Word, verify *Characters (with spaces)* sits within ~80–120% of slider value on a Pro model. (Flash will still under-shoot — that's a model limitation, not this change.)
