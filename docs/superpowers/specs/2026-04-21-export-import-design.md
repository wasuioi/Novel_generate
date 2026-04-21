# Export / Import — Design Spec

**Date:** 2026-04-21
**Status:** Approved (ready for implementation plan)
**Scope:** Tier 1 items #1–#2 from the Novel_generate roadmap

## Problem

The entire Novel state (story context, chapters, lore, settings, draft, cost) lives only in browser `localStorage` under key `novel-generate:v1`. Clearing the browser or switching machines loses everything. Users also have no way to share a finished novel as a readable document.

## Goals

1. **Readable export** — produce a `.md` file containing every saved chapter, in order, suitable for sharing or reading outside the app.
2. **Full backup** — produce a `.json` file capturing the entire Novel state (including draft) so it can be restored later or moved between machines.
3. **Restore** — load a previously exported `.json` back into the app, fully replacing the current state with user confirmation.

## Non-goals

- Merging an imported novel into an existing one (the roadmap item "Multiple novels" will address workflows that need merge).
- `.epub` / `.pdf` / `.txt` output. `.md` is enough; conversion to other text formats is trivial outside the app.
- Partial export (e.g. "just chapters 3-5").
- Preview step before import. User clicks Import, confirms replace, done.

## Agreed decisions

| Decision | Choice | Why |
|---|---|---|
| Export formats | `.md` (readable) + `.json` (backup) | Covers both use cases; `.epub`/`.txt` YAGNI |
| `.md` contents | Only chapters (title + content, in order) | Matches "share as a novel" intent; excludes draft/lore/settings |
| `.json` contents | Full Novel including `draft` | Complete backup/restore |
| Import behavior | Replace current novel with `window.confirm` gate | Simple, matches backup/restore intent; avoids merge edge cases |
| UI placement | `SettingsDrawer`, bottom bar beside existing Reset button | Groups data-management actions |
| Architecture | Client-only with shared validator utility | No server cost, no new dependency, offline-capable |

## Architecture

### New file: `lib/io.ts`

Pure functions (no React, no DOM). Exports:

- `sanitizeNovel(raw: unknown): Novel` — accepts anything, returns a well-shaped `Novel`, falling back to `DEFAULT_NOVEL` fields for missing/invalid entries. Accepts both wrapped (`{ version: 1, novel: {...} }`) and unwrapped shapes.
- `serializeToJson(novel: Novel): string` — wraps as `{ version: 1, novel }` and `JSON.stringify`s.
- `serializeToMarkdown(novel: Novel): string` — concatenates chapters only.
- `parseNovelJson(raw: string): { ok: true; novel: Novel } | { ok: false; error: string }` — parses a JSON string into a validated Novel, returning a discriminated union for error handling.

### Modified file: `lib/store.tsx`

- Replace the inline validation logic in `load()` (current lines 20–40) with a call to `sanitizeNovel` from `lib/io.ts`. Same behavior, deduplicated.
- Add `replace(novel: Novel)` to the context value. Updates state and persists immediately (no debounce, since this is an explicit user action).

### Modified file: `components/SettingsDrawer.tsx`

Extend the absolute-bottom bar to hold the data-management group:

```
[Export .md ]  [Export backup]     ← two-column secondary buttons
[       Import backup        ]     ← full-width secondary button
  (error message if present)       ← aria-live="polite", text-red-400
[ Start New Novel (danger)   ]     ← existing, unchanged
```

Plus a hidden `<input type="file" accept=".json,application/json">` whose ref is clicked programmatically by the Import button.

### New file: `lib/__tests__/io.test.ts`

Vitest unit tests for `lib/io.ts` — see Testing section below.

## Data flow

### Export JSON

```
Click "Export backup (.json)"
  → serializeToJson(novel)
  → new Blob([json], { type: "application/json" })
  → URL.createObjectURL → anchor with download="novel-backup-YYYY-MM-DD.json"
  → programmatic click → URL.revokeObjectURL
```

### Export Markdown

```
Click "Export as .md"
  → serializeToMarkdown(novel)
  → new Blob([md], { type: "text/markdown" })
  → download as novel-YYYY-MM-DD.md
```

Markdown format:

```markdown
# Chapter 1: <title>

<content>

# Chapter 2: <title>

<content>
```

### Import JSON

```
Click "Import backup (.json)"
  → fileInputRef.current.click()
  → onChange: FileReader.readAsText
  → parseNovelJson(text)
      ok:false → setImportError(error)     — keep existing novel
      ok:true  → window.confirm("Import will replace your current novel. Continue?")
                   cancel → no-op
                   ok     → replace(novel); onClose(); setImportError(null)
```

Filename conventions use `new Date().toISOString().slice(0, 10)` for the date — no user prompt.

## Validation & error handling

`sanitizeNovel` uses trust-nothing / default-everything:

- Non-object input (`null`, arrays, primitives) → `DEFAULT_NOVEL`.
- `chapters` not an array → `[]`.
- `lore` not an array → `[]`.
- Missing `settings` fields → merged from `DEFAULT_NOVEL.settings`.
- Missing `draft` fields → merged from `DEFAULT_NOVEL.draft`.
- Unknown extra fields → discarded (Novel has a fixed shape).
- Stale model slugs (e.g. from old backups) → handled by `SettingsDrawer`'s existing migration effect (lines 22–26), no extra logic needed here.

`parseNovelJson` error cases:

| Case | Return | Message |
|---|---|---|
| Input is not valid JSON | `{ok:false}` | `"File is not valid JSON"` |
| JSON is `null` / array / string / number | `{ok:false}` | `"File does not contain a novel"` |
| JSON is any object | `{ok:true, novel: sanitizeNovel(parsed)}` | — |

UI error surface:

- `SettingsDrawer` keeps an `importError: string \| null` state.
- Rendered under the Import button as `<p aria-live="polite" className="text-xs text-red-400">{importError}</p>`.
- Replaced on each new attempt; cleared to `null` on successful import.
- No `alert()` — errors stay in the drawer so the user can retry without losing context.

Explicit non-swallowing: `parseNovelJson` returns an error object rather than silently falling back to `DEFAULT_NOVEL`. The user must see the failure.

## Testing plan

### Unit — `lib/__tests__/io.test.ts` (new)

- **`sanitizeNovel`**
  - Returns `DEFAULT_NOVEL` when input is `null`, a string, a number, or an array.
  - Accepts wrapped format `{ version: 1, novel: {...} }`.
  - Accepts unwrapped Novel directly.
  - `chapters` not an array → fallback to `[]`.
  - `lore` missing → fallback to `[]`.
  - `settings` partial → merged with `DEFAULT_NOVEL.settings`.
  - Extra unknown top-level keys are discarded.
- **Roundtrip**
  - `parseNovelJson(serializeToJson(n))` → `{ok:true, novel}` where `novel` deep-equals the input.
  - Output JSON has top-level `version: 1`.
- **`serializeToMarkdown`**
  - Multi-chapter novel produces `# Chapter N: <title>\n\n<content>` blocks separated by `\n\n`.
  - Empty `chapters` → empty string, no throw.
  - Does not include `storyContext`, `lore`, `draft`, or `settings`.
- **`parseNovelJson`**
  - `"not json"` → `{ok:false, error: /valid JSON/}`.
  - JSON `null` or `[]` → `{ok:false, error: /novel/}`.
  - Object with odd shape → `{ok:true}` (sanitize handles).

### Unit — `lib/__tests__/store.test.tsx` (append)

- `replace(novel)` updates state and persists to localStorage under `STORAGE_KEY`.

### Not unit-tested

- Blob/URL download flow — hard in jsdom, low value since all pure logic is in `lib/io.ts`.
- `SettingsDrawer` click handlers — covered by manual verification below.

### Manual verification after implementation

1. Export `.json` → open the file, verify `{ version: 1, novel: {...} }` shape.
2. Export `.md` → open in a text editor, verify all chapters present and in order.
3. Import the `.json` from step 1 → state matches what was exported.
4. Import a truncated/corrupt JSON file → see error under the Import button, current novel unchanged.
5. Import a well-formed JSON → `window.confirm` appears; cancel leaves state unchanged; OK replaces state and closes the drawer.

## Out of scope / later

- Drag-and-drop chapter reorder (roadmap Tier 1 #3).
- Word count + progress bar (roadmap Tier 1 #4).
- Multiple novels / merge import (roadmap Tier 3 #9).
