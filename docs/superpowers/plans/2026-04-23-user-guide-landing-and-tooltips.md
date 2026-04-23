# User Guide (Landing Page + Inline Tooltips) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a first-visit landing page plus inline `?` popovers next to the controls that confused the owner during the first dogfooding session, and switch the default model to Gemini 3 Flash.

**Architecture:** Two small, focused new components (`HelpPopover`, `LandingPage`) plus minimal edits to `app/page.tsx`, the sidebar, and three existing form components. `localStorage` gates whether the landing page shows on load. No data-shape changes, no backend changes.

**Tech Stack:** Next.js 15 (app router, `"use client"`), React 19, TypeScript, Tailwind, Vitest + React Testing Library + jsdom. Existing codebase patterns: client components with `"use client"` at the top; tests in `lib/__tests__/`; reusable UI primitives in `components/ui/`.

**Spec:** `docs/superpowers/specs/2026-04-23-user-guide-landing-and-tooltips-design.md`

---

## File Structure

**New files:**
- `components/ui/HelpPopover.tsx` — `?` icon button + click-to-toggle popover. One responsibility: render a disclosure control with arbitrary help content. No knowledge of what's being explained.
- `components/LandingPage.tsx` — Full-screen welcome/about view. Static content + a single CTA callback.
- `lib/__tests__/HelpPopover.test.tsx` — Behavior tests (toggle, outside click, Esc).
- `lib/__tests__/LandingPage.test.tsx` — Content and CTA tests.

**Modified files:**
- `app/page.tsx` — Add a `showLanding` state gated by `localStorage`; render `<LandingPage />` or the main app.
- `components/ChapterSidebar.tsx` — Add a new `onOpenHelp` prop and a Help button above the existing Settings button.
- `components/SettingsDrawer.tsx` — Attach `HelpPopover` to 7 controls (Model, Temperature, Output language, Target chapter length, and the three Export/Import buttons).
- `components/StoryContextEditor.tsx` — Attach `HelpPopover` next to the "Story Context" heading.
- `components/ChapterWorkspace.tsx` — Add a small heading to the editor section and attach `HelpPopover` there.
- `lib/types.ts` — Change the default `model` in `DEFAULT_NOVEL`.
- `lib/__tests__/ChapterSidebar.test.tsx` — Pass the new `onOpenHelp` prop in the shared `renderSidebar` helper; add a test for the Help button.

**Commands you will run a lot:**
- `npm run test -- <pattern>` — run specific test files
- `npm run test` — full test suite (must be green before each commit)
- `npm run typecheck` — required before each commit
- `npm run dev` — manual browser test (http://localhost:3000)

---

## Task 1: `HelpPopover` component (TDD)

**Files:**
- Create: `components/ui/HelpPopover.tsx`
- Create: `lib/__tests__/HelpPopover.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/HelpPopover.test.tsx` with:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HelpPopover } from "@/components/ui/HelpPopover";

describe("HelpPopover", () => {
  it("renders a ? trigger button with accessible label", () => {
    render(<HelpPopover>Some help content</HelpPopover>);
    const trigger = screen.getByRole("button", { name: /help/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger.textContent).toContain("?");
  });

  it("does not show content until the trigger is clicked", () => {
    render(<HelpPopover>Some help content</HelpPopover>);
    expect(screen.queryByText("Some help content")).toBeNull();
  });

  it("shows content when the trigger is clicked", () => {
    render(<HelpPopover>Some help content</HelpPopover>);
    fireEvent.click(screen.getByRole("button", { name: /help/i }));
    expect(screen.getByText("Some help content")).toBeInTheDocument();
  });

  it("toggles closed when the trigger is clicked a second time", () => {
    render(<HelpPopover>Some help content</HelpPopover>);
    const trigger = screen.getByRole("button", { name: /help/i });
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(screen.queryByText("Some help content")).toBeNull();
  });

  it("closes when clicking outside", () => {
    render(
      <div>
        <HelpPopover>Some help content</HelpPopover>
        <button>Outside</button>
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: /help/i }));
    expect(screen.getByText("Some help content")).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByText("Outside"));
    expect(screen.queryByText("Some help content")).toBeNull();
  });

  it("closes on Escape", () => {
    render(<HelpPopover>Some help content</HelpPopover>);
    fireEvent.click(screen.getByRole("button", { name: /help/i }));
    expect(screen.getByText("Some help content")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("Some help content")).toBeNull();
  });

  it("uses a custom ariaLabel when provided", () => {
    render(<HelpPopover ariaLabel="More about models">Content</HelpPopover>);
    expect(
      screen.getByRole("button", { name: "More about models" }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- HelpPopover`
Expected: FAIL — "Cannot find module '@/components/ui/HelpPopover'" (or similar).

- [ ] **Step 3: Write the implementation**

Create `components/ui/HelpPopover.tsx`:

```tsx
"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  ariaLabel?: string;
};

export function HelpPopover({ children, ariaLabel = "Help" }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <span ref={containerRef} className="relative inline-block align-middle">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-zinc-600 text-[10px] leading-none text-zinc-400 hover:text-zinc-100 hover:border-zinc-400"
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-0 top-full mt-1 w-72 max-w-[18rem] rounded border border-zinc-700 bg-zinc-800 p-3 text-xs text-zinc-200 shadow-lg z-30 whitespace-pre-line"
        >
          {children}
        </span>
      )}
    </span>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- HelpPopover`
Expected: PASS (all 7 tests).

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/ui/HelpPopover.tsx lib/__tests__/HelpPopover.test.tsx
git commit -m "feat: add HelpPopover component for inline ? tooltips"
```

---

## Task 2: `LandingPage` component (TDD)

**Files:**
- Create: `components/LandingPage.tsx`
- Create: `lib/__tests__/LandingPage.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/LandingPage.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LandingPage } from "@/components/LandingPage";

describe("LandingPage", () => {
  it("renders the site title", () => {
    render(<LandingPage onStart={() => {}} />);
    expect(screen.getByText(/Novel_generate/)).toBeInTheDocument();
  });

  it("renders the three content sections", () => {
    render(<LandingPage onStart={() => {}} />);
    expect(screen.getByText(/เว็บนี้ทำอะไร/)).toBeInTheDocument();
    expect(screen.getByText(/เกี่ยวกับ AI/)).toBeInTheDocument();
    expect(screen.getByText(/วิธีใช้แบบย่อ/)).toBeInTheDocument();
  });

  it("shows 'เริ่มเขียนนิยาย' CTA by default (first visit)", () => {
    render(<LandingPage onStart={() => {}} />);
    expect(
      screen.getByRole("button", { name: /เริ่มเขียนนิยาย/ }),
    ).toBeInTheDocument();
  });

  it("shows 'กลับไปเขียน' CTA when returning=true", () => {
    render(<LandingPage onStart={() => {}} returning />);
    expect(
      screen.getByRole("button", { name: /กลับไปเขียน/ }),
    ).toBeInTheDocument();
  });

  it("calls onStart when CTA is clicked", () => {
    const onStart = vi.fn();
    render(<LandingPage onStart={onStart} />);
    fireEvent.click(screen.getByRole("button", { name: /เริ่มเขียนนิยาย/ }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- LandingPage`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `components/LandingPage.tsx`:

```tsx
"use client";
import { Button } from "./ui/Button";

type Props = {
  onStart: () => void;
  returning?: boolean;
};

export function LandingPage({ onStart, returning = false }: Props) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-zinc-950">
      <div className="w-full max-w-xl space-y-6">
        <header className="text-center space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Novel_generate</h1>
          <p className="text-sm text-zinc-400">เว็บช่วยเขียนนิยายด้วย AI</p>
        </header>

        <hr className="border-zinc-800" />

        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            เว็บนี้ทำอะไร
          </h2>
          <p className="text-sm leading-relaxed text-zinc-200">
            Novel_generate คือเครื่องมือช่วยนักเขียนร่างและพัฒนานิยาย โดยใช้ AI สร้างเนื้อหาจากบริบทของเรื่องที่คุณสร้างขึ้น — ตัวละคร, โลก, โครงเรื่อง, และบทก่อนหน้า — เพื่อช่วยให้เขียนต่อได้ต่อเนื่องและสอดคล้องกับแนวเรื่อง
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            เกี่ยวกับ AI
          </h2>
          <p className="text-sm leading-relaxed text-zinc-200">
            AI ในเว็บนี้ทำงานโดยคำนวณคำที่ <em>น่าจะเป็น</em> ถัดไปจากรูปแบบภาษาที่เคยเห็น ไม่ใช่การ &quot;คิด&quot; หรือ &quot;เข้าใจ&quot; เนื้อเรื่องอย่างแท้จริง ผลลัพธ์เป็นเพียงเครื่องมือช่วยร่าง — ไม่สามารถทดแทนงานที่มีความเป็นเอกลักษณ์ของผู้เขียนได้ อารมณ์ สไตล์การเขียน มุมมองส่วนตัว และอื่น ๆ ยังคงเป็นสิ่งที่ AI ไม่มี แนะนำให้ใช้เป็นจุดเริ่มต้นแล้วเรียบเรียงด้วยตัวเองเสมอ
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            วิธีใช้แบบย่อ
          </h2>
          <ul className="text-sm leading-relaxed text-zinc-200 list-disc pl-5 space-y-1">
            <li>กรอก <strong>Story Context</strong> — ตัวละคร โลก แนวเรื่อง (ยิ่งละเอียด AI ยิ่งช่วยได้ตรง)</li>
            <li>สร้างตอนใหม่ ใส่ชื่อตอนและโครงสั้น ๆ</li>
            <li>กด <strong>Generate</strong> → AI ร่างตอนให้ตามบริบท</li>
            <li>แก้ไข/เรียบเรียงได้เสมอ และอย่าลืม <strong>Export backup</strong> เป็นระยะ</li>
          </ul>
        </section>

        <hr className="border-zinc-800" />

        <div className="flex justify-center pt-2">
          <Button onClick={onStart} className="px-6 py-2 text-base">
            {returning ? "กลับไปเขียน" : "เริ่มเขียนนิยาย"}
          </Button>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- LandingPage`
Expected: PASS (all 5 tests).

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/LandingPage.tsx lib/__tests__/LandingPage.test.tsx
git commit -m "feat: add LandingPage welcome/about component"
```

---

## Task 3: Add Help button to `ChapterSidebar` (TDD)

**Files:**
- Modify: `components/ChapterSidebar.tsx`
- Modify: `lib/__tests__/ChapterSidebar.test.tsx`

- [ ] **Step 1: Update the existing test helper and add a Help button test**

Open `lib/__tests__/ChapterSidebar.test.tsx`. At the top of the file, change `renderSidebar` to pass a new `onOpenHelp` prop (add it to the spread defaults):

```tsx
function renderSidebar(
  overrides: Partial<Parameters<typeof ChapterSidebar>[0]> = {},
) {
  return render(
    <ChapterSidebar
      viewingId={null}
      onView={noop}
      draftActive={false}
      onStartDraft={noop}
      onOpenSettings={noop}
      onOpenHelp={noop}
      {...overrides}
    />,
    { wrapper },
  );
}
```

Then add a new `describe` block at the bottom of the file:

```tsx
describe("ChapterSidebar Help button", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders a Help button", async () => {
    renderSidebar();
    expect(
      await screen.findByRole("button", { name: /help/i }),
    ).toBeInTheDocument();
  });

  it("calls onOpenHelp when the Help button is clicked", async () => {
    let called = 0;
    renderSidebar({ onOpenHelp: () => { called++; } });
    const helpBtn = await screen.findByRole("button", { name: /help/i });
    helpBtn.click();
    expect(called).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify the new tests fail**

Run: `npm run test -- ChapterSidebar`
Expected: FAIL on the new tests — `onOpenHelp` is not a valid prop; no Help button renders.

Note: Typecheck will also fail (`onOpenHelp` isn't in the `Props` yet). That's expected — we're about to add it.

- [ ] **Step 3: Add the `onOpenHelp` prop and the Help button to `ChapterSidebar`**

In `components/ChapterSidebar.tsx`:

Update the `Props` type to include `onOpenHelp`:

```tsx
type Props = {
  viewingId: string | null;
  onView: (id: string | null) => void;
  draftActive: boolean;
  onStartDraft: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
};
```

Update the function signature:

```tsx
export function ChapterSidebar({ viewingId, onView, draftActive, onStartDraft, onOpenSettings, onOpenHelp }: Props) {
```

In the bottom action area (the `<div className="p-3 space-y-2 border-t border-zinc-800">` block at the end of the sidebar), add a Help button **immediately above** the Settings button. The final order inside that div should be: total spent (existing), `+ New chapter` (existing), `Help` (new), `⚙ Settings` (existing):

```tsx
<Button variant="ghost" className="w-full" onClick={onOpenHelp}>? Help</Button>
<Button variant="ghost" className="w-full" onClick={onOpenSettings}>⚙ Settings</Button>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- ChapterSidebar`
Expected: PASS (all existing tests + the two new Help-button tests).

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: no errors. (If `app/page.tsx` complains about a missing `onOpenHelp` prop, stop here — that will be fixed in Task 4. Just re-run typecheck after Task 4.)

If typecheck does fail on `app/page.tsx`, proceed to Task 4 before committing. Otherwise commit now.

- [ ] **Step 6: Commit**

```bash
git add components/ChapterSidebar.tsx lib/__tests__/ChapterSidebar.test.tsx
git commit -m "feat: add Help button to sidebar"
```

(If you had to do Task 4 first because of typecheck, combine them into a single commit.)

---

## Task 4: Wire `LandingPage` into `app/page.tsx`

**Files:**
- Modify: `app/page.tsx`

There is no automated test for `app/page.tsx` (it's a thin composition layer; the underlying components are tested individually). This task is verified by typecheck + manual browser testing.

- [ ] **Step 1: Replace `app/page.tsx` with the wired version**

Open `app/page.tsx`. It currently looks like:

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
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [draftActive, setDraftActive] = useState(false);
  return (
    <NovelProvider>
      <ReviewProvider>
        <div className="flex min-h-screen">
          <ChapterSidebar
            viewingId={viewingId}
            onView={setViewingId}
            draftActive={draftActive}
            onStartDraft={() => setDraftActive(true)}
            onOpenSettings={() => setSettingsOpen(true)}
          />
          <main className="flex-1 p-6 max-w-3xl space-y-8">
            <StoryContextEditor />
            <ChapterWorkspace
              viewingId={viewingId}
              onClearView={() => setViewingId(null)}
              draftActive={draftActive}
              onEndDraft={() => setDraftActive(false)}
            />
          </main>
          <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </div>
      </ReviewProvider>
    </NovelProvider>
  );
}
```

Replace the whole file with:

```tsx
"use client";
import { useState } from "react";
import { NovelProvider } from "@/lib/store";
import { ReviewProvider } from "@/lib/review";
import { ChapterSidebar } from "@/components/ChapterSidebar";
import { StoryContextEditor } from "@/components/StoryContextEditor";
import { ChapterWorkspace } from "@/components/ChapterWorkspace";
import { SettingsDrawer } from "@/components/SettingsDrawer";
import { LandingPage } from "@/components/LandingPage";

const SEEN_LANDING_KEY = "novel-generate:seen-landing";

export default function Page() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [draftActive, setDraftActive] = useState(false);
  const [showLanding, setShowLanding] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return !window.localStorage.getItem(SEEN_LANDING_KEY);
  });

  if (showLanding) {
    const firstVisit =
      typeof window !== "undefined" &&
      !window.localStorage.getItem(SEEN_LANDING_KEY);
    return (
      <LandingPage
        returning={!firstVisit}
        onStart={() => {
          if (typeof window !== "undefined") {
            window.localStorage.setItem(SEEN_LANDING_KEY, "1");
          }
          setShowLanding(false);
        }}
      />
    );
  }

  return (
    <NovelProvider>
      <ReviewProvider>
        <div className="flex min-h-screen">
          <ChapterSidebar
            viewingId={viewingId}
            onView={setViewingId}
            draftActive={draftActive}
            onStartDraft={() => setDraftActive(true)}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenHelp={() => setShowLanding(true)}
          />
          <main className="flex-1 p-6 max-w-3xl space-y-8">
            <StoryContextEditor />
            <ChapterWorkspace
              viewingId={viewingId}
              onClearView={() => setViewingId(null)}
              draftActive={draftActive}
              onEndDraft={() => setDraftActive(false)}
            />
          </main>
          <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </div>
      </ReviewProvider>
    </NovelProvider>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Run the full test suite**

Run: `npm run test`
Expected: all green.

- [ ] **Step 4: Manual browser smoke test**

Run: `npm run dev` in one terminal. Open http://localhost:3000.

Then in another terminal, run:
```bash
# clear localStorage before testing the first-visit flow — do this in the browser devtools:
# DevTools → Application → Local Storage → right-click your origin → Clear
```

Verify in browser:
- First visit (localStorage empty): Landing page shows with "เริ่มเขียนนิยาย" button.
- Click the button: main app renders. `novel-generate:seen-landing` is set to `"1"` in localStorage.
- Reload the page: main app renders directly (no landing).
- Click the Help button in the sidebar: landing page shows again with "กลับไปเขียน" button.
- Click "กลับไปเขียน": main app renders. localStorage value unchanged.

Stop the dev server (Ctrl+C) when done.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "feat: show landing page on first visit + wire sidebar Help"
```

(If Task 3 was deferred because of typecheck coupling, combine into one commit.)

---

## Task 5: Apply `HelpPopover` to `SettingsDrawer`

**Files:**
- Modify: `components/SettingsDrawer.tsx`

No new tests for this task — the component already exists, and adding help text is a content change, not a behavior change. Verify by typecheck + manual browser test.

- [ ] **Step 1: Add the import**

At the top of `components/SettingsDrawer.tsx`, alongside the other imports, add:

```tsx
import { HelpPopover } from "./ui/HelpPopover";
```

- [ ] **Step 2: Wrap each control's label with a `HelpPopover`**

In the same file, modify the labels/buttons as listed below. The existing JSX stays; only the label line (or button) changes.

**(a) Model label** (currently: `<label className="block text-xs uppercase text-zinc-400 mb-1">Model</label>`)

Replace with:

```tsx
<label className="block text-xs uppercase text-zinc-400 mb-1">
  Model
  <HelpPopover ariaLabel="Help: Model">
    เลือก AI ที่จะใช้ Generate:
    {"\n"}• Claude Sonnet 4.6 — สมดุลคุณภาพ/ความเร็ว/ค่าใช้จ่าย เหมาะกับงานประจำ
    {"\n"}• Claude Opus 4.7 — คุณภาพสูงสุด เข้าใจบริบทซับซ้อน ช้า+แพงกว่า เหมาะกับตอนสำคัญ
    {"\n"}• GPT-5.4 — สมดุลคุณภาพ/ความเร็ว เหมาะกับงานทั่วไป
    {"\n"}• Gemini 3 Flash — เร็ว ประหยัด เหมาะกับทดลอง/ร่างไว ๆ
    {"\n"}• Gemini 3.1 Pro — คุณภาพสูง รองรับ context ยาวมาก เหมาะกับนิยายที่บริบทเยอะ
    {"\n\n"}คำแนะนำเป็นค่าเริ่มต้น — ลองเองแล้วเลือกที่ถูกใจที่สุด
  </HelpPopover>
</label>
```

**(b) Temperature label** (currently: `<label className="block text-xs uppercase text-zinc-400 mb-1">Temperature · {novel.settings.temperature.toFixed(1)}</label>`)

Replace with:

```tsx
<label className="block text-xs uppercase text-zinc-400 mb-1">
  Temperature · {novel.settings.temperature.toFixed(1)}
  <HelpPopover ariaLabel="Help: Temperature">
    ควบคุมความหลากหลายของคำที่ AI เลือกใช้
    {"\n"}• 0-0.5 (ต่ำ): คาดเดาได้ คำคุ้นเคย
    {"\n"}• 0.6-0.9 (กลาง): สมดุล สร้างสรรค์+สอดคล้อง
    {"\n"}• 1.0-1.5 (สูง): สร้างสรรค์ แปลกใหม่ แต่เสี่ยงหลุดเรื่อง
    {"\n\n"}แนะนำเริ่มที่ 0.7-0.8
  </HelpPopover>
</label>
```

**(c) Output language label**

Replace with:

```tsx
<label className="block text-xs uppercase text-zinc-400 mb-1">
  Output language
  <HelpPopover ariaLabel="Help: Output language">
    ภาษาที่ AI จะใช้เขียน เปลี่ยนได้ตลอด ไม่จำเป็นต้องตรงกับภาษาที่ใช้ใน Story Context
  </HelpPopover>
</label>
```

**(d) Target chapter length label**

Replace with:

```tsx
<label className="block text-xs uppercase text-zinc-400 mb-1">
  Target chapter length · {novel.settings.targetWords} words
  <HelpPopover ariaLabel="Help: Target chapter length">
    ความยาวโดยประมาณของแต่ละตอน (คำ) AI จะพยายามทำตาม แต่ไม่ตรงเป๊ะเสมอไป
  </HelpPopover>
</label>
```

**(e) Export/Import buttons**

The Export .md and Export backup buttons are in a `grid grid-cols-2 gap-2` div. The Import backup button follows. Wrap each button in a flex container with the popover on the right. Replace:

```tsx
<div className="grid grid-cols-2 gap-2">
  <Button variant="secondary" onClick={handleExportMd}>
    Export as .md
  </Button>
  <Button variant="secondary" onClick={handleExportJson}>
    Export backup
  </Button>
</div>
<Button variant="secondary" className="w-full" onClick={handleImportClick}>
  Import backup
</Button>
```

with:

```tsx
<div className="grid grid-cols-2 gap-2">
  <div className="flex items-center">
    <Button variant="secondary" onClick={handleExportMd} className="flex-1">
      Export as .md
    </Button>
    <HelpPopover ariaLabel="Help: Export as .md">
      ดาวน์โหลดเนื้อหานิยาย (Story Context + ทุกตอน) เป็นไฟล์ Markdown อ่านได้ในโปรแกรมทั่วไป (Obsidian, VSCode, Notion) เหมาะกับการส่งออกไปใช้ที่อื่น
    </HelpPopover>
  </div>
  <div className="flex items-center">
    <Button variant="secondary" onClick={handleExportJson} className="flex-1">
      Export backup
    </Button>
    <HelpPopover ariaLabel="Help: Export backup">
      ดาวน์โหลดข้อมูลทั้งหมดเป็นไฟล์ JSON สำหรับสำรองข้อมูล นำเข้ากลับมาได้ภายหลัง — แนะนำสำรองเป็นระยะ นิยายของคุณสำคัญ
    </HelpPopover>
  </div>
</div>
<div className="flex items-center">
  <Button variant="secondary" className="flex-1" onClick={handleImportClick}>
    Import backup
  </Button>
  <HelpPopover ariaLabel="Help: Import backup">
    นำเข้าไฟล์ JSON ที่เคย Export backup ไว้ คำเตือน: จะเขียนทับข้อมูลปัจจุบันทั้งหมด — ควร Export backup ของเดิมก่อนทุกครั้ง
  </HelpPopover>
</div>
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Run the test suite**

Run: `npm run test`
Expected: all green (no existing test should break).

- [ ] **Step 5: Manual browser verification**

Run `npm run dev`, open the app, open Settings drawer.
- Click each `?` icon (Model, Temperature, Output language, Target chapter length, Export .md, Export backup, Import backup) — 7 total.
- Verify each popover opens with the right content, closes on click-outside and Esc, and doesn't overflow the drawer in a broken way. (It's OK if a popover extends slightly past the drawer — desktop-first.)

- [ ] **Step 6: Commit**

```bash
git add components/SettingsDrawer.tsx
git commit -m "feat: add ? tooltips to Settings controls and Export/Import buttons"
```

---

## Task 6: Apply `HelpPopover` to `StoryContextEditor`

**Files:**
- Modify: `components/StoryContextEditor.tsx`

- [ ] **Step 1: Add the import**

At the top, alongside the other imports:

```tsx
import { HelpPopover } from "./ui/HelpPopover";
```

- [ ] **Step 2: Attach the popover to the heading**

Find:

```tsx
<h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
  Story Context
</h2>
```

Replace with:

```tsx
<h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
  Story Context
  <HelpPopover ariaLabel="Help: Story Context">
    บริบทของนิยายที่ AI จะใช้อ้างอิงในทุก Generate — ตัวละคร โลก พล็อต สไตล์การเขียน ยิ่งละเอียด AI ยิ่งช่วยได้ตรงแนว
  </HelpPopover>
</h2>
```

- [ ] **Step 3: Run typecheck and tests**

Run: `npm run typecheck && npm run test`
Expected: all green.

- [ ] **Step 4: Manual verification**

`npm run dev`. Confirm the `?` icon renders next to "Story Context", popover opens/closes correctly.

- [ ] **Step 5: Commit**

```bash
git add components/StoryContextEditor.tsx
git commit -m "feat: add ? tooltip to Story Context heading"
```

---

## Task 7: Apply `HelpPopover` to `ChapterWorkspace` editor section

**Files:**
- Modify: `components/ChapterWorkspace.tsx`

The editor section currently has no top-level heading — it starts directly with the "Chapter title" label. Add a small heading so there's an anchor for the tooltip.

- [ ] **Step 1: Add the import**

At the top, alongside the other imports:

```tsx
import { HelpPopover } from "./ui/HelpPopover";
```

- [ ] **Step 2: Add a heading with the popover at the top of `editorSection`**

Find the start of `editorSection`:

```tsx
const editorSection = (
  <div className={reviewing ? "pointer-events-none opacity-50" : ""}>
    <div className="space-y-2">
      <label className="text-xs uppercase text-zinc-400">Chapter title</label>
```

Replace the top of the div (before the first `<div className="space-y-2">`) with a heading + the popover:

```tsx
const editorSection = (
  <div className={reviewing ? "pointer-events-none opacity-50" : ""}>
    <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 mb-3">
      Chapter draft
      <HelpPopover ariaLabel="Help: Chapter draft">
        พื้นที่สร้างตอน: ใส่ชื่อตอน, โครงสั้น ๆ ของเนื้อหา, แล้วกด Generate เพื่อให้ AI ร่างให้ แก้ไขได้เสมอก่อน save
      </HelpPopover>
    </h2>
    <div className="space-y-2">
      <label className="text-xs uppercase text-zinc-400">Chapter title</label>
```

(The rest of `editorSection` stays the same.)

- [ ] **Step 3: Run typecheck and tests**

Run: `npm run typecheck && npm run test`
Expected: all green.

- [ ] **Step 4: Manual verification**

`npm run dev`. Open the app (you should be in editor mode by default). Verify:
- "Chapter draft" heading renders at the top of the workspace with a `?` next to it.
- Popover opens with the right text and closes correctly.

- [ ] **Step 5: Commit**

```bash
git add components/ChapterWorkspace.tsx
git commit -m "feat: add Chapter draft heading and ? tooltip"
```

---

## Task 8: Change default model to Gemini 3 Flash

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Update `DEFAULT_NOVEL.settings.model`**

Open `lib/types.ts`. In `DEFAULT_NOVEL.settings`, change the `model` line from:

```ts
    model: "anthropic/claude-sonnet-4.6",
```

to:

```ts
    model: "google/gemini-3-flash-preview",
```

- [ ] **Step 2: Run the test suite**

Run: `npm run test`
Expected: all green.

If any test fails because it's asserting on the old default value (not just constructing test data), update that test. Based on a spec-time audit, `lib/__tests__/store.test.tsx` and `lib/__tests__/streamMeta.test.ts` reference `"anthropic/claude-sonnet-4.6"` but only as setup values — they don't assert the default. If this is still the case, no test changes are needed.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Manual verification**

`npm run dev`. In a fresh browser profile (or after clicking "Start New Novel (Clear All Data)" in Settings), open Settings and confirm the Model dropdown shows `google/gemini-3-flash-preview`.

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts
git commit -m "feat: default to Gemini 3 Flash for new novels"
```

---

## Task 9: Final QA pass

This task has no code changes — it verifies the whole feature works end-to-end.

- [ ] **Step 1: Full test suite**

Run: `npm run test`
Expected: all green.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: End-to-end manual test**

Start the dev server: `npm run dev`.

**First-visit flow:**
- DevTools → Application → Local Storage → clear the site's storage (including the novel data and `novel-generate:seen-landing`).
- Reload. Landing page renders with title, three sections, and "เริ่มเขียนนิยาย" button.
- Click it. Main app renders.
- Reload. Main app renders directly (no landing).

**Help button flow:**
- Click the Help button in the sidebar. Landing page renders with "กลับไปเขียน".
- Click it. Main app renders. No localStorage value changed.

**Tooltips:** Open each of the 9 popovers and confirm they show the right content, close on click-outside and Esc:
- Settings drawer: Model, Temperature, Output language, Target chapter length, Export as .md, Export backup, Import backup (7)
- Story Context heading (1)
- Chapter draft heading (1)

**Default model:** Click "Start New Novel (Clear All Data)". In Settings, Model should be `google/gemini-3-flash-preview`.

**Existing functionality sanity check:**
- Type some Story Context.
- Create a chapter (title + prompt) and generate with the default model.
- Export backup (JSON). Open the file — verify JSON is well-formed.
- Import backup (the file you just exported). Confirm the novel restores.
- Export as .md. Open the file — verify Markdown looks right.

- [ ] **Step 4: Stop the dev server (Ctrl+C).**

- [ ] **Step 5: Review your commits**

Run: `git log --oneline main..HEAD`
Expected: 7-8 small commits (one per task), each with a clear message.

- [ ] **Step 6: Done**

The feature is ready. Discuss next steps with the user — likely a pull request (manual, user-initiated per repo convention).
