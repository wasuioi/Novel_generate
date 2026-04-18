# Multi-Agent Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the novel app from a single Writer model into a three-agent pipeline (Summarizer + Lore Keeper + Writer) with sliding-window memory, length control, and Thai output support.

**Architecture:** Two new server routes (`/api/summarize`, `/api/extract-lore`) call cheap/fast models on-demand when the user clicks "Send to Chapter History". A gatekeeper ReviewPanel slides in below the workspace, shows the generated summary + lore checklist, and dims the rest of the UI until the user approves or skips. Writer's `buildMessages` is upgraded to use chapter summaries (sliding window) and inject a target-word-count instruction.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind v3, Vitest + @testing-library/react, ai v4 + @ai-sdk/openai-compatible v0.2, Zod, OpenRouter.

**Spec:** `docs/superpowers/specs/2026-04-18-multi-agent-upgrade-design.md`

---

## File map

**New:**
- `lib/agents/config.ts` — model + window constants
- `lib/agents/summarizer.ts` — prompt builder + bullet parser (pure)
- `lib/agents/loreKeeper.ts` — prompt builder + bullet parser (pure)
- `lib/review.tsx` — React Context for the review-flow session state
- `lib/__tests__/agents.test.ts` — parser + prompt unit tests
- `app/api/summarize/route.ts`
- `app/api/extract-lore/route.ts`
- `components/ReviewPanel.tsx`

**Changed:**
- `lib/types.ts` — `Chapter.summary`, `LoreItem`, `Settings.targetWords/outputLanguage`, `Novel.lore`
- `lib/store.tsx` — defensive merge for new fields in `load()`
- `lib/prompt.ts` — sliding window, length, Thai block
- `lib/__tests__/prompt.test.ts` — rewrite for new system-message format
- `lib/__tests__/store.test.tsx` — add migration test for new fields
- `app/api/generate/route.ts` — accept `maxTokens`
- `app/page.tsx` — wrap in `ReviewProvider`
- `components/SettingsDrawer.tsx` — language radio + length slider
- `components/StoryContextEditor.tsx` — Lore accordion
- `components/ChapterWorkspace.tsx` — trigger review flow on Send
- `components/ChapterSidebar.tsx` — apply dim styles when reviewing

---

## Task 1: Extend types and DEFAULT_NOVEL

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Add new fields to types and defaults**

Replace the entire contents of `lib/types.ts` with:

```ts
export type Chapter = {
  id: string;
  title: string;
  prompt: string;
  content: string;
  summary: string;
  createdAt: number;
};

export type LoreItem = {
  id: string;
  text: string;
  source: "ai" | "user";
  chapterId?: string;
  createdAt: number;
};

export type Settings = {
  model: string;
  temperature: number;
  targetWords: number;
  outputLanguage: "en" | "th";
};

export type Draft = {
  chapterId: string | null;
  title: string;
  prompt: string;
  output: string;
};

export type Novel = {
  storyContext: string;
  lore: LoreItem[];
  chapters: Chapter[];
  draft: Draft;
  settings: Settings;
};

export type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

export const DEFAULT_NOVEL: Novel = {
  storyContext: "",
  lore: [],
  chapters: [],
  draft: { chapterId: null, title: "", prompt: "", output: "" },
  settings: {
    model: "anthropic/claude-sonnet-4.6",
    temperature: 0.8,
    targetWords: 1800,
    outputLanguage: "en",
  },
};
```

- [ ] **Step 2: Verify type-check passes**

Run: `npx tsc --noEmit`
Expected: errors only in files that consume `Chapter`/`Settings`/`Novel` (those are the next tasks). Note them — they will be fixed in later tasks.

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat(types): add summary, lore, targetWords, outputLanguage fields"
```

---

## Task 2: Update store migration test + load() guards

**Files:**
- Modify: `lib/store.tsx`
- Modify: `lib/__tests__/store.test.tsx`

The existing `load()` already does defensive merging — the spread `{ ...DEFAULT_NOVEL, ...parsed }` handles missing top-level fields. We only need to make sure nested `settings` merge picks up new defaults (it already does). And add a test proving migration works.

- [ ] **Step 1: Add a failing migration test**

Append this test inside the `describe("useNovel", ...)` block in `lib/__tests__/store.test.tsx`, before the closing `});`:

```ts
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
    expect(result.current.novel.settings.targetWords).toBe(1800);
    expect(result.current.novel.settings.outputLanguage).toBe("en");
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/__tests__/store.test.tsx`
Expected: the new "migrates legacy stored state" test FAILS — `lore` is undefined, `chapters[0].summary` is undefined, etc.

- [ ] **Step 3: Update load() to fill the new fields per chapter**

In `lib/store.tsx`, replace the `load()` function with:

```ts
function load(): Novel {
  if (typeof window === "undefined") return DEFAULT_NOVEL;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_NOVEL;
  try {
    const parsed = JSON.parse(raw) as Partial<Novel>;
    const chapters = Array.isArray(parsed.chapters)
      ? parsed.chapters.map((c) => ({ summary: "", ...c }))
      : DEFAULT_NOVEL.chapters;
    return {
      ...DEFAULT_NOVEL,
      ...parsed,
      chapters,
      lore: Array.isArray(parsed.lore) ? parsed.lore : DEFAULT_NOVEL.lore,
      settings: { ...DEFAULT_NOVEL.settings, ...(parsed.settings ?? {}) },
      draft:    { ...DEFAULT_NOVEL.draft,    ...(parsed.draft    ?? {}) },
    };
  } catch {
    return DEFAULT_NOVEL;
  }
}
```

Note: `{ summary: "", ...c }` puts the default first so any existing `summary` in the stored chapter wins.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/__tests__/store.test.tsx`
Expected: all tests PASS, including the new migration one.

- [ ] **Step 5: Commit**

```bash
git add lib/store.tsx lib/__tests__/store.test.tsx
git commit -m "feat(store): migrate legacy state to fill new fields"
```

---

## Task 3: Create agent config constants

**Files:**
- Create: `lib/agents/config.ts`

- [ ] **Step 1: Write the file**

Create `lib/agents/config.ts`:

```ts
export const SUMMARIZER_MODEL = "anthropic/claude-haiku-4.5";
export const LORE_KEEPER_MODEL = "anthropic/claude-haiku-4.5";
export const SLIDING_WINDOW_FULL_COUNT = 1;
export const AGENT_TIMEOUT_MS = 45_000;
```

- [ ] **Step 2: Commit**

```bash
git add lib/agents/config.ts
git commit -m "feat(agents): add config constants"
```

---

## Task 4: TDD the Summarizer prompt + parser

**Files:**
- Create: `lib/agents/summarizer.ts`
- Create: `lib/__tests__/agents.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/__tests__/agents.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildSummarizerMessages, parseSummarizerOutput } from "../agents/summarizer";

describe("buildSummarizerMessages", () => {
  it("returns a system + user message with the chapter title and content", () => {
    const msgs = buildSummarizerMessages("Chapter 1 · Arrival", "The hero stepped off the boat.");
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe("system");
    expect(msgs[0].content).toContain("precise story summarizer");
    expect(msgs[0].content).toContain("Do not include introductory phrases");
    expect(msgs[1].role).toBe("user");
    expect(msgs[1].content).toContain("Chapter 1 · Arrival");
    expect(msgs[1].content).toContain("The hero stepped off the boat.");
  });
});

describe("parseSummarizerOutput", () => {
  it("returns bullet lines stripped of the leading '- '", () => {
    const out = "- Hero arrived.\n- Sword found.\n- Map opened.";
    expect(parseSummarizerOutput(out)).toEqual([
      "Hero arrived.",
      "Sword found.",
      "Map opened.",
    ]);
  });

  it("ignores conversational filler lines that don't start with '- '", () => {
    const out = "Here is the summary:\n- Hero arrived.\nThanks!";
    expect(parseSummarizerOutput(out)).toEqual(["Hero arrived."]);
  });

  it("returns an empty array when there are no bullets", () => {
    expect(parseSummarizerOutput("Sorry, I cannot help.")).toEqual([]);
  });

  it("trims whitespace inside each bullet", () => {
    expect(parseSummarizerOutput("-   Hero arrived.   ")).toEqual(["Hero arrived."]);
  });
});
```

- [ ] **Step 2: Run to verify tests fail**

Run: `npx vitest run lib/__tests__/agents.test.ts`
Expected: FAIL — module `../agents/summarizer` not found.

- [ ] **Step 3: Implement the summarizer module**

Create `lib/agents/summarizer.ts`:

```ts
import type { Message } from "../types";

const SYSTEM = [
  "You are a precise story summarizer. Given a novel chapter, produce a 3–5 line",
  "recap covering: key events, who did what, what changed in the world or characters.",
  "No flourishes, no analysis — facts only. Output plain text, one bullet per line",
  "starting with \"- \". Do not include introductory phrases like \"Here is the summary\".",
].join(" ");

export function buildSummarizerMessages(chapterTitle: string, chapterContent: string): Message[] {
  return [
    { role: "system", content: SYSTEM },
    { role: "user", content: `${chapterTitle}\n\n${chapterContent}` },
  ];
}

export function parseSummarizerOutput(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter((line) => line.length > 0);
}
```

- [ ] **Step 4: Run to verify tests pass**

Run: `npx vitest run lib/__tests__/agents.test.ts`
Expected: all 4 summarizer tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/agents/summarizer.ts lib/__tests__/agents.test.ts
git commit -m "feat(agents): add summarizer prompt builder and parser"
```

---

## Task 5: TDD the Lore Keeper prompt + parser

**Files:**
- Create: `lib/agents/loreKeeper.ts`
- Modify: `lib/__tests__/agents.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `lib/__tests__/agents.test.ts` (after the existing parseSummarizerOutput block):

```ts
import { buildLoreKeeperMessages, parseLoreKeeperOutput } from "../agents/loreKeeper";

describe("buildLoreKeeperMessages", () => {
  it("includes the chapter content and existing lore for de-duplication", () => {
    const msgs = buildLoreKeeperMessages(
      "Chapter 2 · The Sword",
      "Aria pulled a silver dagger from the cloak.",
      ["Aria is the protagonist.", "The forest is haunted."],
    );
    expect(msgs[0].role).toBe("system");
    expect(msgs[0].content).toContain("Aria is the protagonist.");
    expect(msgs[0].content).toContain("The forest is haunted.");
    expect(msgs[0].content).toContain("same language as the chapter text");
    expect(msgs[0].content).toContain("If nothing new, output exactly \"NONE\"");
    expect(msgs[1].content).toContain("Chapter 2 · The Sword");
    expect(msgs[1].content).toContain("silver dagger");
  });

  it("handles empty existing lore gracefully", () => {
    const msgs = buildLoreKeeperMessages("T", "C", []);
    expect(msgs[0].content).toContain("Existing lore (do not duplicate):");
  });
});

describe("parseLoreKeeperOutput", () => {
  it("returns each bullet as a fact string", () => {
    const out = "- Aria carries a silver dagger.\n- The cloak is enchanted.";
    expect(parseLoreKeeperOutput(out)).toEqual([
      "Aria carries a silver dagger.",
      "The cloak is enchanted.",
    ]);
  });

  it("returns [] when the model outputs NONE", () => {
    expect(parseLoreKeeperOutput("NONE")).toEqual([]);
    expect(parseLoreKeeperOutput("  NONE  ")).toEqual([]);
  });

  it("returns [] for malformed output", () => {
    expect(parseLoreKeeperOutput("I don't see anything new")).toEqual([]);
    expect(parseLoreKeeperOutput("")).toEqual([]);
  });

  it("ignores filler before bullets", () => {
    const out = "Here are the new facts:\n- Aria has a sword.\nThanks!";
    expect(parseLoreKeeperOutput(out)).toEqual(["Aria has a sword."]);
  });
});
```

- [ ] **Step 2: Run to verify tests fail**

Run: `npx vitest run lib/__tests__/agents.test.ts`
Expected: FAIL — module `../agents/loreKeeper` not found.

- [ ] **Step 3: Implement the lore keeper module**

Create `lib/agents/loreKeeper.ts`:

```ts
import type { Message } from "../types";

function buildSystem(existingLore: string[]): string {
  const loreList =
    existingLore.length > 0
      ? existingLore.map((l) => `- ${l}`).join("\n")
      : "(none)";
  return [
    "You extract durable world/character facts from a new chapter. Return ONLY",
    "new, lasting information: items acquired, characters introduced or killed,",
    "world rules revealed, relationships established, locations unlocked. Skip",
    "one-off events, emotions, and transient actions.",
    "",
    "Existing lore (do not duplicate):",
    loreList,
    "",
    "Extract the facts using the same language as the chapter text. Output format:",
    "one fact per line starting with \"- \". If nothing new, output exactly \"NONE\".",
    "Do not add any extra commentary.",
  ].join("\n");
}

export function buildLoreKeeperMessages(
  chapterTitle: string,
  chapterContent: string,
  existingLore: string[],
): Message[] {
  return [
    { role: "system", content: buildSystem(existingLore) },
    { role: "user", content: `${chapterTitle}\n\n${chapterContent}` },
  ];
}

export function parseLoreKeeperOutput(text: string): string[] {
  if (text.trim().toUpperCase() === "NONE") return [];
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter((line) => line.length > 0);
}
```

- [ ] **Step 4: Run to verify tests pass**

Run: `npx vitest run lib/__tests__/agents.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/agents/loreKeeper.ts lib/__tests__/agents.test.ts
git commit -m "feat(agents): add lore keeper prompt builder and parser"
```

---

## Task 6: Upgrade Writer prompt with sliding window, length, Thai block

**Files:**
- Modify: `lib/prompt.ts`
- Modify: `lib/__tests__/prompt.test.ts` (rewrite — old tests check string fragments that no longer exist)

- [ ] **Step 1: Replace prompt.test.ts with the new test suite**

Replace the entire contents of `lib/__tests__/prompt.test.ts` with:

```ts
import { describe, it, expect } from "vitest";
import { buildMessages } from "../prompt";
import { DEFAULT_NOVEL, type Novel } from "../types";

const base = (): Novel => ({
  ...DEFAULT_NOVEL,
  storyContext: "Medieval fantasy with dragons.",
  draft: { chapterId: null, title: "Ch 1", prompt: "Introduce the hero.", output: "" },
});

describe("buildMessages", () => {
  it("produces system + user messages", () => {
    const msgs = buildMessages(base());
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe("system");
    expect(msgs[1].role).toBe("user");
  });

  it("includes the story context and the user guidance", () => {
    const msgs = buildMessages(base());
    expect(msgs[0].content).toContain("Medieval fantasy with dragons.");
    expect(msgs[1].content).toContain("Introduce the hero.");
  });

  it("injects the target word count into the user message", () => {
    const novel = base();
    novel.settings.targetWords = 1200;
    const msgs = buildMessages(novel);
    expect(msgs[1].content).toContain("approximately 1200 words");
    expect(msgs[1].content).toContain("beginning, middle, and end");
  });

  it("omits the Thai block when outputLanguage is en", () => {
    const msgs = buildMessages(base());
    expect(msgs[0].content).not.toContain("Thai");
    expect(msgs[0].content).not.toContain("ภาษาบรรยาย");
  });

  it("includes the Thai block when outputLanguage is th", () => {
    const novel = base();
    novel.settings.outputLanguage = "th";
    const msgs = buildMessages(novel);
    expect(msgs[0].content).toContain("write the story entirely in Thai language");
    expect(msgs[0].content).toContain("ภาษาบรรยายแบบนิยาย");
  });

  it("includes established lore when present", () => {
    const novel = base();
    novel.lore = [
      { id: "l1", text: "Aria carries a silver dagger.", source: "ai", createdAt: 1 },
      { id: "l2", text: "The cloak is enchanted.", source: "user", createdAt: 2 },
    ];
    const msgs = buildMessages(novel);
    expect(msgs[0].content).toContain("Established lore");
    expect(msgs[0].content).toContain("Aria carries a silver dagger.");
    expect(msgs[0].content).toContain("The cloak is enchanted.");
  });

  it("omits the lore section when there is no lore", () => {
    const msgs = buildMessages(base());
    expect(msgs[0].content).not.toContain("Established lore");
  });

  it("with one chapter, treats it as the previous-chapter full text (no summaries)", () => {
    const novel = base();
    novel.chapters = [
      { id: "c1", title: "Chapter 1 · Arrival", prompt: "", content: "Hero arrived.", summary: "Hero arrived.", createdAt: 1 },
    ];
    const msgs = buildMessages(novel);
    expect(msgs[0].content).toContain("Previous chapter");
    expect(msgs[0].content).toContain("Chapter 1 · Arrival");
    expect(msgs[0].content).toContain("Hero arrived.");
    expect(msgs[0].content).not.toContain("Story so far");
  });

  it("with three chapters, summarizes 1..N-2 and keeps N-1 full", () => {
    const novel = base();
    novel.chapters = [
      { id: "c1", title: "Ch1", prompt: "", content: "FULL CH1 BODY", summary: "Hero arrives.", createdAt: 1 },
      { id: "c2", title: "Ch2", prompt: "", content: "FULL CH2 BODY", summary: "Map found.",     createdAt: 2 },
      { id: "c3", title: "Ch3", prompt: "", content: "FULL CH3 BODY", summary: "Forest entered.", createdAt: 3 },
    ];
    const msgs = buildMessages(novel);
    const sys = msgs[0].content;
    expect(sys).toContain("Story so far");
    expect(sys).toContain("Hero arrives.");
    expect(sys).toContain("Map found.");
    expect(sys).not.toContain("FULL CH1 BODY");
    expect(sys).not.toContain("FULL CH2 BODY");
    expect(sys).toContain("Previous chapter");
    expect(sys).toContain("FULL CH3 BODY");
  });

  it("falls back to full text for summarized-slot chapters that have no summary (legacy)", () => {
    const novel = base();
    novel.chapters = [
      { id: "c1", title: "Ch1", prompt: "", content: "LEGACY FULL CH1", summary: "", createdAt: 1 },
      { id: "c2", title: "Ch2", prompt: "", content: "FULL CH2",        summary: "", createdAt: 2 },
    ];
    const msgs = buildMessages(novel);
    expect(msgs[0].content).toContain("LEGACY FULL CH1");
    expect(msgs[0].content).toContain("FULL CH2");
  });

  it("with no chapters, omits both Story-so-far and Previous-chapter sections", () => {
    const msgs = buildMessages(base());
    expect(msgs[0].content).not.toContain("Story so far");
    expect(msgs[0].content).not.toContain("Previous chapter");
  });
});
```

- [ ] **Step 2: Run to verify tests fail**

Run: `npx vitest run lib/__tests__/prompt.test.ts`
Expected: most tests FAIL — current `buildMessages` produces the old format.

- [ ] **Step 3: Rewrite prompt.ts**

Replace the entire contents of `lib/prompt.ts` with:

```ts
import type { Message, Novel } from "./types";
import { SLIDING_WINDOW_FULL_COUNT } from "./agents/config";

const THAI_BLOCK = [
  "You MUST write the story entirely in Thai language.",
  "Use highly natural, elegant, and literary Thai prose (ภาษาบรรยายแบบนิยาย).",
  "Avoid robotic translations or unnatural phrasing.",
  "Ensure the dialogue sounds like real human conversation in Thai.",
].join("\n");

export function buildMessages(novel: Novel): Message[] {
  const fullCount = SLIDING_WINDOW_FULL_COUNT;
  const fullChapters = fullCount > 0 ? novel.chapters.slice(-fullCount) : [];
  const summarizedChapters =
    fullCount > 0 ? novel.chapters.slice(0, -fullCount) : novel.chapters.slice();

  const sections: string[] = ["You are an expert novel writer."];

  if (novel.settings.outputLanguage === "th") {
    sections.push(THAI_BLOCK);
  }

  sections.push("## Core story context and world-bible", novel.storyContext || "(empty)");

  if (novel.lore.length > 0) {
    const loreLines = novel.lore.map((l) => `- ${l.text}`).join("\n");
    sections.push("## Established lore", loreLines);
  }

  if (summarizedChapters.length > 0) {
    const lines = summarizedChapters.map((c, i) => {
      if (c.summary) {
        return `Chapter ${i + 1}: ${c.summary}`;
      }
      // Legacy fallback: include full text when no summary exists.
      return `Chapter ${i + 1} (no summary — full text):\n[${c.title}]\n${c.content}`;
    });
    sections.push("## Story so far (summaries)", lines.join("\n\n"));
  }

  if (fullChapters.length > 0) {
    const lines = fullChapters.map((c) => `[${c.title}]\n${c.content}`);
    sections.push("## Previous chapter (full text, for voice and immediate continuity)", lines.join("\n\n"));
  }

  const system = sections.join("\n\n");

  const targetWords = novel.settings.targetWords;
  const user = [
    `Write the next chapter. The output MUST be approximately ${targetWords} words long.`,
    "Ensure the chapter has a proper beginning, middle, and end.",
    "Do not pad the story unnecessarily, and ensure you finish the final sentence completely before stopping.",
    "Keep pacing tight.",
    "",
    `Guidance: ${novel.draft.prompt}`,
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
```

- [ ] **Step 4: Run to verify tests pass**

Run: `npx vitest run lib/__tests__/prompt.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Run the full test suite to make sure nothing else broke**

Run: `npx vitest run`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/prompt.ts lib/__tests__/prompt.test.ts
git commit -m "feat(prompt): sliding window + length control + Thai output mode"
```

---

## Task 7: Add Summarizer API route

**Files:**
- Create: `app/api/summarize/route.ts`

- [ ] **Step 1: Write the route**

Create `app/api/summarize/route.ts`:

```ts
import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";
import { buildSummarizerMessages } from "@/lib/agents/summarizer";
import { SUMMARIZER_MODEL } from "@/lib/agents/config";

export const runtime = "nodejs";

const Body = z.object({
  chapterTitle: z.string().min(1),
  chapterContent: z.string().min(1),
});

export async function POST(req: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return new Response("OPENROUTER_API_KEY is not set", { status: 500 });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return new Response("Bad request body", { status: 400 });
  }

  const openrouter = createOpenAICompatible({
    name: "openrouter",
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
  });

  try {
    const { text } = await generateText({
      model: openrouter(SUMMARIZER_MODEL),
      temperature: 0.3,
      messages: buildSummarizerMessages(parsed.data.chapterTitle, parsed.data.chapterContent),
    });
    return new Response(text, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    console.error("[/api/summarize] error:", err);
    return new Response("Summarizer failed", { status: 502 });
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/api/summarize/route.ts
git commit -m "feat(api): add /api/summarize route"
```

---

## Task 8: Add Lore Keeper API route

**Files:**
- Create: `app/api/extract-lore/route.ts`

- [ ] **Step 1: Write the route**

Create `app/api/extract-lore/route.ts`:

```ts
import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";
import { buildLoreKeeperMessages } from "@/lib/agents/loreKeeper";
import { LORE_KEEPER_MODEL } from "@/lib/agents/config";

export const runtime = "nodejs";

const Body = z.object({
  chapterTitle: z.string().min(1),
  chapterContent: z.string().min(1),
  existingLore: z.array(z.string()),
});

export async function POST(req: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return new Response("OPENROUTER_API_KEY is not set", { status: 500 });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return new Response("Bad request body", { status: 400 });
  }

  const openrouter = createOpenAICompatible({
    name: "openrouter",
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
  });

  try {
    const { text } = await generateText({
      model: openrouter(LORE_KEEPER_MODEL),
      temperature: 0.2,
      messages: buildLoreKeeperMessages(
        parsed.data.chapterTitle,
        parsed.data.chapterContent,
        parsed.data.existingLore,
      ),
    });
    return new Response(text, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    console.error("[/api/extract-lore] error:", err);
    return new Response("Lore extraction failed", { status: 502 });
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/api/extract-lore/route.ts
git commit -m "feat(api): add /api/extract-lore route"
```

---

## Task 9: Accept maxTokens in /api/generate

**Files:**
- Modify: `app/api/generate/route.ts`

- [ ] **Step 1: Update the route**

In `app/api/generate/route.ts`, replace the `Body` schema and the `streamText` call. The full file becomes:

```ts
import { streamText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";

export const runtime = "nodejs";

const Body = z.object({
  model: z.string().min(1),
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().int().positive().max(8000),
  messages: z.array(
    z.object({
      role: z.enum(["system", "user", "assistant"]),
      content: z.string(),
    }),
  ),
});

export async function POST(req: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return new Response("OPENROUTER_API_KEY is not set", { status: 500 });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return new Response("Bad request body", { status: 400 });
  }
  const { model, temperature, maxTokens, messages } = parsed.data;

  const openrouter = createOpenAICompatible({
    name: "openrouter",
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
  });

  const result = streamText({
    model: openrouter(model),
    temperature,
    maxTokens,
    messages,
    onError: ({ error }) => {
      console.error("[/api/generate] streamText error:", error);
    },
  });

  return result.toTextStreamResponse();
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS. If `maxTokens` is rejected as a property, the ai SDK v4 in this project uses `maxOutputTokens` instead — change the property name accordingly. (Verify by reading `node_modules/ai/dist/index.d.ts` for the `streamText` parameter type.)

- [ ] **Step 3: Update the client call to send maxTokens**

In `components/ChapterWorkspace.tsx`, find the `fetch("/api/generate", ...)` body and add `maxTokens`:

```ts
body: JSON.stringify({
  model: settings.model,
  temperature: settings.temperature,
  maxTokens: Math.floor(settings.targetWords * 1.5),
  messages: buildMessages(novel),
}),
```

- [ ] **Step 4: Type-check + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/generate/route.ts components/ChapterWorkspace.tsx
git commit -m "feat(api): pass maxTokens through to streamText"
```

---

## Task 10: Settings UI — language radio + length slider

**Files:**
- Modify: `components/SettingsDrawer.tsx`

- [ ] **Step 1: Add the two new controls**

In `components/SettingsDrawer.tsx`, inside the existing `<div className="p-4 space-y-4">` block (right after the Temperature section, before the closing `</div>`), add:

```tsx
<div>
  <label className="block text-xs uppercase text-zinc-400 mb-1">Output language</label>
  <div className="flex gap-4 text-sm">
    <label className="flex items-center gap-2">
      <input
        type="radio"
        name="outputLanguage"
        value="en"
        checked={novel.settings.outputLanguage === "en"}
        onChange={() => update((n) => { n.settings.outputLanguage = "en"; })}
      />
      English
    </label>
    <label className="flex items-center gap-2">
      <input
        type="radio"
        name="outputLanguage"
        value="th"
        checked={novel.settings.outputLanguage === "th"}
        onChange={() => update((n) => { n.settings.outputLanguage = "th"; })}
      />
      ไทย
    </label>
  </div>
</div>

<div>
  <label className="block text-xs uppercase text-zinc-400 mb-1">
    Target chapter length · {novel.settings.targetWords} words
  </label>
  <input
    type="range"
    min={500}
    max={3000}
    step={100}
    value={novel.settings.targetWords}
    onChange={(e) => update((n) => { n.settings.targetWords = parseInt(e.target.value, 10); })}
    className="w-full"
  />
</div>
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`
- Open `http://localhost:3000`
- Open Settings drawer
- Verify the language radio toggles between English / ไทย and the choice persists after a page reload
- Verify the slider moves between 500 and 3000 in steps of 100, and the label updates live

Stop dev server (Ctrl-C).

- [ ] **Step 4: Commit**

```bash
git add components/SettingsDrawer.tsx
git commit -m "feat(settings): add output language and target length controls"
```

---

## Task 11: Lore accordion in StoryContextEditor

**Files:**
- Modify: `components/StoryContextEditor.tsx`

- [ ] **Step 1: Replace the file**

Replace the entire contents of `components/StoryContextEditor.tsx` with:

```tsx
"use client";
import { useState } from "react";
import { useNovel } from "@/lib/store";
import { Textarea } from "./ui/Textarea";
import { Button } from "./ui/Button";

function wordCount(s: string) {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

export function StoryContextEditor() {
  const { novel, update } = useNovel();
  const [adding, setAdding] = useState(false);
  const [newLore, setNewLore] = useState("");

  const addLore = () => {
    const text = newLore.trim();
    if (!text) {
      setAdding(false);
      return;
    }
    update((n) => {
      n.lore.push({
        id: crypto.randomUUID(),
        text,
        source: "user",
        createdAt: Date.now(),
      });
    });
    setNewLore("");
    setAdding(false);
  };

  const deleteLore = (id: string) => {
    update((n) => {
      n.lore = n.lore.filter((l) => l.id !== id);
    });
  };

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Story Context
        </h2>
        <span className="text-xs text-zinc-500">{wordCount(novel.storyContext)} words</span>
      </div>
      <Textarea
        value={novel.storyContext}
        onChange={(e) => update((n) => { n.storyContext = e.target.value; })}
        placeholder="World bible, character profiles, plot arc, tone…"
        rows={8}
      />

      <details className="border border-zinc-800 rounded">
        <summary className="cursor-pointer px-3 py-2 text-xs uppercase tracking-wider text-zinc-400 select-none">
          📚 Dynamic Lore ({novel.lore.length})
        </summary>
        <div className="p-3 space-y-2">
          {novel.lore.length === 0 && !adding && (
            <p className="text-xs text-zinc-500 italic">
              No lore yet. Facts you approve in the Review Panel land here.
            </p>
          )}
          <ul className="space-y-1 text-sm">
            {novel.lore.map((l) => (
              <li key={l.id} className="flex items-start gap-2">
                <span className="text-zinc-500 mt-0.5">•</span>
                <span className="flex-1">{l.text}</span>
                <button
                  onClick={() => deleteLore(l.id)}
                  className="text-zinc-500 hover:text-red-400 text-xs"
                  aria-label="Delete lore item"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          {adding ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={newLore}
                onChange={(e) => setNewLore(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addLore();
                  if (e.key === "Escape") { setAdding(false); setNewLore(""); }
                }}
                placeholder="e.g., Aria carries a silver dagger."
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded p-2 text-sm"
              />
              <Button onClick={addLore}>Add</Button>
            </div>
          ) : (
            <Button variant="ghost" onClick={() => setAdding(true)}>+ Add lore</Button>
          )}
        </div>
      </details>
    </section>
  );
}
```

- [ ] **Step 2: Type-check + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: all PASS.

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`
- Click the accordion to expand. Verify it shows "No lore yet" placeholder.
- Click "+ Add lore", type "Test fact", press Enter. Verify it appears with a × button.
- Click ×. Verify it's removed.
- Reload the page. Verify lore persists.

Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add components/StoryContextEditor.tsx
git commit -m "feat(ui): add dynamic lore accordion to story context"
```

---

## Task 12: Create the ReviewContext

The review-flow state needs to be visible to multiple components (ChapterWorkspace owns it, ChapterSidebar + StoryContextEditor + SettingsDrawer button need to dim when reviewing). A small dedicated React Context keeps this clean and parallels `NovelProvider`.

**Files:**
- Create: `lib/review.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Write the context module**

Create `lib/review.tsx`:

```tsx
"use client";

import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

export type LoreCandidate = { text: string; checked: boolean };

export type ReviewState =
  | { kind: "idle" }
  | {
      kind: "active";
      stagedTitle: string;
      stagedPrompt: string;
      stagedContent: string;
      summary: string;
      summaryStatus: "loading" | "ready" | "error";
      loreCandidates: LoreCandidate[];
      loreStatus: "loading" | "ready" | "error";
    };

type ReviewContextValue = {
  state: ReviewState;
  setState: Dispatch<SetStateAction<ReviewState>>;
  reviewing: boolean;
};

const ReviewContext = createContext<ReviewContextValue | null>(null);

export function ReviewProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ReviewState>({ kind: "idle" });
  return (
    <ReviewContext.Provider
      value={{ state, setState, reviewing: state.kind === "active" }}
    >
      {children}
    </ReviewContext.Provider>
  );
}

export function useReview(): ReviewContextValue {
  const ctx = useContext(ReviewContext);
  if (!ctx) throw new Error("useReview must be used within a ReviewProvider");
  return ctx;
}
```

Using `Dispatch<SetStateAction<ReviewState>>` means `setState` accepts both a direct value AND a `(prev) => next` updater function — needed for safe updates from async resolvers in Task 14.

- [ ] **Step 2: Wrap the app**

Replace the contents of `app/page.tsx` with:

```tsx
"use client";
import { useState } from "react";
import { NovelProvider } from "@/lib/store";
import { ReviewProvider } from "@/lib/review";
import { ChapterSidebar } from "@/components/ChapterSidebar";
import { StoryContextEditor } from "@/components/StoryContextEditor";
import { ChapterWorkspace } from "@/components/ChapterWorkspace";
import { SettingsDrawer } from "@/components/SettingsDrawer";

export default function Page() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  return (
    <NovelProvider>
      <ReviewProvider>
        <div className="flex min-h-screen">
          <ChapterSidebar onOpenSettings={() => setSettingsOpen(true)} />
          <main className="flex-1 p-6 max-w-3xl space-y-8">
            <StoryContextEditor />
            <ChapterWorkspace />
          </main>
          <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </div>
      </ReviewProvider>
    </NovelProvider>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/review.tsx app/page.tsx
git commit -m "feat(review): add ReviewContext for gatekeeper flow state"
```

---

## Task 13: Create ReviewPanel component

**Files:**
- Create: `components/ReviewPanel.tsx`

This component reads the active review state, shows summary + lore checklist, and exposes Approve / Skip / Cancel callbacks via props (the parent ChapterWorkspace owns the commit logic so it can touch `useNovel()`).

- [ ] **Step 1: Write the component**

Create `components/ReviewPanel.tsx`:

```tsx
"use client";
import { useReview } from "@/lib/review";
import { Button } from "./ui/Button";
import { Textarea } from "./ui/Textarea";

type Props = {
  onApprove: () => void;
  onSkip: () => void;
  onCancel: () => void;
  onRetrySummary: () => void;
  onRetryLore: () => void;
};

export function ReviewPanel({ onApprove, onSkip, onCancel, onRetrySummary, onRetryLore }: Props) {
  const { state, setState } = useReview();
  if (state.kind !== "active") return null;

  const updateSummary = (text: string) =>
    setState({ ...state, summary: text });

  const toggleLore = (idx: number) =>
    setState({
      ...state,
      loreCandidates: state.loreCandidates.map((c, i) =>
        i === idx ? { ...c, checked: !c.checked } : c,
      ),
    });

  const editLore = (idx: number, text: string) =>
    setState({
      ...state,
      loreCandidates: state.loreCandidates.map((c, i) =>
        i === idx ? { ...c, text } : c,
      ),
    });

  const bothDone =
    state.summaryStatus !== "loading" && state.loreStatus !== "loading";

  return (
    <section className="border border-amber-700 bg-amber-950/30 rounded p-4 space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-300">
        Review chapter before saving
      </h2>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs uppercase text-zinc-400">Summary</label>
          {state.summaryStatus === "loading" && (
            <span className="text-xs text-zinc-500">Summarizing…</span>
          )}
          {state.summaryStatus === "error" && (
            <button onClick={onRetrySummary} className="text-xs text-amber-400 underline">
              Retry summary
            </button>
          )}
        </div>
        {state.summaryStatus === "error" ? (
          <p className="text-xs text-red-300">
            Summarizer failed — you can still save without a summary.
          </p>
        ) : (
          <Textarea
            value={state.summary}
            onChange={(e) => updateSummary(e.target.value)}
            rows={5}
            disabled={state.summaryStatus === "loading"}
          />
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs uppercase text-zinc-400">New lore</label>
          {state.loreStatus === "loading" && (
            <span className="text-xs text-zinc-500">Extracting…</span>
          )}
          {state.loreStatus === "error" && (
            <button onClick={onRetryLore} className="text-xs text-amber-400 underline">
              Retry lore
            </button>
          )}
        </div>
        {state.loreStatus === "error" ? (
          <p className="text-xs text-red-300">
            Lore extraction failed — chapter will save without new lore.
          </p>
        ) : state.loreCandidates.length === 0 && state.loreStatus === "ready" ? (
          <p className="text-xs text-zinc-500 italic">No new lore extracted.</p>
        ) : (
          <ul className="space-y-1">
            {state.loreCandidates.map((c, i) => (
              <li key={i} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={c.checked}
                  onChange={() => toggleLore(i)}
                  className="mt-1.5"
                />
                <input
                  value={c.text}
                  onChange={(e) => editLore(i, e.target.value)}
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded p-1.5 text-sm"
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex gap-2 pt-2 border-t border-amber-800">
        <Button onClick={onApprove} disabled={!bothDone}>
          Approve & save
        </Button>
        <Button variant="secondary" onClick={onSkip} disabled={!bothDone}>
          Skip review & save chapter only
        </Button>
        <button onClick={onCancel} className="text-xs text-zinc-400 underline ml-auto">
          Cancel
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (or "ReviewPanel imported but unused" warnings — those go away in the next task).

- [ ] **Step 3: Commit**

```bash
git add components/ReviewPanel.tsx
git commit -m "feat(review): add ReviewPanel gatekeeper UI"
```

---

## Task 14: Wire ChapterWorkspace into the review flow

**Files:**
- Modify: `components/ChapterWorkspace.tsx`

The Send button now stages the chapter (does NOT commit), starts both agent calls in parallel, and switches the ReviewContext to `active`. Approve / Skip / Cancel callbacks then commit (or discard) the staged chapter.

- [ ] **Step 1: Replace the file**

Replace the entire contents of `components/ChapterWorkspace.tsx` with:

```tsx
"use client";
import { useRef, useState } from "react";
import { useNovel } from "@/lib/store";
import { useReview, type LoreCandidate } from "@/lib/review";
import { buildMessages } from "@/lib/prompt";
import { readBufferedStream } from "@/lib/stream";
import { parseSummarizerOutput } from "@/lib/agents/summarizer";
import { parseLoreKeeperOutput } from "@/lib/agents/loreKeeper";
import { AGENT_TIMEOUT_MS } from "@/lib/agents/config";
import { Button } from "./ui/Button";
import { Textarea } from "./ui/Textarea";
import { ReviewPanel } from "./ReviewPanel";

async function callAgent(
  url: string,
  body: unknown,
  signal: AbortSignal,
): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.text();
}

export function ChapterWorkspace() {
  const { novel, update } = useNovel();
  const { state: reviewState, setState: setReview, reviewing } = useReview();
  const { draft, settings } = novel;
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const agentAbortRef = useRef<AbortController | null>(null);

  const canGenerate =
    !streaming && !reviewing && Boolean(novel.storyContext.trim() || draft.prompt.trim());

  const generate = async () => {
    setError(null);
    setStreaming(true);
    update((n) => { n.draft.output = ""; });
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: settings.model,
          temperature: settings.temperature,
          maxTokens: Math.floor(settings.targetWords * 1.5),
          messages: buildMessages(novel),
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        setError(`${res.status} · ${await res.text()}`);
        return;
      }
      await readBufferedStream(
        res.body,
        (chunk) => update((n) => { n.draft.output += chunk; }),
        controller.signal,
      );
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError((e as Error).message);
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const stop = () => abortRef.current?.abort();

  const runAgents = (chapterTitle: string, chapterContent: string, existingLore: string[]) => {
    const controller = new AbortController();
    agentAbortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);

    const summaryP = callAgent("/api/summarize",
      { chapterTitle, chapterContent }, controller.signal);
    const loreP = callAgent("/api/extract-lore",
      { chapterTitle, chapterContent, existingLore }, controller.signal);

    summaryP
      .then((text) => {
        const bullets = parseSummarizerOutput(text);
        const summary = bullets.length > 0 ? bullets.map((b) => `- ${b}`).join("\n") : text.trim();
        setReview((prev) =>
          prev.kind === "active"
            ? { ...prev, summary, summaryStatus: "ready" }
            : prev,
        );
      })
      .catch((e) => {
        if ((e as Error).name === "AbortError") return;
        console.error("[summarizer]", e);
        setReview((prev) =>
          prev.kind === "active" ? { ...prev, summaryStatus: "error" } : prev,
        );
      });

    loreP
      .then((text) => {
        const bullets = parseLoreKeeperOutput(text);
        const candidates: LoreCandidate[] = bullets.map((b) => ({ text: b, checked: true }));
        setReview((prev) =>
          prev.kind === "active"
            ? { ...prev, loreCandidates: candidates, loreStatus: "ready" }
            : prev,
        );
      })
      .catch((e) => {
        if ((e as Error).name === "AbortError") return;
        console.error("[loreKeeper]", e);
        setReview((prev) =>
          prev.kind === "active" ? { ...prev, loreStatus: "error" } : prev,
        );
      });

    Promise.allSettled([summaryP, loreP]).finally(() => clearTimeout(timeout));
  };

  const send = () => {
    const title = draft.title.trim() || `Chapter ${novel.chapters.length + 1}`;
    const content = draft.output;
    if (!content.trim()) return;

    setReview({
      kind: "active",
      stagedTitle: title,
      stagedPrompt: draft.prompt,
      stagedContent: content,
      summary: "",
      summaryStatus: "loading",
      loreCandidates: [],
      loreStatus: "loading",
    });

    runAgents(title, content, novel.lore.map((l) => l.text));
  };

  const commitChapter = (summary: string, approvedLore: LoreCandidate[]) => {
    if (reviewState.kind !== "active") return;
    const stagedTitle = reviewState.stagedTitle;
    const stagedPrompt = reviewState.stagedPrompt;
    const stagedContent = reviewState.stagedContent;

    update((n) => {
      const d = n.draft;
      if (d.chapterId) {
        const existing = n.chapters.find((c) => c.id === d.chapterId);
        if (existing) {
          existing.title = stagedTitle;
          existing.prompt = stagedPrompt;
          existing.content = stagedContent;
          existing.summary = summary;
        }
      } else {
        const newId = crypto.randomUUID();
        n.chapters.push({
          id: newId,
          title: stagedTitle,
          prompt: stagedPrompt,
          content: stagedContent,
          summary,
          createdAt: Date.now(),
        });
        const lastChapterId = newId;
        for (const c of approvedLore) {
          if (!c.checked || !c.text.trim()) continue;
          n.lore.push({
            id: crypto.randomUUID(),
            text: c.text.trim(),
            source: "ai",
            chapterId: lastChapterId,
            createdAt: Date.now(),
          });
        }
      }
      n.draft = { chapterId: null, title: "", prompt: "", output: "" };
    });
  };

  const onApprove = () => {
    if (reviewState.kind !== "active") return;
    commitChapter(reviewState.summary, reviewState.loreCandidates);
    setReview({ kind: "idle" });
  };

  const onSkip = () => {
    agentAbortRef.current?.abort();
    commitChapter("", []);
    setReview({ kind: "idle" });
  };

  const onCancel = () => {
    agentAbortRef.current?.abort();
    setReview({ kind: "idle" });
  };

  const onRetrySummary = () => {
    if (reviewState.kind !== "active") return;
    setReview({ ...reviewState, summaryStatus: "loading" });
    const controller = new AbortController();
    callAgent("/api/summarize",
      { chapterTitle: reviewState.stagedTitle, chapterContent: reviewState.stagedContent },
      controller.signal,
    )
      .then((text) => {
        const bullets = parseSummarizerOutput(text);
        const summary = bullets.length > 0 ? bullets.map((b) => `- ${b}`).join("\n") : text.trim();
        setReview((prev) =>
          prev.kind === "active"
            ? { ...prev, summary, summaryStatus: "ready" }
            : prev,
        );
      })
      .catch(() => {
        setReview((prev) =>
          prev.kind === "active" ? { ...prev, summaryStatus: "error" } : prev,
        );
      });
  };

  const onRetryLore = () => {
    if (reviewState.kind !== "active") return;
    setReview({ ...reviewState, loreStatus: "loading" });
    const controller = new AbortController();
    callAgent("/api/extract-lore",
      {
        chapterTitle: reviewState.stagedTitle,
        chapterContent: reviewState.stagedContent,
        existingLore: novel.lore.map((l) => l.text),
      },
      controller.signal,
    )
      .then((text) => {
        const bullets = parseLoreKeeperOutput(text);
        const candidates: LoreCandidate[] = bullets.map((b) => ({ text: b, checked: true }));
        setReview((prev) =>
          prev.kind === "active"
            ? { ...prev, loreCandidates: candidates, loreStatus: "ready" }
            : prev,
        );
      })
      .catch(() => {
        setReview((prev) =>
          prev.kind === "active" ? { ...prev, loreStatus: "error" } : prev,
        );
      });
  };

  const discard = () => {
    if (!window.confirm("Discard this draft?")) return;
    update((n) => {
      n.draft = { chapterId: null, title: "", prompt: "", output: "" };
    });
  };

  return (
    <section className="space-y-6">
      <div className={reviewing ? "pointer-events-none opacity-50" : ""}>
        <div className="space-y-2">
          <label className="text-xs uppercase text-zinc-400">Chapter title</label>
          <input
            value={draft.title}
            onChange={(e) => update((n) => { n.draft.title = e.target.value; })}
            placeholder="Chapter 1 · The arrival"
            className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-sm"
          />
        </div>

        <div className="space-y-2 mt-6">
          <label className="text-xs uppercase text-zinc-400">Chapter prompt</label>
          <Textarea
            value={draft.prompt}
            onChange={(e) => update((n) => { n.draft.prompt = e.target.value; })}
            placeholder="What should happen in this chapter?"
            rows={4}
          />
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
        </div>

        {error && (
          <div className="bg-red-900/40 border border-red-700 text-red-200 rounded p-3 text-sm mt-6">
            {error}
          </div>
        )}

        <div className="space-y-2 mt-6">
          <label className="text-xs uppercase text-zinc-400">Output (editable)</label>
          <Textarea
            value={draft.output}
            onChange={(e) => update((n) => { n.draft.output = e.target.value; })}
            rows={16}
            className="font-serif text-base leading-relaxed"
            placeholder="Generated chapter will stream in here…"
          />
          <div className="flex gap-2">
            <Button onClick={send} disabled={!draft.output.trim() || streaming || reviewing}>
              Send to Chapter History
            </Button>
            <Button variant="secondary" onClick={discard} disabled={streaming || reviewing}>
              Discard
            </Button>
          </div>
        </div>
      </div>

      {reviewing && (
        <ReviewPanel
          onApprove={onApprove}
          onSkip={onSkip}
          onCancel={onCancel}
          onRetrySummary={onRetrySummary}
          onRetryLore={onRetryLore}
        />
      )}
    </section>
  );
}
```

- [ ] **Step 2: Type-check + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add components/ChapterWorkspace.tsx
git commit -m "feat(review): wire ChapterWorkspace into review flow"
```

---

## Task 15: Dim sibling components when reviewing

**Files:**
- Modify: `components/ChapterSidebar.tsx`
- Modify: `components/StoryContextEditor.tsx`
- Modify: `components/SettingsDrawer.tsx`

Each sibling consumes `useReview()` and applies `pointer-events-none opacity-50` when `reviewing` is true.

- [ ] **Step 1: Update ChapterSidebar**

Read `components/ChapterSidebar.tsx`. At the top, add:

```tsx
import { useReview } from "@/lib/review";
```

Inside the function component, add:

```tsx
const { reviewing } = useReview();
```

Wrap (or modify) the outermost element's `className` to include `${reviewing ? "pointer-events-none opacity-50" : ""}`. If the outer element already has a className, append to it.

- [ ] **Step 2: Update StoryContextEditor**

In `components/StoryContextEditor.tsx`, add the import and hook the same way, and apply the dim classes to the outer `<section>`:

```tsx
import { useReview } from "@/lib/review";
// inside the component:
const { reviewing } = useReview();
// outer section:
<section className={`space-y-2 ${reviewing ? "pointer-events-none opacity-50" : ""}`}>
```

- [ ] **Step 3: Update SettingsDrawer**

Same pattern — dim the drawer's outer div when reviewing. The drawer can still be visible underneath (not auto-closed), just non-interactive.

- [ ] **Step 4: Type-check + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add components/ChapterSidebar.tsx components/StoryContextEditor.tsx components/SettingsDrawer.tsx
git commit -m "feat(review): dim sibling UI while reviewing"
```

---

## Task 16: End-to-end manual smoke test

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Walk through the full flow**

Open `http://localhost:3000` and verify each:

1. **Settings work**: open Settings, switch language to ไทย, set Target chapter length to 800. Close Settings.
2. **Generate Ch1 in Thai**: write a short story context, write a prompt, click Generate. Output should stream in Thai.
3. **Review flow opens**: click "Send to Chapter History". The Review panel slides in below the workspace. The sidebar, story context editor, and chapter inputs are dimmed and non-clickable.
4. **Review panel works**: edit the summary, uncheck one lore bullet, click "Approve & save". Chapter appears in sidebar; lore accordion shows the approved bullets only.
5. **Generate Ch2**: click "+ New chapter". Write a prompt. Click Generate. In devtools (Network tab), inspect the `/api/generate` request body — confirm `messages[0].content` includes `## Previous chapter` with Ch1's full text and any `## Established lore` lines, and `messages[1].content` includes `approximately 800 words`.
6. **Skip review path**: on Ch2, click Send → click "Skip review & save chapter only". Chapter saves with no summary; lore unchanged.
7. **Cancel path**: generate a Ch3 draft, click Send, then click Cancel. Draft remains editable, no chapter committed.
8. **Reload persistence**: reload the page. All chapters, lore, settings, and language choice persist.
9. **Switch back to English**: in Settings, switch to English. Generate a new chapter — it should be in English.
10. **Length adherence**: Set slider to 500. Generate. Output should be roughly 500 words (not 2000+).

If any step fails, fix it before considering the upgrade complete.

- [ ] **Step 3: Stop the dev server**

Press Ctrl-C.

- [ ] **Step 4: Final commit (if anything changed during smoke fixes)**

If the smoke test required code fixes, commit them with descriptive messages. Otherwise no commit needed.

---

## Verification checklist (run before declaring complete)

- [ ] `npx tsc --noEmit` — passes
- [ ] `npx vitest run` — all tests pass
- [ ] Manual smoke test (Task 16) — every step verified
- [ ] No `console.error` from agents during a normal end-to-end run
- [ ] localStorage inspection: `novel-generate:v1` key contains `lore`, chapters with `summary`, settings with `targetWords` and `outputLanguage`
