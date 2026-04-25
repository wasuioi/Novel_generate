# Thai Character Target Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch chapter length unit from "words" to "characters with spaces" (the unit Thai online novel platforms use); drop the English-language path entirely; migrate existing user data inline so no novel content is lost.

**Architecture:** Atomic schema rename in `lib/types.ts`. Migration runs inside `sanitizeNovel` (already invoked by both localStorage hydration and JSON import — single chokepoint). All consumers (prompt builder, settings UI, chapter workspace, story-context editor) updated together. The intermediate task states do not typecheck — verification happens at the final task before the single commit.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS, vitest.

**Spec:** `docs/superpowers/specs/2026-04-25-thai-character-target-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `lib/types.ts` | Modify | Replace `targetWords` with `targetChars`; remove `outputLanguage` from `Settings` and `DEFAULT_NOVEL` |
| `lib/agents/config.ts` | Modify | Remove `TOKENS_PER_WORD` constant |
| `lib/io.ts` | Modify | Migrate old `targetWords` → `targetChars`; drop `outputLanguage` |
| `lib/prompt.ts` | Modify | Delete `ENGLISH_BLOCK`; use `THAI_BLOCK` always; switch prompt wording to characters |
| `components/ChapterWorkspace.tsx` | Modify | New `maxTokens` formula (`targetChars * 2`); drop `TOKENS_PER_WORD` import |
| `components/SettingsDrawer.tsx` | Modify | Slider 3,000–12,000 step 500; new help text; remove output language radio |
| `components/StoryContextEditor.tsx` | Modify | `wordCount` → `charCount`; label "X characters" |
| `lib/__tests__/io.test.ts` | Modify | Update existing settings assertions; add migration tests |
| `lib/__tests__/prompt.test.ts` | Modify | Update word→char assertions; remove English/Thai toggle tests |
| `lib/__tests__/store.test.tsx` | Modify | Update legacy hydration test for new shape; assert migration |

---

## Important: Intermediate Broken State

This is an atomic schema rename. Tasks 1–6 leave the project in a non-compiling state (consumers reference old fields before the schema is updated, or vice versa). **Do not commit between tasks.** Task 7 runs the full verification and produces the single commit. If you have to stop mid-way, leave the working tree dirty — do not stash piecemeal commits.

---

### Task 1: Update Settings schema (types + config)

**Files:**
- Modify: `lib/types.ts:32-77`
- Modify: `lib/agents/config.ts:6-11`

- [ ] **Step 1: Replace Settings shape in `lib/types.ts`**

Open `lib/types.ts`. Replace the `Settings` type (lines 32-37) and the `DEFAULT_NOVEL.settings` block (lines 71-77):

```ts
export type Settings = {
  model: string;
  temperature: number;
  targetChars: number;
};
```

```ts
  settings: {
    model: "google/gemini-3-flash-preview",
    temperature: 0.8,
    targetChars: 6000,
  },
```

- [ ] **Step 2: Remove `TOKENS_PER_WORD` from `lib/agents/config.ts`**

Delete lines 6-11 (the comment block and `TOKENS_PER_WORD` constant). The file should keep `SUMMARIZER_MODEL`, `LORE_KEEPER_MODEL`, `SLIDING_WINDOW_FULL_COUNT`, `AGENT_TIMEOUT_MS`, and `MAX_OUTPUT_TOKENS`.

After edit, `lib/agents/config.ts` should be:

```ts
export const SUMMARIZER_MODEL = "anthropic/claude-haiku-4.5";
export const LORE_KEEPER_MODEL = "anthropic/claude-haiku-4.5";
export const SLIDING_WINDOW_FULL_COUNT = 1;
export const AGENT_TIMEOUT_MS = 45_000;

export const MAX_OUTPUT_TOKENS = 28000;
```

- [ ] **Step 3: Run typecheck (expected to fail)**

Run: `npm run typecheck`
Expected: FAIL with errors at `lib/io.ts`, `lib/prompt.ts`, `components/ChapterWorkspace.tsx`, `components/SettingsDrawer.tsx`, and the test files — they all still reference `targetWords`, `outputLanguage`, or `TOKENS_PER_WORD`. This is the expected broken-state checkpoint.

- [ ] **Step 4: Do NOT commit. Move to Task 2.**

---

### Task 2: Add migration to `sanitizeNovel`

**Files:**
- Modify: `lib/io.ts:16-34`

- [ ] **Step 1: Add a `migrateSettings` helper and use it in `sanitizeNovel`**

In `lib/io.ts`, add this helper just above `sanitizeNovel`:

```ts
function migrateSettings(raw: Record<string, unknown>): Partial<Novel["settings"]> {
  const out: Partial<Novel["settings"]> = {};
  if (typeof raw.model === "string") out.model = raw.model;
  if (typeof raw.temperature === "number") out.temperature = raw.temperature;
  if (typeof raw.targetChars === "number") {
    out.targetChars = raw.targetChars;
  } else if (typeof raw.targetWords === "number") {
    const migrated = Math.round(raw.targetWords * 4.5);
    out.targetChars = Math.max(3000, Math.min(12000, migrated));
  }
  return out;
}
```

Then change the `settings:` line inside `sanitizeNovel` (currently line 27-29) to use it:

```ts
    settings: isPlainObject(parsed.settings)
      ? { ...DEFAULT_NOVEL.settings, ...migrateSettings(parsed.settings) }
      : DEFAULT_NOVEL.settings,
```

The migration intentionally drops anything not in the new schema (e.g. legacy `outputLanguage`, `targetWords`) — they don't appear in `migrateSettings`'s output.

- [ ] **Step 2: Do NOT commit. Move to Task 3.**

---

### Task 3: Switch `lib/prompt.ts` to Thai-only, character-based

**Files:**
- Modify: `lib/prompt.ts:4-15, 67-96`

- [ ] **Step 1: Delete `ENGLISH_BLOCK`, keep `THAI_BLOCK`**

In `lib/prompt.ts`, delete the `ENGLISH_BLOCK` constant (lines 11-15). `THAI_BLOCK` (lines 4-9) stays as-is.

- [ ] **Step 2: Rewrite `buildMessages` for character-based, language-fixed prompt**

Replace the entire `buildMessages` function (lines 67-96) with:

```ts
export function buildMessages(novel: Novel): Message[] {
  const editIndex = novel.draft.chapterId
    ? novel.chapters.findIndex((c) => c.id === novel.draft.chapterId)
    : -1;
  const isEditing = editIndex >= 0;

  const sections: string[] = ["You are an expert novel writer."];
  sections.push(THAI_BLOCK);
  sections.push(...buildContextBlocks(novel));
  const system = sections.join("\n\n");

  const targetChars = novel.settings.targetChars;
  const minChars = Math.floor(targetChars * 0.8);
  const openingLine = isEditing
    ? `Rewrite chapter ${editIndex + 1}. Target length: approximately ${targetChars} Thai characters (including spaces).`
    : `Write the next chapter. Target length: approximately ${targetChars} Thai characters (including spaces).`;
  const user = [
    openingLine,
    `Develop the scene fully — do NOT stop short. Continue writing until you have covered the entire arc described in the guidance and reached at least ${minChars} characters.`,
    "Do not pad with filler, but ensure the chapter has a proper beginning, middle, and end.",
    "Finish the final sentence completely before stopping. Keep pacing tight.",
    "",
    `Guidance: ${novel.draft.prompt}`,
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
```

`buildContextBlocks` is unchanged.

- [ ] **Step 3: Do NOT commit. Move to Task 4.**

---

### Task 4: Update `components/ChapterWorkspace.tsx`

**Files:**
- Modify: `components/ChapterWorkspace.tsx:9-13, 111-114`

- [ ] **Step 1: Drop `TOKENS_PER_WORD` from the import**

Edit the import block (lines 9-13). Remove the `TOKENS_PER_WORD` line:

```tsx
import {
  AGENT_TIMEOUT_MS,
  MAX_OUTPUT_TOKENS,
} from "@/lib/agents/config";
```

- [ ] **Step 2: Replace the `maxTokens` formula**

In the `generate` function (around line 111-114), replace:

```tsx
          maxTokens: Math.min(
            Math.floor(settings.targetWords * TOKENS_PER_WORD[settings.outputLanguage]),
            MAX_OUTPUT_TOKENS,
          ),
```

With:

```tsx
          maxTokens: Math.min(settings.targetChars * 2, MAX_OUTPUT_TOKENS),
```

`MAX_OUTPUT_TOKENS = 28000` and the slider caps `targetChars` at 12,000, so the cap will sit at 24,000 in the worst case — comfortably below the limit.

- [ ] **Step 3: Do NOT commit. Move to Task 5.**

---

### Task 5: Update `components/SettingsDrawer.tsx`

**Files:**
- Modify: `components/SettingsDrawer.tsx:168-215`

- [ ] **Step 1: Remove the Output language section (lines 168-197)**

Delete the whole `<div>` block that renders the "Output language" label and its two radio buttons. Remove nothing else in that range.

- [ ] **Step 2: Replace the Target chapter length section (lines 199-215)**

Replace with:

```tsx
        <div>
          <label className="block text-xs uppercase text-zinc-400 mb-1">
            Target chapter length · {novel.settings.targetChars} characters
            <HelpPopover side="right" ariaLabel="Help: Target chapter length">
              ความยาวโดยประมาณของแต่ละตอน นับเป็นตัวอักษรรวมช่องว่าง (เกณฑ์ที่ ธัญวลัย / readAwrite / Fictionlog ใช้)
              {"\n\n"}• ตอนสั้น 3,000–5,000
              {"\n"}• ตอนกลาง 5,000–8,000
              {"\n"}• ตอนยาว 8,000–12,000
              {"\n\n"}AI จะพยายามทำตาม แต่ไม่ตรงเป๊ะเสมอไป
            </HelpPopover>
          </label>
          <input
            type="range"
            min={3000}
            max={12000}
            step={500}
            value={novel.settings.targetChars}
            onChange={(e) => update((n) => { n.settings.targetChars = parseInt(e.target.value, 10); })}
            className="w-full"
          />
        </div>
```

- [ ] **Step 3: Do NOT commit. Move to Task 6.**

---

### Task 6: Update `components/StoryContextEditor.tsx`

**Files:**
- Modify: `components/StoryContextEditor.tsx:9-11, 52`

- [ ] **Step 1: Replace `wordCount` with `charCount`**

Replace lines 9-11:

```tsx
function charCount(s: string) {
  return s.length;
}
```

- [ ] **Step 2: Update the label on line 52**

```tsx
        <span className="text-xs text-zinc-500">{charCount(novel.storyContext)} characters</span>
```

- [ ] **Step 3: Do NOT commit. Move to Task 7.**

---

### Task 7: Update tests

**Files:**
- Modify: `lib/__tests__/prompt.test.ts:25-48`
- Modify: `lib/__tests__/io.test.ts:40-45, 123-136` (and add new migration tests)
- Modify: `lib/__tests__/store.test.tsx:56-69`

- [ ] **Step 1: Update `prompt.test.ts` — character-based assertions**

Replace the test currently named `"injects the target word count and a 'do NOT stop short' instruction"` with:

```ts
  it("injects the target character count and a 'do NOT stop short' instruction", () => {
    const novel = base();
    novel.settings.targetChars = 6000;
    const msgs = buildMessages(novel);
    expect(msgs[1].content).toContain("approximately 6000 Thai characters");
    expect(msgs[1].content).toContain("at least 4800 characters"); // floor(6000 * 0.8)
    expect(msgs[1].content).toContain("do NOT stop short");
    expect(msgs[1].content).toContain("beginning, middle, and end");
  });
```

Delete both language-toggle tests (the one currently checking "English directive when outputLanguage is en" at lines 35-39, and "Thai block when outputLanguage is th" at lines 41-48). Replace with one test asserting Thai is always present:

```ts
  it("always includes the Thai-language directive", () => {
    const msgs = buildMessages(base());
    expect(msgs[0].content).toContain("write the story entirely in Thai language");
    expect(msgs[0].content).toContain("ภาษาบรรยายแบบนิยาย");
    expect(msgs[0].content).not.toContain("write the story entirely in English");
  });
```

- [ ] **Step 2: Update `io.test.ts` — fix existing settings test, add migration tests**

Replace the test `"merges partial settings with defaults"` (lines 40-45) with:

```ts
  it("merges partial settings with defaults", () => {
    const result = sanitizeNovel({ settings: { temperature: 0.2 } });
    expect(result.settings.temperature).toBe(0.2);
    expect(result.settings.targetChars).toBe(DEFAULT_NOVEL.settings.targetChars);
    expect(result.settings.model).toBe(DEFAULT_NOVEL.settings.model);
  });
```

Replace the test `"accepts an old-shape Draft (missing sceneSuggesterCost)"` (lines 123-136) with:

```ts
  it("accepts an old-shape Draft (missing sceneSuggesterCost)", () => {
    const old = {
      storyContext: "",
      lore: [],
      chapters: [],
      draft: { chapterId: null, title: "", prompt: "", output: "" },
      settings: { model: "x", temperature: 0.5, targetChars: 6000 },
    };
    const result = parseNovelJson(JSON.stringify(old));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.novel.draft.sceneSuggesterCost ?? null).toBe(null);
    }
  });
```

Add a new `describe` block (anywhere after the `sanitizeNovel` block, before the `serializeToMarkdown` block) for migration:

```ts
describe("settings migration from legacy targetWords", () => {
  it("migrates targetWords to targetChars using factor 4.5", () => {
    const result = sanitizeNovel({
      settings: { model: "m", temperature: 0.7, targetWords: 1800, outputLanguage: "en" },
    });
    expect(result.settings.targetChars).toBe(8100); // 1800 * 4.5
    expect((result.settings as Record<string, unknown>).targetWords).toBeUndefined();
    expect((result.settings as Record<string, unknown>).outputLanguage).toBeUndefined();
  });

  it("rounds the migration factor", () => {
    const result = sanitizeNovel({ settings: { targetWords: 2200 } });
    expect(result.settings.targetChars).toBe(9900); // 2200 * 4.5
  });

  it("clamps low values up to 3000", () => {
    const result = sanitizeNovel({ settings: { targetWords: 500 } });
    expect(result.settings.targetChars).toBe(3000); // round(2250) clamped
  });

  it("clamps high values down to 12000", () => {
    const result = sanitizeNovel({ settings: { targetWords: 4000 } });
    expect(result.settings.targetChars).toBe(12000); // round(18000) clamped
  });

  it("prefers existing targetChars over legacy targetWords if both present", () => {
    const result = sanitizeNovel({
      settings: { targetChars: 7000, targetWords: 1800 },
    });
    expect(result.settings.targetChars).toBe(7000);
  });
});
```

- [ ] **Step 3: Update `store.test.tsx` — legacy hydration test**

Replace lines 56-69 (the test `"migrates legacy stored state by filling new fields with defaults"`) with:

```tsx
  it("migrates legacy stored state by filling new fields with defaults", () => {
    const legacy = {
      storyContext: "Old context",
      chapters: [{ id: "c1", title: "Old ch", prompt: "", content: "Body.", createdAt: 1 }],
      draft: { chapterId: null, title: "", prompt: "", output: "" },
      settings: { model: "anthropic/claude-sonnet-4.6", temperature: 0.8 },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));
    const { result } = renderHook(() => useNovel(), { wrapper });
    expect(result.current.novel.lore).toEqual([]);
    expect(result.current.novel.chapters[0].summary).toBe("");
    expect(result.current.novel.settings.targetChars).toBe(6000); // DEFAULT
  });

  it("migrates legacy stored state with targetWords + outputLanguage", () => {
    const legacy = {
      storyContext: "",
      chapters: [],
      draft: { chapterId: null, title: "", prompt: "", output: "" },
      settings: { model: "x", temperature: 0.7, targetWords: 2200, outputLanguage: "en" },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));
    const { result } = renderHook(() => useNovel(), { wrapper });
    expect(result.current.novel.settings.targetChars).toBe(9900); // 2200 * 4.5
    expect((result.current.novel.settings as Record<string, unknown>).targetWords).toBeUndefined();
    expect((result.current.novel.settings as Record<string, unknown>).outputLanguage).toBeUndefined();
  });
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS — no more dangling references to old fields.

- [ ] **Step 5: Run tests**

Run: `npm run test`
Expected: PASS — all suites green, including the new migration cases.

If anything fails, fix and re-run before moving on.

---

### Task 8: Manual smoke test in browser

**Files:** none (manual verification only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: Server boots at `http://localhost:3000`.

- [ ] **Step 2: Smoke a fresh install**

Open the app in a private/incognito window (no existing localStorage).
Expected:
- Settings drawer slider shows "Target chapter length · 6,000 characters".
- No "Output language" radio anywhere.
- Story Context editor shows "0 characters" (was "0 words").

- [ ] **Step 3: Smoke the migration path**

In a normal window with an existing saved novel that has the old shape, refresh.
Expected:
- App loads without crash.
- Slider value reflects the migration (e.g., if you previously had `targetWords=2200`, it should now show ~9,900).
- Chapter content, story context, and lore are intact.

- [ ] **Step 4: Smoke a generation**

Generate a chapter with the new slider at ~6,000.
Expected:
- Output streams in Thai.
- Word counter in story context updates as you type into it (showing characters).
- No console errors.

(The actual character count of the generated chapter depends on the model — Flash will under-shoot. That's a model limitation, not a regression.)

---

### Task 9: Commit

**Files:** all touched.

- [ ] **Step 1: Sanity check the diff**

Run: `git status` then `git diff --stat`
Expected: changes confined to the 10 files in the File Map.

- [ ] **Step 2: Commit**

```bash
git add lib/types.ts lib/agents/config.ts lib/io.ts lib/prompt.ts \
        components/ChapterWorkspace.tsx components/SettingsDrawer.tsx components/StoryContextEditor.tsx \
        lib/__tests__/io.test.ts lib/__tests__/prompt.test.ts lib/__tests__/store.test.tsx
git commit -m "$(cat <<'EOF'
feat: chapter target in Thai characters, drop English path

Switch the chapter length unit from "words" to "characters with spaces"
to match what Thai online-novel platforms (ธัญวลัย, readAwrite,
Fictionlog, Joylada) actually measure. Migration: existing
settings.targetWords → settings.targetChars via × 4.5 (empirical from
owner's measured chapters), clamped to the new 3000–12000 range.

Drop the English-language path entirely — single-purpose Thai writer
per the project's "ลบโค้ดที่ไม่ได้ใช้" rule.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Verify commit landed**

Run: `git log -1 --stat`
Expected: One commit with ~10 files changed.
