# UX polish: raise chapter length cap

**Date:** 2026-04-24
**Scope:** Single PR.

## Motivation

From dogfooding feedback:

- "จำนวนคำต่อตอนเยอะกว่านี้" — users want longer chapters. Investigation reveals a hidden ceiling: slider shows `max=3000` words, but `MAX_OUTPUT_TOKENS=16000` silently caps Thai output at ~2,285 words (7 tokens/word).

> **Note:** The original scope also included renaming Export/Import buttons to Thai, but the owner decided during review to keep the English labels. That part was reverted — only the word-cap change shipped.

## Changes

- `components/SettingsDrawer.tsx`: slider `max={3000}` → `max={4000}`
- `lib/agents/config.ts`: `MAX_OUTPUT_TOKENS = 16000` → `28000`

Effective output after change:
- Thai (7 tokens/word): up to ~4,000 words (matches slider)
- English (2 tokens/word): up to ~14,000 words (slider caps at 4,000, so far below limit)

Default writer model (Gemini 3 flash) supports 64k output tokens — well within budget. Smaller models picked manually by the user may cap below 28k; in that case the API returns a shorter response, no silent corruption.

## Out of scope

- Thai UI labels — deferred by owner decision.
- Prose quality / unnatural Thai language — separate larger work.
- UI i18n, multi-book, AI scene suggestion — explicitly deferred per One Thing at a Time.

## Risk

- Two constant bumps. No data migration, no format change, no logic change.
- Existing unit tests cover save/load and prompt construction — expected to pass unmodified.

## Verification

1. `npm run typecheck` passes
2. `npm run test` passes
3. Manual: move slider to 4000; generate a Thai chapter and verify output can exceed ~2,300 words.
