# Novel Generate — Design Spec

**Date:** 2026-04-15
**Status:** Draft for review

## Purpose

A personal web app for drafting short novels (5–10 chapters) with the help of a large language model. The app keeps a hand-written **world bible** and a growing **chapter history** that are automatically fed back into every generation, so the model maintains narrative continuity without manual copy-pasting.

The app is a single-page Next.js site run locally on the author's machine. There is no auth, no database, no multi-user support. The author provides an OpenRouter API key, which stays on the server side only.

## Goals

- Turn a world bible + per-chapter brief into a streamed draft in a few seconds.
- Preserve continuity across chapters automatically (past chapters flow back into the system prompt).
- Let the author polish every chapter by hand before it becomes part of the history.
- Stay tiny: one page, one API route, one hook.

## Non-goals

- No multiple-novel support (one novel per browser, in `localStorage`).
- No user accounts, sharing, or publishing.
- No cloud persistence. If the browser's localStorage is cleared, the novel is lost. The author is expected to copy finished text out when they want durable storage.
- No automatic summarization. Past chapters are appended verbatim.
- No rich-text formatting, outline view, character tracker, or other "writing app" features beyond the three prompt zones.

## Users & scenarios

The author opens the app, writes a world bible in the Story Context box, then iterates per chapter:

1. Write a brief for the current chapter in the Chapter Prompt box.
2. Click **Generate**. Output streams into the editable output area.
3. Edit the output until it reads well.
4. Click **Send to Chapter History**. The chapter joins the sidebar list, and the workspace resets for the next chapter.
5. Repeat. When re-opening a past chapter from the sidebar, the draft slot loads that chapter's title, prompt, and content for further editing. Saving updates it in place.

## Architecture

### Tech stack

- **Next.js 15** (App Router) with TypeScript.
- **Tailwind CSS** for styling. No component library.
- **Vercel `ai` SDK** (`ai`) + **`@ai-sdk/openai-compatible`** for server-side streaming to OpenRouter.
- **Zod** for request-body validation.
- **Vitest** for the small lib-level test suite.

No database, no ORM, no auth.

### File layout

```
novel-generate/
├── .env.local                        # OPENROUTER_API_KEY=sk-or-v1-...
├── .env.example                      # documents required env vars
├── app/
│   ├── page.tsx                      # the whole SPA
│   ├── layout.tsx                    # root html wrapper
│   ├── globals.css                   # tailwind import + resets
│   └── api/
│       └── generate/
│           └── route.ts              # the only backend route — OpenRouter proxy + streaming
├── components/
│   ├── ChapterSidebar.tsx            # left column: chapter list + New + Settings
│   ├── StoryContextEditor.tsx        # large textarea (world bible)
│   ├── ChapterWorkspace.tsx          # prompt box + output box + buttons
│   ├── SettingsDrawer.tsx            # model dropdown + temperature slider
│   └── ui/                           # small shared bits (Button, Textarea)
├── lib/
│   ├── store.ts                      # useNovel() hook — localStorage-backed state
│   ├── prompt.ts                     # buildMessages(novel) — assembles messages
│   ├── types.ts                      # Novel, Chapter, Settings types
│   └── stream.ts                     # rAF-buffered stream reader
├── lib/__tests__/
│   ├── prompt.test.ts
│   └── store.test.ts
└── package.json
```

### Runtime flow

1. User types into Story Context + Chapter Prompt. `useNovel()` debounces writes to `localStorage` (300 ms).
2. Clicking **Generate** calls `buildMessages(novel)` and POSTs to `/api/generate` with `{ model, temperature, messages }`.
3. The route validates with Zod, forwards to OpenRouter via `streamText`, and returns a plain text stream.
4. The client reads the stream with a `ReadableStreamDefaultReader`, buffers decoded chunks in a `useRef`, and flushes the buffer into React state once per animation frame (see *Render thrashing* below).
5. **Generate** is replaced by **Stop generating** while streaming. Clicking it calls `abortController.abort()`, which unwinds the fetch and flushes any remaining buffered text.
6. When the stream ends, the output textarea becomes fully editable.
7. **Send to Chapter History** promotes `draft` into `chapters[]` (or updates in place if `draft.chapterId` matches an existing one) and resets `draft`.

## Data model

All state lives under a single `localStorage` key: `novel-generate:v1`.

```ts
// lib/types.ts

export type Chapter = {
  id: string;              // uuid, assigned on create
  title: string;           // e.g. "Chapter 1 · The arrival"
  prompt: string;          // the brief that produced this chapter
  content: string;         // the edited, approved text
  createdAt: number;       // unix ms
};

export type Settings = {
  model: string;           // e.g. "anthropic/claude-3.5-sonnet"
  temperature: number;     // 0.0 – 1.5, default 0.8
};

export type Draft = {
  chapterId: string | null;  // null = new chapter not yet saved
  title: string;
  prompt: string;
  output: string;            // current editor contents (unsaved)
};

export type Novel = {
  storyContext: string;
  chapters: Chapter[];
  draft: Draft;
  settings: Settings;
};
```

### Rules

- The app holds exactly one `Novel`.
- `draft` is the in-progress chapter. Saving promotes it to `chapters[]` (append if new, replace if re-editing) and resets `draft` to empty.
- Clicking a sidebar chapter loads that chapter into `draft` for re-editing. Saving updates in place. No warning about "downstream chapters were generated on the older version" — that is deliberately out of scope.
- A single `useNovel()` hook exposes `novel` and a typed `update(fn)` function. Internally it debounces `localStorage.setItem` by 300 ms.
- On first load, if nothing is stored, initialize with empty strings, an empty chapters array, and a default model of `anthropic/claude-3.5-sonnet` (editable in the settings drawer).

## Prompt assembly

`lib/prompt.ts` builds the message array that ships to OpenRouter:

```ts
export function buildMessages(novel: Novel): Message[] {
  const pastChapters = novel.chapters
    .map(c => `[${c.title}]\n${c.content}`)
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
    { role: "user",   content: user   },
  ];
}
```

Past chapters are appended in order, verbatim. Over a 10-chapter run this stays comfortably within a modern model's context window.

## UI layout

Single screen, two columns.

```
┌───────────────┬───────────────────────────────────────────────┐
│  Chapters     │  Story Context (world bible)                  │
│  ─────────    │  ┌───────────────────────────────────────┐    │
│  Ch 1 · ...   │  │ textarea — large, ~8 rows             │    │
│  Ch 2 · ...   │  │                                       │    │
│  Ch 3 · ...   │  └───────────────────────────────────────┘    │
│  ▸ Draft      │                                               │
│               │  Chapter Prompt                               │
│  + New        │  ┌───────────────────────────────────────┐    │
│               │  │ textarea — medium, ~4 rows            │    │
│  ⚙ Settings   │  └───────────────────────────────────────┘    │
│               │       [ Generate ▸ ]  (→ Stop during stream) │
│               │                                               │
│               │  Output (editable)                            │
│               │  ┌───────────────────────────────────────┐    │
│               │  │ textarea — large, grows, streams in   │    │
│               │  │                                       │    │
│               │  └───────────────────────────────────────┘    │
│               │  [ Send to Chapter History ] [ Discard ]      │
└───────────────┴───────────────────────────────────────────────┘
```

### Components

- **`<ChapterSidebar>`** — fixed-width (~220px) left column. Lists `novel.chapters[]`; each row shows the title and a 2-line content preview. Clicking a row loads that chapter into `draft` and highlights it. Below the list: `+ New chapter` (clears draft after confirming if it's dirty), and a `⚙ Settings` button.
- **`<StoryContextEditor>`** — labeled textarea bound to `novel.storyContext`. Word-count hint below right (helpful because this text is sent in every prompt).
- **`<ChapterWorkspace>`** — holds: title input, prompt textarea, Generate / Stop button, output textarea, `Send to Chapter History` / `Discard` buttons.
  - Generate is disabled when both story context and draft prompt are empty (tooltip: "Write some guidance first"). It is replaced by **Stop generating** while streaming. Clicking Stop aborts the fetch.
  - Output becomes editable once streaming ends.
  - Send: append new chapter, or update existing one if `draft.chapterId` is set. Reset `draft` afterwards.
  - Discard: confirm-dialog → clear `draft`.
- **`<SettingsDrawer>`** — right-side slide-in panel.
  - Model dropdown. The preset list lives as a `const` array at the top of `SettingsDrawer.tsx` — five entries, easy to edit: `anthropic/claude-3.5-sonnet`, `anthropic/claude-3.7-sonnet`, `openai/gpt-4o`, `google/gemini-2.0-flash`, `meta-llama/llama-3.3-70b-instruct`.
  - Temperature slider (0–1.5, step 0.1, default 0.8) with current value shown.
  - A small reminder: "API key lives in `.env.local` on the server."
  - At the very bottom, separated by a divider: a red **Start New Novel (Clear All Data)** button. Clicking it opens a confirm dialog (`"This deletes your story context, all saved chapters, and the current draft. This cannot be undone. Continue?"`). On confirm, the app removes the `novel-generate:v1` key from `localStorage` and re-initializes to the empty default. This exists so the author can start a new project without opening devtools.

### Visual style

Dark theme by default (easier on the eyes for long writing). Generous line height in textareas. A serif font for the output textarea for a "novel" feel. The Tailwind config stays at defaults — no custom plugins.

## API route

`app/api/generate/route.ts`:

```ts
import { streamText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";

const openrouter = createOpenAICompatible({
  name: "openrouter",
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY!,
});

const Body = z.object({
  model: z.string().min(1),
  temperature: z.number().min(0).max(2),
  messages: z.array(z.object({
    role: z.enum(["system", "user", "assistant"]),
    content: z.string(),
  })),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return new Response("Bad request body", { status: 400 });
  }
  const { model, temperature, messages } = parsed.data;

  const result = streamText({
    model: openrouter(model),
    temperature,
    messages,
  });

  return result.toTextStreamResponse();
}
```

`OPENROUTER_API_KEY` is required; if unset, the request fails immediately. This is a fail-fast design — we do not fall back to a client-side key.

## Streaming on the client

To avoid render thrashing from high-frequency chunk arrivals, `lib/stream.ts` exposes a helper:

```ts
export async function readBufferedStream(
  body: ReadableStream<Uint8Array>,
  onFlush: (text: string) => void,
  signal: AbortSignal,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let scheduled = false;

  const flush = () => {
    scheduled = false;
    if (buffer.length === 0) return;
    const chunk = buffer;
    buffer = "";
    onFlush(chunk);
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(flush);
      }
    }
  } finally {
    // one last flush for any trailing bytes
    flush();
    reader.releaseLock();
  }
}
```

In `ChapterWorkspace`, `onFlush(chunk)` appends to `draft.output` via `useNovel().update`. This caps re-renders at roughly one per animation frame (~60/sec) regardless of chunk rate.

If manual testing shows the UI feels fine without buffering, the helper can be simplified to a direct loop. The buffered version is the default because it is cheap insurance.

## Error handling

Per global rules: never swallow errors.

- **Server: missing API key** → 500 with body `"OPENROUTER_API_KEY is not set"`. Surfaces in the UI as a red banner above the output area.
- **Server: Zod parse failure** → 400 with body `"Bad request body"`. Should not happen under normal UI flow; still surfaced as a banner if it does.
- **Server: OpenRouter 401 / 402 / 429 / 5xx** → the `ai` SDK throws; we let the error reach the stream consumer. The client surfaces the error text in a banner and re-enables Generate.
- **Client: `AbortError`** from user-initiated stop → silently flush any buffered text and leave the Generate button enabled. No banner.
- **Client: network failure mid-stream** → banner with the error message; the partial text stays in the output textarea so nothing is lost.
- **Client: empty story context + empty prompt** → Generate disabled with tooltip, no request made.

No empty `catch {}` blocks anywhere. Every caught error either updates the error banner state or re-throws.

## Testing

Minimal, targeted tests — we get more value from running the app locally for UI work.

- **`lib/__tests__/prompt.test.ts`** (Vitest):
  - First chapter: past-chapters section equals `"(none yet — this is the first chapter)"`.
  - Multiple chapters: correct order, each labeled with its title.
  - Empty story context: still produces a well-formed system message.
- **`lib/__tests__/store.test.ts`** (Vitest with `jsdom` environment):
  - Roundtrip: write a novel, read it back, shape matches.
  - Missing key: `useNovel()` initializes to the empty default without throwing.

No component or end-to-end tests in this iteration. UI correctness is verified manually in a dev server before any task is marked complete.

## Out of scope (documented so nobody re-raises them)

- Multiple novels in one browser.
- Exporting to markdown / DOCX / EPUB.
- Per-chapter summarization to shrink context.
- Warning when re-editing an old chapter about downstream dependents.
- Collaborative editing.
- Automatic title generation.
- Undo/redo beyond the browser's native textarea undo.

Each of these could be added later without re-architecting the core; none is worth the complexity for v1.
