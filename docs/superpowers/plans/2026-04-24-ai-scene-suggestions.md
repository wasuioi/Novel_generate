# AI Scene Suggestions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "💡 ขอไอเดีย" button that pops a full-screen 3-card modal picker where the user selects an AI-proposed scene direction, then commits it into `draft.title` + `draft.prompt`.

**Architecture:** Follow the existing multi-agent pattern (Writer / Summarizer / LoreKeeper). Add a new `sceneSuggester` agent that reuses the writer's user-selected model and the same story-context blocks as `buildMessages()`. Modal is a new client component with CSS-only bounce animation. First-time usage shows a `confirm()` dialog gated by a localStorage flag.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS, vitest.

**Spec:** `docs/superpowers/specs/2026-04-24-ai-scene-suggestions-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `lib/types.ts` | Modify | Add `SceneSuggestion`, extend `AgentCall.agent`, extend `Draft` |
| `lib/agents/sceneSuggester.ts` | Create | System prompt + parser |
| `lib/prompt.ts` | Modify | Extract `buildContextBlocks(novel)` helper |
| `lib/io.ts` | Modify | Migrate imports missing `sceneSuggesterCost` |
| `app/api/suggest-scenes/route.ts` | Create | POST endpoint (non-streaming, JSON response) |
| `components/SceneSuggestModal.tsx` | Create | Full-screen 3-card picker |
| `components/ChapterWorkspace.tsx` | Modify | 💡 button, first-time dialog, modal wiring, commit handler |
| `app/globals.css` | Modify | `@keyframes card-select-bounce` |
| `lib/__tests__/sceneSuggester.test.ts` | Create | Parser tests |
| `lib/__tests__/io.test.ts` | Modify | Migration test for old Draft shape |
| `lib/__tests__/prompt.test.ts` | Modify | Ensure `buildContextBlocks` refactor preserves behavior |

---

### Task 1: Extend types

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Add SceneSuggestion type and extend AgentCall + Draft**

Open `lib/types.ts`. Change the `AgentCall.agent` literal union, then add `SceneSuggestion` and a new field on `Draft`:

```ts
export type AgentCall = {
  agent: "writer" | "summarizer" | "loreKeeper" | "sceneSuggester";
  model: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
};

// ...existing types unchanged...

export type SceneSuggestion = {
  title: string;
  synopsis: string;
};

export type Draft = {
  chapterId: string | null;
  title: string;
  prompt: string;
  output: string;
  writerCost?: AgentCall | null;
  sceneSuggesterCost?: AgentCall | null;
};
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (no new call sites yet — pure type extension).

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "types: add SceneSuggestion and extend AgentCall/Draft"
```

---

### Task 2: Scene suggester parser (TDD)

**Files:**
- Create: `lib/agents/sceneSuggester.ts`
- Create: `lib/__tests__/sceneSuggester.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/__tests__/sceneSuggester.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseSceneSuggestions } from "../agents/sceneSuggester";

describe("parseSceneSuggestions", () => {
  it("parses a clean JSON array of 3 suggestions", () => {
    const raw = JSON.stringify([
      { title: "A", synopsis: "one" },
      { title: "B", synopsis: "two" },
      { title: "C", synopsis: "three" },
    ]);
    const result = parseSceneSuggestions(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.suggestions).toHaveLength(3);
      expect(result.suggestions[0]).toEqual({ title: "A", synopsis: "one" });
    }
  });

  it("strips markdown fence before parsing", () => {
    const raw = "```json\n" + JSON.stringify([
      { title: "A", synopsis: "one" },
      { title: "B", synopsis: "two" },
      { title: "C", synopsis: "three" },
    ]) + "\n```";
    const result = parseSceneSuggestions(raw);
    expect(result.ok).toBe(true);
  });

  it("fails when the array has != 3 items", () => {
    const raw = JSON.stringify([{ title: "A", synopsis: "a" }]);
    const result = parseSceneSuggestions(raw);
    expect(result.ok).toBe(false);
  });

  it("fails on missing title or synopsis", () => {
    const raw = JSON.stringify([
      { title: "A" },
      { title: "B", synopsis: "two" },
      { title: "C", synopsis: "three" },
    ]);
    const result = parseSceneSuggestions(raw);
    expect(result.ok).toBe(false);
  });

  it("fails on empty title or synopsis", () => {
    const raw = JSON.stringify([
      { title: "", synopsis: "one" },
      { title: "B", synopsis: "two" },
      { title: "C", synopsis: "three" },
    ]);
    const result = parseSceneSuggestions(raw);
    expect(result.ok).toBe(false);
  });

  it("fails on invalid JSON", () => {
    const result = parseSceneSuggestions("not json at all");
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npm run test -- sceneSuggester`
Expected: FAIL (`parseSceneSuggestions` not defined).

- [ ] **Step 3: Implement parser**

Create `lib/agents/sceneSuggester.ts`:

```ts
import type { SceneSuggestion } from "../types";

const MAX_TITLE = 200;
const MAX_SYNOPSIS = 2000;

export type ParseResult =
  | { ok: true; suggestions: SceneSuggestion[] }
  | { ok: false; error: string };

export function parseSceneSuggestions(raw: string): ParseResult {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return { ok: false, error: "Response was not valid JSON" };
  }
  if (!Array.isArray(parsed) || parsed.length !== 3) {
    return { ok: false, error: "Expected a JSON array of exactly 3 items" };
  }

  const suggestions: SceneSuggestion[] = [];
  for (const item of parsed) {
    if (
      typeof item !== "object" || item === null ||
      typeof (item as Record<string, unknown>).title !== "string" ||
      typeof (item as Record<string, unknown>).synopsis !== "string"
    ) {
      return { ok: false, error: "Each item must have string title + synopsis" };
    }
    const title = (item as { title: string; synopsis: string }).title.trim();
    const synopsis = (item as { title: string; synopsis: string }).synopsis.trim();
    if (!title || !synopsis) {
      return { ok: false, error: "Title and synopsis must be non-empty" };
    }
    if (title.length > MAX_TITLE || synopsis.length > MAX_SYNOPSIS) {
      return { ok: false, error: "Title or synopsis exceeds max length" };
    }
    suggestions.push({ title, synopsis });
  }
  return { ok: true, suggestions };
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `npm run test -- sceneSuggester`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/agents/sceneSuggester.ts lib/__tests__/sceneSuggester.test.ts
git commit -m "feat(agent): scene suggester parser with validation"
```

---

### Task 3: Extract shared context builder + scene suggester prompt

**Files:**
- Modify: `lib/prompt.ts`
- Modify: `lib/agents/sceneSuggester.ts`
- Modify: `lib/__tests__/prompt.test.ts` (verify refactor — no behavior change)
- Modify: `lib/__tests__/sceneSuggester.test.ts`

Why refactor now: writer and suggester both need the same context blocks (storyContext + lore + summaries + previous chapter). Duplicating that logic across two files is a maintenance trap.

- [ ] **Step 1: Refactor prompt.ts to extract buildContextBlocks**

Open `lib/prompt.ts`. Extract the section-assembly logic that produces storyContext / lore / summaries / previous-chapter blocks into an exported helper. The rest of `buildMessages` stays the same — it just calls the helper. No behavior change.

```ts
// lib/prompt.ts — after refactor

export function buildContextBlocks(novel: Novel): string[] {
  const editIndex = novel.draft.chapterId
    ? novel.chapters.findIndex((c) => c.id === novel.draft.chapterId)
    : -1;
  const isEditing = editIndex >= 0;

  const contextChapters = isEditing
    ? novel.chapters.slice(0, editIndex)
    : novel.chapters;

  const fullCount = SLIDING_WINDOW_FULL_COUNT;
  const fullChapters = fullCount > 0 ? contextChapters.slice(-fullCount) : [];
  const summarizedChapters =
    fullCount > 0 ? contextChapters.slice(0, -fullCount) : contextChapters.slice();

  const chapterIndex = new Map(novel.chapters.map((c, i) => [c.id, i]));
  const visibleLore = isEditing
    ? novel.lore.filter((l) => {
        if (!l.chapterId) return true;
        const idx = chapterIndex.get(l.chapterId);
        return idx !== undefined && idx < editIndex;
      })
    : novel.lore;

  const sections: string[] = [];
  sections.push("## Core story context and world-bible", novel.storyContext || "(empty)");

  if (visibleLore.length > 0) {
    const loreLines = visibleLore.map((l) => `- ${l.text}`).join("\n");
    sections.push("## Established lore", loreLines);
  }

  if (summarizedChapters.length > 0) {
    const lines = summarizedChapters.map((c, i) => {
      if (c.summary) {
        return `Chapter ${i + 1}: ${c.summary}`;
      }
      return `Chapter ${i + 1} (no summary — full text):\n[${c.title}]\n${c.content}`;
    });
    sections.push("## Story so far (summaries)", lines.join("\n\n"));
  }

  if (fullChapters.length > 0) {
    const lines = fullChapters.map((c) => `[${c.title}]\n${c.content}`);
    sections.push("## Previous chapter (full text, for voice and immediate continuity)", lines.join("\n\n"));
  }

  return sections;
}

export function buildMessages(novel: Novel): Message[] {
  const editIndex = novel.draft.chapterId
    ? novel.chapters.findIndex((c) => c.id === novel.draft.chapterId)
    : -1;
  const isEditing = editIndex >= 0;

  const sections: string[] = ["You are an expert novel writer."];
  sections.push(novel.settings.outputLanguage === "th" ? THAI_BLOCK : ENGLISH_BLOCK);
  sections.push(...buildContextBlocks(novel));
  const system = sections.join("\n\n");

  const targetWords = novel.settings.targetWords;
  const minWords = Math.floor(targetWords * 0.8);
  const openingLine = isEditing
    ? `Rewrite chapter ${editIndex + 1}. Target length: approximately ${targetWords} words.`
    : `Write the next chapter. Target length: approximately ${targetWords} words.`;
  const user = [
    openingLine,
    `Develop the scene fully — do NOT stop short. Continue writing until you have covered the entire arc described in the guidance and reached at least ${minWords} words.`,
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

- [ ] **Step 2: Run existing prompt tests to confirm no regression**

Run: `npm run test -- prompt`
Expected: PASS (all 15 existing tests).

- [ ] **Step 3: Add buildSceneSuggestMessages to sceneSuggester.ts**

Open `lib/agents/sceneSuggester.ts` and append:

```ts
import type { Message, Novel } from "../types";
import { buildContextBlocks } from "../prompt";

const THAI_LANG = "Write the title AND synopsis in natural Thai (ภาษาไทย).";
const ENGLISH_LANG = "Write the title AND synopsis in natural English.";

const INSTRUCTIONS = [
  "You are a scene-idea brainstormer for a novel in progress.",
  "",
  "Given the current story context, established lore, and chapter history,",
  "propose exactly 3 DISTINCT directions for the NEXT chapter.",
  "",
  "Each proposal must:",
  "- be a meaningful plot direction, not a minor variation of the others",
  "- be consistent with established lore",
  "- have a concrete hook that makes the reader want the next chapter",
  "",
  "Output format — JSON array of 3 objects, no other text, no markdown fence:",
  '[',
  '  { "title": "short chapter title", "synopsis": "3-5 line synopsis: setup, key beats, ending hook" },',
  "  ...",
  "]",
].join("\n");

export function buildSceneSuggestMessages(novel: Novel): Message[] {
  const langLine = novel.settings.outputLanguage === "th" ? THAI_LANG : ENGLISH_LANG;
  const system = [INSTRUCTIONS, "", langLine, "", ...buildContextBlocks(novel)].join("\n\n");
  const user = "Propose 3 distinct directions for the next chapter as JSON.";
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
```

- [ ] **Step 4: Add a test for buildSceneSuggestMessages**

Append to `lib/__tests__/sceneSuggester.test.ts`:

```ts
import { buildSceneSuggestMessages } from "../agents/sceneSuggester";
import { DEFAULT_NOVEL } from "../types";

describe("buildSceneSuggestMessages", () => {
  it("includes the story context and language instruction (th)", () => {
    const novel = structuredClone(DEFAULT_NOVEL);
    novel.storyContext = "A fantasy kingdom at war.";
    novel.settings.outputLanguage = "th";
    const messages = buildSceneSuggestMessages(novel);
    const system = messages.find((m) => m.role === "system")!.content;
    expect(system).toContain("A fantasy kingdom at war.");
    expect(system).toContain("ภาษาไทย");
    expect(system).toContain("JSON array of 3 objects");
  });

  it("switches language instruction for en", () => {
    const novel = structuredClone(DEFAULT_NOVEL);
    novel.settings.outputLanguage = "en";
    const messages = buildSceneSuggestMessages(novel);
    const system = messages.find((m) => m.role === "system")!.content;
    expect(system).toContain("natural English");
  });
});
```

- [ ] **Step 5: Run tests**

Run: `npm run test`
Expected: PASS (all tests including new ones).

- [ ] **Step 6: Commit**

```bash
git add lib/prompt.ts lib/agents/sceneSuggester.ts lib/__tests__/sceneSuggester.test.ts lib/__tests__/prompt.test.ts
git commit -m "refactor: share context-block builder between writer and scene suggester"
```

---

### Task 4: io.ts migration — old Draft shape

**Files:**
- Modify: `lib/io.ts`
- Modify: `lib/__tests__/io.test.ts`

- [ ] **Step 1: Read the current normalize logic**

Read `lib/io.ts` to find the function that parses imported JSON into a `Novel`. The `Draft` object's new `sceneSuggesterCost` field must default to `null` when missing from old exports.

- [ ] **Step 2: Add failing test**

Append to `lib/__tests__/io.test.ts`:

```ts
it("adds sceneSuggesterCost=null when importing an old-shape Draft", () => {
  const old = {
    storyContext: "",
    lore: [],
    chapters: [],
    draft: { chapterId: null, title: "", prompt: "", output: "" }, // no sceneSuggesterCost
    settings: { model: "x", temperature: 0.5, targetWords: 1200, outputLanguage: "en" },
  };
  const result = parseNovelJson(JSON.stringify(old));
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.novel.draft.sceneSuggesterCost ?? null).toBe(null);
  }
});
```

- [ ] **Step 3: Run to confirm it fails (or already passes if tolerant)**

Run: `npm run test -- io`

If the existing parser is strict and fails — continue to step 4. If it already accepts missing fields (no strict schema) — just ensure the test passes and skip to step 5.

- [ ] **Step 4: Update io.ts**

Ensure the Draft normalization path explicitly sets `sceneSuggesterCost: draft.sceneSuggesterCost ?? null`. Follow the existing pattern of that file (e.g. the writerCost default).

- [ ] **Step 5: Run tests**

Run: `npm run test -- io`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/io.ts lib/__tests__/io.test.ts
git commit -m "io: default sceneSuggesterCost=null for old exports"
```

---

### Task 5: API route /api/suggest-scenes

**Files:**
- Create: `app/api/suggest-scenes/route.ts`

- [ ] **Step 1: Study the summarizer route for pattern**

Read `app/api/summarize/route.ts` and `app/api/extract-lore/route.ts` to match patterns: POST JSON in, JSON out, error handling, cost attachment, OpenRouter call shape.

- [ ] **Step 2: Implement the route**

Create `app/api/suggest-scenes/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import type { AgentCall } from "@/lib/types";
import { parseSceneSuggestions } from "@/lib/agents/sceneSuggester";
import { AGENT_TIMEOUT_MS } from "@/lib/agents/config";
import { buildAgentCallCost } from "@/lib/agents/prices";
// ^ Use whatever helper the existing routes use for cost. If a direct helper doesn't exist,
//   mirror the exact cost-building code from app/api/summarize/route.ts.

export async function POST(req: NextRequest) {
  const { model, temperature, messages } = await req.json();

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing OPENROUTER_API_KEY" }, { status: 500 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);

  try {
    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature,
        messages,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      return NextResponse.json({ error: `Upstream ${upstream.status}: ${text}` }, { status: 502 });
    }

    const json = await upstream.json();
    const text: string = json.choices?.[0]?.message?.content ?? "";
    const parsed = parseSceneSuggestions(text);
    if (!parsed.ok) {
      console.error("sceneSuggester parse failed:", parsed.error, "raw:", text);
      return NextResponse.json({ error: `Parse failed: ${parsed.error}` }, { status: 502 });
    }

    const usage = json.usage ?? { prompt_tokens: 0, completion_tokens: 0 };
    const cost: AgentCall = {
      agent: "sceneSuggester",
      model,
      promptTokens: usage.prompt_tokens ?? 0,
      completionTokens: usage.completion_tokens ?? 0,
      costUsd: 0, // fill via existing price helper — see note below
    };
    // IMPORTANT: compute cost.costUsd using the same helper/table that summarize/extract-lore use.
    // If they call `priceForAgentCall(call)` or similar, use the same.

    return NextResponse.json({ suggestions: parsed.suggestions, cost });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    clearTimeout(timeout);
  }
}
```

- [ ] **Step 3: Confirm cost helper usage matches existing routes**

Open `app/api/summarize/route.ts` and copy the exact lines that compute `costUsd` for its agent call. Replace the `costUsd: 0` placeholder in the new route with those lines, substituting `"sceneSuggester"` for `"summarizer"`.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/suggest-scenes/route.ts
git commit -m "feat(api): /api/suggest-scenes route"
```

---

### Task 6: Bounce keyframe in globals.css

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Append keyframe**

Add to the bottom of `app/globals.css`:

```css
@keyframes card-select-bounce {
  0%   { transform: translateY(0) scale(1); }
  60%  { transform: translateY(-12px) scale(1.02); }
  100% { transform: translateY(-4px) scale(1); }
}
.card-selected {
  animation: card-select-bounce 220ms ease-out forwards;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/globals.css
git commit -m "style: card-select-bounce keyframe"
```

---

### Task 7: SceneSuggestModal component

**Files:**
- Create: `components/SceneSuggestModal.tsx`

Component is "dumb": takes props, emits events. Parent handles API calls and state.

- [ ] **Step 1: Implement the modal**

Create `components/SceneSuggestModal.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import type { SceneSuggestion } from "@/lib/types";
import { Button } from "./ui/Button";

type Props = {
  open: boolean;
  loading: boolean;
  error: string | null;
  suggestions: SceneSuggestion[];
  warnOverwrite: boolean;
  onConfirm: (picked: SceneSuggestion) => void;
  onRegenerate: () => void;
  onClose: () => void;
};

export function SceneSuggestModal({
  open,
  loading,
  error,
  suggestions,
  warnOverwrite,
  onConfirm,
  onRegenerate,
  onClose,
}: Props) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    // Reset selection whenever a new batch arrives or modal opens
    setSelectedIndex(null);
  }, [suggestions, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const pickable = !loading && !error && suggestions.length === 3;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="relative w-[90vw] max-w-[1400px] h-[80vh] p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {loading && (
          <div className="h-full flex items-center justify-center text-zinc-300 animate-pulse">
            กำลังคิดไอเดีย…
          </div>
        )}

        {error && !loading && (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-red-400">
            <div>ขอไอเดียไม่สำเร็จ: {error}</div>
            <Button variant="secondary" onClick={onRegenerate}>ลองใหม่</Button>
          </div>
        )}

        {pickable && (
          <div className="h-full grid grid-cols-3 gap-6">
            {suggestions.map((s, i) => {
              const isSelected = selectedIndex === i;
              return (
                <button
                  key={i}
                  onClick={() => setSelectedIndex(i)}
                  className={[
                    "text-left rounded-xl p-6 bg-zinc-900 transition-colors",
                    isSelected
                      ? "border-2 border-emerald-500 card-selected"
                      : "border border-zinc-700 hover:border-zinc-500",
                  ].join(" ")}
                >
                  <div className="text-lg font-semibold mb-3">{s.title}</div>
                  <div className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
                    {s.synopsis}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="absolute right-6 bottom-6 flex items-center gap-3">
          {warnOverwrite && pickable && (
            <span className="text-xs text-amber-400 mr-2">
              ⚠️ จะเขียนทับ title / prompt ที่คุณพิมพ์ไว้
            </span>
          )}
          <Button variant="secondary" onClick={onRegenerate} disabled={loading}>
            ↻ ขอใหม่
          </Button>
          <Button
            onClick={() => {
              if (selectedIndex !== null) onConfirm(suggestions[selectedIndex]);
            }}
            disabled={!pickable || selectedIndex === null}
            className="bg-emerald-600 hover:bg-emerald-500"
          >
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/SceneSuggestModal.tsx
git commit -m "feat(ui): SceneSuggestModal card picker"
```

---

### Task 8: Wire 💡 button + first-time dialog + API call

**Files:**
- Modify: `components/ChapterWorkspace.tsx`

- [ ] **Step 1: Add state + handlers**

Near the top of `ChapterWorkspace`, beside the existing `useState` calls, add:

```tsx
const [suggestOpen, setSuggestOpen] = useState(false);
const [suggestLoading, setSuggestLoading] = useState(false);
const [suggestError, setSuggestError] = useState<string | null>(null);
const [suggestions, setSuggestions] = useState<SceneSuggestion[]>([]);
const suggestAbortRef = useRef<AbortController | null>(null);

const INTRO_SEEN_KEY = "sceneSuggest.introSeen";

const runSuggest = async () => {
  suggestAbortRef.current?.abort();
  const controller = new AbortController();
  suggestAbortRef.current = controller;
  setSuggestLoading(true);
  setSuggestError(null);
  setSuggestions([]);
  try {
    const res = await fetch("/api/suggest-scenes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: settings.model,
        temperature: settings.temperature,
        messages: buildSceneSuggestMessages(novel),
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      setSuggestError(`${res.status} · ${text}`);
      return;
    }
    const json = (await res.json()) as {
      suggestions: SceneSuggestion[];
      cost: AgentCall | null;
    };
    setSuggestions(json.suggestions);
    if (json.cost) {
      update((n) => { n.draft.sceneSuggesterCost = json.cost; });
    }
  } catch (err) {
    if ((err as { name?: string }).name === "AbortError") return;
    setSuggestError(err instanceof Error ? err.message : String(err));
  } finally {
    setSuggestLoading(false);
  }
};

const onSuggestClick = () => {
  const seen = typeof window !== "undefined" && window.localStorage.getItem(INTRO_SEEN_KEY) === "1";
  if (!seen) {
    const ok = window.confirm(
      "ฟีเจอร์ขอไอเดีย: AI จะเสนอไอเดีย 3 แบบสำหรับตอนต่อไป โดยดูจากเนื้อเรื่องและ lore ที่คุณมี เลือกหนึ่งได้ (หรือไม่เลือกก็ได้) ใช้ครั้งละประมาณ $0.0005 (ราคาตามโมเดลที่คุณตั้ง) ใช้เลยไหม?"
    );
    if (!ok) return;
    window.localStorage.setItem(INTRO_SEEN_KEY, "1");
  }
  setSuggestOpen(true);
  void runSuggest();
};

const canSuggest =
  !streaming &&
  !reviewing &&
  !isEditingExisting &&
  (novel.storyContext.trim().length > 0 || novel.chapters.length > 0);
```

Also import at top:

```ts
import { SceneSuggestModal } from "./SceneSuggestModal";
import { buildSceneSuggestMessages } from "@/lib/agents/sceneSuggester";
import type { SceneSuggestion } from "@/lib/types";
```

- [ ] **Step 2: Add the 💡 button into the button row**

Locate the `<Button onClick={generate}>Generate ▸</Button>` block inside `editorSection`. Just before it, add:

```tsx
<Button
  variant="secondary"
  onClick={onSuggestClick}
  disabled={!canSuggest}
  title={canSuggest ? "" : "ต้องมี Story Context หรือมีตอนอื่นอยู่แล้วก่อน / ไม่สามารถใช้ตอนแก้ตอนเก่าหรือกำลังสร้าง"}
>
  💡 ขอไอเดีย
</Button>
```

- [ ] **Step 3: Render the modal**

At the end of `editorSection`'s JSX (near where `<PromptPreviewModal>` is rendered), add:

```tsx
<SceneSuggestModal
  open={suggestOpen}
  loading={suggestLoading}
  error={suggestError}
  suggestions={suggestions}
  warnOverwrite={draft.title.trim().length > 0 || draft.prompt.trim().length > 0}
  onConfirm={(picked) => {
    update((n) => {
      n.draft.title = picked.title;
      n.draft.prompt = picked.synopsis;
    });
    setSuggestOpen(false);
  }}
  onRegenerate={() => { void runSuggest(); }}
  onClose={() => {
    suggestAbortRef.current?.abort();
    setSuggestOpen(false);
  }}
/>
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/ChapterWorkspace.tsx
git commit -m "feat(ui): wire 💡 ขอไอเดีย button with first-time dialog"
```

---

### Task 9: Include sceneSuggesterCost in saved chapter cost

**Files:**
- Modify: `components/ChapterWorkspace.tsx`

The existing save-chapter path builds a `ChapterCost` from `draft.writerCost` (plus summarizer + loreKeeper). It needs to include `draft.sceneSuggesterCost` too.

- [ ] **Step 1: Locate the save path**

Search `ChapterWorkspace.tsx` for where `buildChapterCost` is called (or where `ChapterCost.calls` is assembled). Add `draft.sceneSuggesterCost` to the `calls` array if it exists.

Example (adapt to actual structure):

```tsx
const calls: AgentCall[] = [
  draft.writerCost,
  summarizerCost,
  loreKeeperCost,
  draft.sceneSuggesterCost,
].filter((c): c is AgentCall => Boolean(c));
```

Also clear `sceneSuggesterCost` when the draft is reset (search for resets of `n.draft = { chapterId: null, title: "", ... }` — add `sceneSuggesterCost: null`).

- [ ] **Step 2: Typecheck + tests**

Run: `npm run typecheck && npm run test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/ChapterWorkspace.tsx
git commit -m "feat: roll scene suggester cost into saved chapter cost"
```

---

### Task 10: Manual verification + final push

**Files:** none

- [ ] **Step 1: Run final checks**

Run: `npm run typecheck && npm run test`
Expected: PASS on both.

- [ ] **Step 2: Manual browser test**

Start `npm run dev` and verify each item from the spec's Verification section:

1. First click on 💡 → intro `confirm()` appears. Accept → modal opens with 3 cards.
2. Click card 1 → green border + bounce. Click card 2 → card 1 deselects, card 2 selected.
3. Click `↻ ขอใหม่` → loading → new 3 cards appear.
4. Click Confirm → modal closes → title + prompt filled in the draft.
5. Refresh page → click 💡 → NO intro dialog (localStorage remembered).
6. Open a saved chapter in "Edit this chapter" → 💡 is disabled.
7. Import a backup exported before this feature → no error, still works.

- [ ] **Step 3: Summary message**

Do not auto-push. Report to the user:
- Number of commits on this branch ahead of `origin/main`.
- List of files changed.
- Ask whether to squash and push.
