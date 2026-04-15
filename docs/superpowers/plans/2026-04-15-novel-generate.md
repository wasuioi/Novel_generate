# Novel Generate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js single-page app that helps the author draft short novels by feeding a world bible and past chapters into every LLM generation.

**Architecture:** Next.js 15 App Router. One page, one API route (`/api/generate`) that proxies a streaming request to OpenRouter via the Vercel `ai` SDK. All user state lives in the browser's `localStorage` under a single versioned key. No database, no auth, no multi-novel support.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS v3, Vercel `ai` SDK + `@ai-sdk/openai-compatible`, Zod, Vitest + React Testing Library.

**Design spec:** `docs/superpowers/specs/2026-04-15-novel-generate-design.md`

---

## Task 1: Bootstrap Next.js scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `postcss.config.mjs`
- Create: `tailwind.config.ts`
- Create: `app/layout.tsx`
- Create: `app/globals.css`
- Create: `app/page.tsx`
- Create: `.env.example`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "novel-generate",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "ai": "^4.0.0",
    "@ai-sdk/openai-compatible": "^0.2.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.6.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "vitest": "^2.1.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^25.0.0",
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: installs without errors (warnings about peer deps are acceptable).

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `next.config.ts`**

```ts
import type { NextConfig } from "next";
const nextConfig: NextConfig = {};
export default nextConfig;
```

- [ ] **Step 5: Create `tailwind.config.ts`**

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
export default config;
```

- [ ] **Step 6: Create `postcss.config.mjs`**

```js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

- [ ] **Step 7: Create `app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root { color-scheme: dark; }

html, body {
  background: #111;
  color: #e6e6e6;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
```

- [ ] **Step 8: Create `app/layout.tsx`**

```tsx
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Novel Generate",
  description: "Draft short novels with an LLM",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 9: Create `app/page.tsx` placeholder**

```tsx
export default function Page() {
  return <main className="p-8">Novel Generate — under construction</main>;
}
```

- [ ] **Step 10: Create `.env.example`**

```
# Get a key at https://openrouter.ai/keys
OPENROUTER_API_KEY=sk-or-v1-...
```

- [ ] **Step 11: Verify dev server boots**

Run: `npm run dev`
Expected: boots on `http://localhost:3000`. Visiting it shows the placeholder. Stop with Ctrl-C.

- [ ] **Step 12: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts postcss.config.mjs tailwind.config.ts app/ .env.example
git commit -m "chore: bootstrap next.js + tailwind scaffold"
```

---

## Task 2: Configure Vitest

**Files:**
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

- [ ] **Step 2: Create `vitest.setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: Verify test runner launches**

Run: `npm test`
Expected: either "No test files found" (exit 1 is fine) or 0 tests pass. Either confirms Vitest starts cleanly.

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts vitest.setup.ts
git commit -m "chore: configure vitest"
```

---

## Task 3: Define domain types

**Files:**
- Create: `lib/types.ts`

- [ ] **Step 1: Write `lib/types.ts`**

```ts
export type Chapter = {
  id: string;
  title: string;
  prompt: string;
  content: string;
  createdAt: number;
};

export type Settings = {
  model: string;
  temperature: number;
};

export type Draft = {
  chapterId: string | null;
  title: string;
  prompt: string;
  output: string;
};

export type Novel = {
  storyContext: string;
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
  chapters: [],
  draft: { chapterId: null, title: "", prompt: "", output: "" },
  settings: { model: "anthropic/claude-3.5-sonnet", temperature: 0.8 },
};
```

- [ ] **Step 2: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add domain types"
```

---

## Task 4: Prompt assembler (TDD)

**Files:**
- Create: `lib/__tests__/prompt.test.ts`
- Create: `lib/prompt.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/__tests__/prompt.test.ts
import { describe, it, expect } from "vitest";
import { buildMessages } from "../prompt";
import type { Novel } from "../types";

const base = (): Novel => ({
  storyContext: "Medieval fantasy with dragons.",
  chapters: [],
  draft: { chapterId: null, title: "Ch 1", prompt: "Introduce the hero.", output: "" },
  settings: { model: "anthropic/claude-3.5-sonnet", temperature: 0.8 },
});

describe("buildMessages", () => {
  it("labels the first-chapter case", () => {
    const msgs = buildMessages(base());
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe("system");
    expect(msgs[0].content).toContain("Medieval fantasy with dragons.");
    expect(msgs[0].content).toContain("(none yet — this is the first chapter)");
    expect(msgs[1]).toEqual({
      role: "user",
      content: "Write the next chapter. Guidance:\nIntroduce the hero.",
    });
  });

  it("appends past chapters in order, each labeled with its title", () => {
    const novel = base();
    novel.chapters = [
      { id: "1", title: "Chapter 1 · Arrival", prompt: "", content: "The hero arrives.", createdAt: 1 },
      { id: "2", title: "Chapter 2 · Map",     prompt: "", content: "A map is found.",   createdAt: 2 },
    ];
    const msgs = buildMessages(novel);
    const system = msgs[0].content;
    const arrivalIdx = system.indexOf("Chapter 1 · Arrival");
    const mapIdx = system.indexOf("Chapter 2 · Map");
    expect(arrivalIdx).toBeGreaterThan(-1);
    expect(mapIdx).toBeGreaterThan(arrivalIdx);
    expect(system).toContain("The hero arrives.");
    expect(system).toContain("A map is found.");
  });

  it("still produces a well-formed system message with empty story context", () => {
    const novel = base();
    novel.storyContext = "";
    const msgs = buildMessages(novel);
    expect(msgs[0].content).toContain("You are an expert novel writer.");
    expect(msgs[0].content).toContain("Here is the core story context and world-bible:");
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test`
Expected: FAIL — "Cannot find module '../prompt'".

- [ ] **Step 3: Implement `lib/prompt.ts`**

```ts
import type { Message, Novel } from "./types";

export function buildMessages(novel: Novel): Message[] {
  const pastChapters = novel.chapters
    .map((c) => `[${c.title}]\n${c.content}`)
    .join("\n\n");

  const system = [
    "You are an expert novel writer.",
    "",
    "Here is the core story context and world-bible:",
    novel.storyContext,
    "",
    "Here are the previous chapters for continuity:",
    pastChapters || "(none yet — this is the first chapter)",
  ].join("\n");

  const user = `Write the next chapter. Guidance:\n${novel.draft.prompt}`;

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
```

- [ ] **Step 4: Run to confirm all three pass**

Run: `npm test`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/prompt.ts lib/__tests__/prompt.test.ts
git commit -m "feat: assemble system/user messages for generation"
```

---

## Task 5: `useNovel` store (TDD)

**Files:**
- Create: `lib/__tests__/store.test.ts`
- Create: `lib/store.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/__tests__/store.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNovel, STORAGE_KEY } from "../store";
import { DEFAULT_NOVEL } from "../types";

describe("useNovel", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns DEFAULT_NOVEL when nothing is stored", () => {
    const { result } = renderHook(() => useNovel());
    expect(result.current.novel).toEqual(DEFAULT_NOVEL);
  });

  it("persists updates across hook instances (roundtrip)", async () => {
    const { result } = renderHook(() => useNovel());
    act(() => {
      result.current.update((n) => { n.storyContext = "A dark forest."; });
    });
    await new Promise((r) => setTimeout(r, 400)); // past the 300ms debounce
    const { result: again } = renderHook(() => useNovel());
    // second mount reads from localStorage in its mount effect
    await new Promise((r) => setTimeout(r, 0));
    expect(again.current.novel.storyContext).toBe("A dark forest.");
  });

  it("falls back to defaults when stored data is malformed", () => {
    localStorage.setItem(STORAGE_KEY, "not json");
    const { result } = renderHook(() => useNovel());
    expect(result.current.novel).toEqual(DEFAULT_NOVEL);
  });

  it("reset() clears localStorage and returns to defaults", () => {
    const { result } = renderHook(() => useNovel());
    act(() => {
      result.current.update((n) => { n.storyContext = "Something."; });
      result.current.reset();
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(result.current.novel).toEqual(DEFAULT_NOVEL);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test`
Expected: FAIL — "Cannot find module '../store'".

- [ ] **Step 3: Implement `lib/store.ts`**

```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_NOVEL, type Novel } from "./types";

export const STORAGE_KEY = "novel-generate:v1";
const DEBOUNCE_MS = 300;

function load(): Novel {
  if (typeof window === "undefined") return DEFAULT_NOVEL;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_NOVEL;
  try {
    const parsed = JSON.parse(raw) as Partial<Novel>;
    return {
      ...DEFAULT_NOVEL,
      ...parsed,
      settings: { ...DEFAULT_NOVEL.settings, ...(parsed.settings ?? {}) },
      draft:    { ...DEFAULT_NOVEL.draft,    ...(parsed.draft    ?? {}) },
    };
  } catch {
    return DEFAULT_NOVEL;
  }
}

export function useNovel() {
  const [novel, setNovel] = useState<Novel>(DEFAULT_NOVEL);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setNovel(load());
  }, []);

  const save = useCallback((n: Novel) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(n));
    }, DEBOUNCE_MS);
  }, []);

  const update = useCallback(
    (mutator: (draft: Novel) => void) => {
      setNovel((prev) => {
        const copy = structuredClone(prev);
        mutator(copy);
        save(copy);
        return copy;
      });
    },
    [save],
  );

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    window.localStorage.removeItem(STORAGE_KEY);
    setNovel(DEFAULT_NOVEL);
  }, []);

  return { novel, update, reset };
}
```

- [ ] **Step 4: Run to confirm all four pass**

Run: `npm test`
Expected: 7 tests total pass (3 prompt + 4 store).

- [ ] **Step 5: Commit**

```bash
git add lib/store.ts lib/__tests__/store.test.ts
git commit -m "feat: localStorage-backed useNovel hook"
```

---

## Task 6: rAF-buffered stream reader

**Files:**
- Create: `lib/stream.ts`

No tests — rAF + ReadableStream interactions are not worth mocking in unit tests; validated end-to-end in Task 13.

- [ ] **Step 1: Write `lib/stream.ts`**

```ts
export async function readBufferedStream(
  body: ReadableStream<Uint8Array>,
  onFlush: (chunk: string) => void,
  signal: AbortSignal,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let scheduled = false;

  const flush = () => {
    scheduled = false;
    if (!buffer) return;
    const out = buffer;
    buffer = "";
    onFlush(out);
  };

  const abortHandler = () => { reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", abortHandler);

  try {
    while (true) {
      if (signal.aborted) break;
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(flush);
      }
    }
  } finally {
    flush();
    signal.removeEventListener("abort", abortHandler);
    try { reader.releaseLock(); } catch { /* already released by cancel */ }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/stream.ts
git commit -m "feat: rAF-buffered stream reader"
```

---

## Task 7: `/api/generate` route

**Files:**
- Create: `app/api/generate/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { streamText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";

export const runtime = "nodejs";

const Body = z.object({
  model: z.string().min(1),
  temperature: z.number().min(0).max(2),
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
  const { model, temperature, messages } = parsed.data;

  const openrouter = createOpenAICompatible({
    name: "openrouter",
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
  });

  const result = streamText({
    model: openrouter(model),
    temperature,
    messages,
  });

  return result.toTextStreamResponse();
}
```

- [ ] **Step 2: Smoke-test the route with `curl`**

Put a real key in `.env.local` first, then:

Terminal A: `npm run dev`

Terminal B:
```bash
curl -N -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model":"anthropic/claude-3.5-sonnet","temperature":0.8,"messages":[{"role":"user","content":"Say hello in one short sentence."}]}'
```
Expected: streaming text response. Stop the dev server when done.

- [ ] **Step 3: Commit**

```bash
git add app/api/generate/route.ts
git commit -m "feat: /api/generate OpenRouter proxy with streaming"
```

---

## Task 8: UI primitives

**Files:**
- Create: `components/ui/Button.tsx`
- Create: `components/ui/Textarea.tsx`

- [ ] **Step 1: Write `components/ui/Button.tsx`**

```tsx
"use client";
import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant };

const styles: Record<Variant, string> = {
  primary:   "bg-emerald-600 hover:bg-emerald-500 text-white",
  secondary: "bg-zinc-700 hover:bg-zinc-600 text-zinc-100",
  danger:    "bg-red-600 hover:bg-red-500 text-white",
  ghost:     "bg-transparent hover:bg-zinc-800 text-zinc-200",
};

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = "primary", className = "", ...rest }, ref) => (
    <button
      ref={ref}
      className={`px-3 py-1.5 rounded text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      {...rest}
    />
  ),
);
Button.displayName = "Button";
```

- [ ] **Step 2: Write `components/ui/Textarea.tsx`**

```tsx
"use client";
import { TextareaHTMLAttributes, forwardRef } from "react";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, Props>(
  ({ className = "", ...rest }, ref) => (
    <textarea
      ref={ref}
      className={`w-full bg-zinc-900 border border-zinc-700 rounded p-3 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 resize-y ${className}`}
      {...rest}
    />
  ),
);
Textarea.displayName = "Textarea";
```

- [ ] **Step 3: Commit**

```bash
git add components/ui/Button.tsx components/ui/Textarea.tsx
git commit -m "feat: basic ui primitives"
```

---

## Task 9: SettingsDrawer

**Files:**
- Create: `components/SettingsDrawer.tsx`

- [ ] **Step 1: Write it**

```tsx
"use client";
import { useNovel } from "@/lib/store";
import { Button } from "./ui/Button";

const MODEL_OPTIONS = [
  "anthropic/claude-3.5-sonnet",
  "anthropic/claude-3.7-sonnet",
  "openai/gpt-4o",
  "google/gemini-2.0-flash",
  "meta-llama/llama-3.3-70b-instruct",
] as const;

type Props = { open: boolean; onClose: () => void };

export function SettingsDrawer({ open, onClose }: Props) {
  const { novel, update, reset } = useNovel();

  const onReset = () => {
    const ok = window.confirm(
      "This deletes your story context, all saved chapters, and the current draft. This cannot be undone. Continue?",
    );
    if (ok) {
      reset();
      onClose();
    }
  };

  return (
    <div
      className={`fixed inset-y-0 right-0 w-80 bg-zinc-900 border-l border-zinc-800 shadow-xl transform transition-transform z-20 ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
      aria-hidden={!open}
    >
      <div className="p-4 flex items-center justify-between border-b border-zinc-800">
        <h2 className="font-semibold">Settings</h2>
        <Button variant="ghost" onClick={onClose} aria-label="Close settings">✕</Button>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <label className="block text-xs uppercase text-zinc-400 mb-1">Model</label>
          <select
            value={novel.settings.model}
            onChange={(e) => update((n) => { n.settings.model = e.target.value; })}
            className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-sm"
          >
            {MODEL_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs uppercase text-zinc-400 mb-1">
            Temperature · {novel.settings.temperature.toFixed(1)}
          </label>
          <input
            type="range"
            min={0}
            max={1.5}
            step={0.1}
            value={novel.settings.temperature}
            onChange={(e) => update((n) => { n.settings.temperature = parseFloat(e.target.value); })}
            className="w-full"
          />
        </div>

        <p className="text-xs text-zinc-500">
          API key lives in <code>.env.local</code> on the server.
        </p>
      </div>

      <div className="absolute bottom-0 inset-x-0 p-4 border-t border-zinc-800">
        <Button variant="danger" className="w-full" onClick={onReset}>
          Start New Novel (Clear All Data)
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/SettingsDrawer.tsx
git commit -m "feat: settings drawer (model, temperature, hard reset)"
```

---

## Task 10: ChapterSidebar

**Files:**
- Create: `components/ChapterSidebar.tsx`

- [ ] **Step 1: Write it**

```tsx
"use client";
import { useNovel } from "@/lib/store";
import { Button } from "./ui/Button";

type Props = { onOpenSettings: () => void };

function preview(text: string) {
  return text.split("\n").slice(0, 2).join(" ").slice(0, 80);
}

export function ChapterSidebar({ onOpenSettings }: Props) {
  const { novel, update } = useNovel();
  const { chapters, draft } = novel;

  const loadChapter = (id: string) => {
    const ch = chapters.find((c) => c.id === id);
    if (!ch) return;
    update((n) => {
      n.draft = { chapterId: ch.id, title: ch.title, prompt: ch.prompt, output: ch.content };
    });
  };

  const newChapter = () => {
    if (draft.output && !window.confirm("Discard unsaved draft?")) return;
    update((n) => {
      n.draft = { chapterId: null, title: "", prompt: "", output: "" };
    });
  };

  const showDraftRow = draft.chapterId === null && (draft.title || draft.output);

  return (
    <aside className="w-56 shrink-0 h-screen sticky top-0 border-r border-zinc-800 flex flex-col">
      <div className="p-4 border-b border-zinc-800">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Chapters</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {chapters.length === 0 && !showDraftRow && (
          <p className="p-4 text-xs text-zinc-500">No chapters yet.</p>
        )}
        {chapters.map((c) => (
          <button
            key={c.id}
            onClick={() => loadChapter(c.id)}
            className={`w-full text-left p-3 border-b border-zinc-900 hover:bg-zinc-800 ${
              draft.chapterId === c.id ? "bg-zinc-800" : ""
            }`}
          >
            <div className="text-sm font-medium truncate">{c.title || "(untitled)"}</div>
            <div className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{preview(c.content)}</div>
          </button>
        ))}
        {showDraftRow && (
          <div className="p-3 bg-zinc-800 border-b border-zinc-900">
            <div className="text-sm font-medium text-emerald-400">▸ Draft</div>
            <div className="text-xs text-zinc-500 mt-0.5 line-clamp-2">
              {preview(draft.output) || "(empty)"}
            </div>
          </div>
        )}
      </div>
      <div className="p-3 space-y-2 border-t border-zinc-800">
        <Button variant="secondary" className="w-full" onClick={newChapter}>+ New chapter</Button>
        <Button variant="ghost" className="w-full" onClick={onOpenSettings}>⚙ Settings</Button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ChapterSidebar.tsx
git commit -m "feat: chapter sidebar"
```

---

## Task 11: StoryContextEditor

**Files:**
- Create: `components/StoryContextEditor.tsx`

- [ ] **Step 1: Write it**

```tsx
"use client";
import { useNovel } from "@/lib/store";
import { Textarea } from "./ui/Textarea";

function wordCount(s: string) {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

export function StoryContextEditor() {
  const { novel, update } = useNovel();
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
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/StoryContextEditor.tsx
git commit -m "feat: story context editor"
```

---

## Task 12: ChapterWorkspace (streaming + abort + save)

**Files:**
- Create: `components/ChapterWorkspace.tsx`

- [ ] **Step 1: Write it**

```tsx
"use client";
import { useRef, useState } from "react";
import { useNovel } from "@/lib/store";
import { buildMessages } from "@/lib/prompt";
import { readBufferedStream } from "@/lib/stream";
import { Button } from "./ui/Button";
import { Textarea } from "./ui/Textarea";

export function ChapterWorkspace() {
  const { novel, update } = useNovel();
  const { draft, settings } = novel;
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const canGenerate =
    !streaming && Boolean(novel.storyContext.trim() || draft.prompt.trim());

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

  const send = () => {
    update((n) => {
      const d = n.draft;
      const title = d.title.trim() || `Chapter ${n.chapters.length + 1}`;
      if (d.chapterId) {
        const existing = n.chapters.find((c) => c.id === d.chapterId);
        if (existing) {
          existing.title = title;
          existing.prompt = d.prompt;
          existing.content = d.output;
        }
      } else {
        n.chapters.push({
          id: crypto.randomUUID(),
          title,
          prompt: d.prompt,
          content: d.output,
          createdAt: Date.now(),
        });
      }
      n.draft = { chapterId: null, title: "", prompt: "", output: "" };
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
      <div className="space-y-2">
        <label className="text-xs uppercase text-zinc-400">Chapter title</label>
        <input
          value={draft.title}
          onChange={(e) => update((n) => { n.draft.title = e.target.value; })}
          placeholder="Chapter 1 · The arrival"
          className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-sm"
        />
      </div>

      <div className="space-y-2">
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
        <div className="bg-red-900/40 border border-red-700 text-red-200 rounded p-3 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <label className="text-xs uppercase text-zinc-400">Output (editable)</label>
        <Textarea
          value={draft.output}
          onChange={(e) => update((n) => { n.draft.output = e.target.value; })}
          rows={16}
          className="font-serif text-base leading-relaxed"
          placeholder="Generated chapter will stream in here…"
        />
        <div className="flex gap-2">
          <Button onClick={send} disabled={!draft.output.trim() || streaming}>
            Send to Chapter History
          </Button>
          <Button variant="secondary" onClick={discard} disabled={streaming}>
            Discard
          </Button>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ChapterWorkspace.tsx
git commit -m "feat: chapter workspace with streaming and abort"
```

---

## Task 13: Wire the SPA and end-to-end smoke test

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace the placeholder**

```tsx
"use client";
import { useState } from "react";
import { ChapterSidebar } from "@/components/ChapterSidebar";
import { StoryContextEditor } from "@/components/StoryContextEditor";
import { ChapterWorkspace } from "@/components/ChapterWorkspace";
import { SettingsDrawer } from "@/components/SettingsDrawer";

export default function Page() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  return (
    <div className="flex min-h-screen">
      <ChapterSidebar onOpenSettings={() => setSettingsOpen(true)} />
      <main className="flex-1 p-6 max-w-3xl space-y-8">
        <StoryContextEditor />
        <ChapterWorkspace />
      </main>
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
```

- [ ] **Step 2: Full manual smoke test**

Confirm `.env.local` has a real `OPENROUTER_API_KEY`. Run `npm run dev`. Open `http://localhost:3000` and walk through:

1. Type a short world bible in Story Context.
2. Type `A young apprentice discovers a hidden library` in Chapter prompt.
3. Click **Generate ▸** — verify text streams in smoothly (no flicker, no lag). Generate button swaps to **Stop generating**.
4. Click **Stop generating** mid-stream — streaming halts, partial text preserved, button swaps back.
5. Click **Generate ▸** again — new output replaces old.
6. Edit the output by hand.
7. Click **Send to Chapter History** — sidebar shows a new chapter, workspace resets to empty draft.
8. Click that chapter in the sidebar — draft loads its title, prompt, and content.
9. Edit the title, click **Send to Chapter History** again — chapter updates in place (no duplicate appears).
10. Generate a second chapter — verify the first chapter's content appears in the request (open DevTools → Network → `/api/generate` → Payload; confirm `[Chapter 1 · …]` in the system message).
11. Open **⚙ Settings** — change model and temperature. Close. Generate again; confirm it still works.
12. Open Settings → **Start New Novel** → confirm. All chapters vanish; workspace is empty; localStorage entry is gone (verify in DevTools → Application → Local Storage).
13. Reload the page — state you last saved persists (try steps 1–7 again, then reload without clicking reset).

Expected: every step passes with no console errors.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: wire SPA layout"
```

---

## Task 14: Polish pass

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Tune the serif stack for the output textarea**

Append to `app/globals.css`:

```css
.font-serif {
  font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
}
```

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: all 7 tests pass.

- [ ] **Step 3: Run type-check**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "chore: tune serif font stack for output"
```

---

## Verification checklist (run before declaring the feature done)

- [ ] `npm test` — all 7 tests pass (3 prompt + 4 store).
- [ ] `npm run typecheck` — zero errors.
- [ ] `npm run dev` — the full flow in Task 13 Step 2 works end-to-end with a real OpenRouter key.
- [ ] Closing and reopening the browser tab restores the last-saved novel state.
- [ ] `Start New Novel (Clear All Data)` empties localStorage and resets the UI.
- [ ] No empty `catch {}` blocks anywhere in the codebase.
