# User Guide: Landing Page + Inline Tooltips — Design

**Date:** 2026-04-23
**Author:** wasuioi (with Claude)
**Origin:** First dogfooding session 2026-04-23 — user was confused about what the site does, what Temperature means, what Export/Import buttons do, and which AI to pick.

## Motivation

From the first dogfooding session, the user (owner) listed these pain points:

- **Confusion (งง):** What does this site do? Which AI is best? What is Temperature? What is Export .md / Export backup / Import backup?
- **Wants:** A site intro explaining what it does; a disclaimer that AI output is statistical prediction, not a replacement for a human writer; a usage guide; per-section explanations; guidance on which AI fits which task.

First impressions are where users decide if the tool is worth learning. Without any welcome or contextual help, even the owner found the UI confusing on first serious use.

## Goal

Make the site **understandable on first visit**, and **explain controls in-place** so users don't have to guess or read external docs.

Two pieces, shipped together:

- **A. Landing page** (first-visit welcome) — explains the site + AI disclaimer + quick how-to
- **B. Inline `?` tooltips** — short explanations next to controls users were confused about

## Non-Goals (explicitly out of scope)

Per "One Thing at a Time" in `CLAUDE.md`, these are tracked separately:

- Moving **Output language** from Settings drawer to near the output area (separate UX issue from the dogfooding list)
- Fixing the **AI-generates-its-own-chapter-title** bug (the AI ignores the user-provided title — separate bug fix)
- Building a guided walkthrough / onboarding tour (rejected in brainstorming; landing page is enough for now)
- Mobile-optimized popover layout (desktop-first; tooltips should degrade gracefully on mobile but mobile polish is not the goal)

---

## A. Landing Page

### Behavior

- On app mount, read `localStorage["novel-generate:seen-landing"]`.
  - If absent → show `<LandingPage />` instead of the main app.
  - If present (`"1"`) → show main app directly.
- Clicking the **Start** button on the landing page:
  1. Sets `localStorage["novel-generate:seen-landing"] = "1"`
  2. Switches the view to the main app.
- Clicking the **Help** button in the sidebar (see section A.3):
  - Shows the landing page again. Does NOT clear localStorage.
  - Landing page in this mode has a "กลับไปเขียน" ("Back to writing") button instead of "เริ่มเขียนนิยาย".

### A.1 Component: `components/LandingPage.tsx`

**Props:**

```ts
type Props = {
  onStart: () => void;       // Called when user clicks the primary CTA
  returning?: boolean;       // true when opened via sidebar Help (changes CTA label)
};
```

**Layout:**

- Full viewport, centered content column (max-width ~640px).
- Matches existing dark theme (`bg-zinc-950` or similar; reuse Tailwind classes from the rest of the app).
- No emojis in final copy unless we already use them elsewhere — keep plain text headings.
- Sections separated by horizontal rules or spacing; no icons required.

**Content:**

Heading:
- Title: `Novel_generate`
- Subtitle: `เว็บช่วยเขียนนิยายด้วย AI`

**Section 1 — เว็บนี้ทำอะไร:**

> Novel_generate คือเครื่องมือช่วยนักเขียนร่างและพัฒนานิยาย โดยใช้ AI สร้างเนื้อหาจากบริบทของเรื่องที่คุณสร้างขึ้น — ตัวละคร, โลก, โครงเรื่อง, และบทก่อนหน้า — เพื่อช่วยให้เขียนต่อได้ต่อเนื่องและสอดคล้องกับแนวเรื่อง

**Section 2 — เกี่ยวกับ AI:**

> AI ในเว็บนี้ทำงานโดยคำนวณคำที่ *น่าจะเป็น* ถัดไปจากรูปแบบภาษาที่เคยเห็น ไม่ใช่การ "คิด" หรือ "เข้าใจ" เนื้อเรื่องอย่างแท้จริง ผลลัพธ์เป็นเพียงเครื่องมือช่วยร่าง — ไม่สามารถทดแทนงานที่มีความเป็นเอกลักษณ์ของผู้เขียนได้ อารมณ์ สไตล์การเขียน มุมมองส่วนตัว และอื่น ๆ ยังคงเป็นสิ่งที่ AI ไม่มี แนะนำให้ใช้เป็นจุดเริ่มต้นแล้วเรียบเรียงด้วยตัวเองเสมอ

**Section 3 — วิธีใช้แบบย่อ:**

Bullet list:
- กรอก **Story Context** — ตัวละคร โลก แนวเรื่อง (ยิ่งละเอียด AI ยิ่งช่วยได้ตรง)
- สร้างตอนใหม่ ใส่ชื่อตอนและโครงสั้น ๆ
- กด **Generate** → AI ร่างตอนให้ตามบริบท
- แก้ไข/เรียบเรียงได้เสมอ และอย่าลืม **Export backup** เป็นระยะ

**CTA button:**

- `returning === false` (first visit): label `เริ่มเขียนนิยาย`
- `returning === true` (opened from sidebar Help): label `กลับไปเขียน`

On click: call `onStart()`.

### A.2 Wiring in `app/page.tsx`

Current `Page` renders the main layout unconditionally. Change it to:

```tsx
const [showLanding, setShowLanding] = useState<boolean>(() => {
  if (typeof window === "undefined") return false;
  return !localStorage.getItem("novel-generate:seen-landing");
});

if (showLanding) {
  const firstVisit = !localStorage.getItem("novel-generate:seen-landing");
  return (
    <LandingPage
      returning={!firstVisit}
      onStart={() => {
        localStorage.setItem("novel-generate:seen-landing", "1");
        setShowLanding(false);
      }}
    />
  );
}

// existing main layout, plus onOpenHelp prop passed to ChapterSidebar
```

Pass a new `onOpenHelp={() => setShowLanding(true)}` prop down to `ChapterSidebar`.

**SSR note:** The initial `useState` lazy initializer reads `localStorage`, which is client-only. `"use client"` is already declared at the top of `page.tsx`, so this is fine — but during the initial server render the function returns `false` (no landing). The client render will flip to `true` if the flag is absent. Since the whole page is a client component, this is acceptable; no hydration mismatch beyond what the app already does.

### A.3 Sidebar Help Button

In `components/ChapterSidebar.tsx`:

- Add a new prop `onOpenHelp: () => void`.
- Add a `Help` button in the sidebar's bottom action area, **immediately above** the existing `Settings` button (so the visual order from top-down is: ... → Help → Settings).
- Use the existing `Button` component with `variant="ghost"` (or whichever variant Settings uses) to match Settings's styling.
- Label: `Help` (keep consistent with existing `Settings` in English; the tooltip/landing content is in Thai).

---

## B. Inline `?` Tooltips

### B.1 Component: `components/ui/HelpPopover.tsx`

**Props:**

```ts
type Props = {
  children: React.ReactNode;   // Popover body content
  label?: string;              // Optional popover heading
  ariaLabel?: string;          // Defaults to "Help" — used on the trigger button
};
```

**Behavior:**

- Renders a small circular `?` icon button (~16-18px) inline after the label it annotates.
- Click the icon → toggle popover open/closed.
- Click outside the popover → close it.
- Press `Esc` while open → close it.
- Keyboard: trigger is a `<button>`, focusable, activates with Enter/Space.

**Styling:**

- Icon: subtle foreground color (e.g., `text-zinc-500 hover:text-zinc-300`), subtle border/background.
- Popover: absolutely positioned near the icon, `bg-zinc-800 border border-zinc-700 rounded p-3 text-sm max-w-xs shadow-lg z-30`.
- Arrow/caret is optional — not required for v1.

**Implementation notes:**

- Use a local `useState` for `open`.
- Use a `useEffect` listening on `document` for `click` (to close on outside click) and `keydown` for `Esc`. Attach only when open.
- Use a `ref` on the popover container to detect clicks inside vs outside.
- Do **not** introduce a new dependency (e.g., Radix, Floating UI). Keep it hand-rolled and simple.

### B.2 Placement of Tooltips

Add `<HelpPopover>` next to each control listed below. Each tooltip's body content is in section B.3.

**In `components/SettingsDrawer.tsx`:**

- Next to `Model` label
- Next to `Temperature` label
- Next to `Output language` label
- Next to `Target chapter length` label
- Next to `Export as .md` button (tooltip sits beside the button, not inside it)
- Next to `Export backup` button
- Next to `Import backup` button

**In `components/StoryContextEditor.tsx`:**

- Next to the Story Context section heading

**In `components/ChapterWorkspace.tsx`:**

- Next to the main chapter-workspace heading (covers outline / draft / generate collectively — one tooltip, not three)

### B.3 Tooltip Content

All content is Thai. Markdown bolding in the content below indicates emphasis in the rendered popover.

**Model:**

> เลือก AI ที่จะใช้ Generate:
> - **Claude Sonnet 4.6** — สมดุลคุณภาพ/ความเร็ว/ค่าใช้จ่าย เหมาะกับงานประจำ
> - **Claude Opus 4.7** — คุณภาพสูงสุด เข้าใจบริบทซับซ้อน ช้า+แพงกว่า เหมาะกับตอนสำคัญ
> - **GPT-5.4** — สมดุลคุณภาพ/ความเร็ว เหมาะกับงานทั่วไป
> - **Gemini 3 Flash** — เร็ว ประหยัด เหมาะกับทดลอง/ร่างไว ๆ
> - **Gemini 3.1 Pro** — คุณภาพสูง รองรับ context ยาวมาก เหมาะกับนิยายที่บริบทเยอะ
>
> *คำแนะนำเป็นค่าเริ่มต้น — ลองเองแล้วเลือกที่ถูกใจที่สุด*

**Temperature:**

> ควบคุมความหลากหลายของคำที่ AI เลือกใช้
> - 0-0.5 (ต่ำ): คาดเดาได้ คำคุ้นเคย
> - 0.6-0.9 (กลาง): สมดุล สร้างสรรค์+สอดคล้อง
> - 1.0-1.5 (สูง): สร้างสรรค์ แปลกใหม่ แต่เสี่ยงหลุดเรื่อง
>
> แนะนำเริ่มที่ 0.7-0.8

**Output language:**

> ภาษาที่ AI จะใช้เขียน เปลี่ยนได้ตลอด ไม่จำเป็นต้องตรงกับภาษาที่ใช้ใน Story Context

**Target chapter length:**

> ความยาวโดยประมาณของแต่ละตอน (คำ) AI จะพยายามทำตาม แต่ไม่ตรงเป๊ะเสมอไป

**Export as .md:**

> ดาวน์โหลดเนื้อหานิยาย (Story Context + ทุกตอน) เป็นไฟล์ Markdown อ่านได้ในโปรแกรมทั่วไป (Obsidian, VSCode, Notion) เหมาะกับการส่งออกไปใช้ที่อื่น

**Export backup:**

> ดาวน์โหลดข้อมูลทั้งหมดเป็นไฟล์ JSON สำหรับสำรองข้อมูล นำเข้ากลับมาได้ภายหลัง — **แนะนำสำรองเป็นระยะ** นิยายของคุณสำคัญ

**Import backup:**

> นำเข้าไฟล์ JSON ที่เคย Export backup ไว้ **คำเตือน: จะเขียนทับข้อมูลปัจจุบันทั้งหมด** — ควร Export backup ของเดิมก่อนทุกครั้ง

**Story Context header:**

> บริบทของนิยายที่ AI จะใช้อ้างอิงในทุก Generate — ตัวละคร โลก พล็อต สไตล์การเขียน ยิ่งละเอียด AI ยิ่งช่วยได้ตรงแนว

**Chapter workspace header:**

> พื้นที่สร้างตอน: ใส่ชื่อตอน, โครงสั้น ๆ ของเนื้อหา, แล้วกด Generate เพื่อให้ AI ร่างให้ แก้ไขได้เสมอก่อน save

---

## C. Default Model Change

Change the default `model` value (used for new novels / reset) from `anthropic/claude-sonnet-4.6` to `google/gemini-3-flash-preview`.

- Existing users whose `model` is already set to a valid option are not affected (the migration `useEffect` in `SettingsDrawer` only replaces stale/invalid slugs).
- The change affects: brand new users (no stored state), users who click "Start New Novel (Clear All Data)".
- Update the default in `lib/types.ts` (the `DEFAULT_NOVEL` or equivalent initializer at line ~66, where `model: "anthropic/claude-sonnet-4.6"` is currently set).
- Also search `lib/__tests__/` for any tests that hardcode `"anthropic/claude-sonnet-4.6"` as the default (e.g., `store.test.tsx`, `streamMeta.test.ts`) and update only the ones that are asserting on the *default*, not those that are explicitly testing a specific model.

**Rationale:** Gemini 3 Flash is the cheapest/fastest option and is the right default for a first-time user who wants to experiment before spending on premium models. The owner explicitly requested this.

---

## Data Flow Summary

```
First visit:
  mount → localStorage lookup → not found → render <LandingPage returning=false />
  click Start → setItem + setShowLanding(false) → main app renders

Return visit:
  mount → localStorage lookup → found → render main app directly

Mid-session help request:
  main app → click Help in sidebar → setShowLanding(true)
  render <LandingPage returning=true />
  click "กลับไปเขียน" → setShowLanding(false) → main app renders
  (localStorage flag stays set; no change)

Tooltip:
  click `?` → popover opens, displays content
  click outside OR click `?` again OR press Esc → popover closes
```

---

## Testing

**Manual testing (required before merge):**

1. **First-visit flow:** Open app in a fresh browser profile (or clear localStorage). Landing page shows. Click Start. Main app appears. Reload. Main app appears directly (landing gone).
2. **Help button:** From main app, click Help in sidebar. Landing page shows with "กลับไปเขียน" label. Click it. Main app returns.
3. **Tooltips:** Open every tooltip (9 total). Content renders. Click outside closes. `Esc` closes. Tooltips don't overflow the viewport on standard desktop widths (1280px+).
4. **Default model:** Clear data via "Start New Novel". Open Settings. Model is `google/gemini-3-flash-preview`.
5. **Import/export still work:** No regression — export .md, export backup, import backup all functional.

**Automated testing (light):**

- Unit test for the localStorage flag read/write logic if it's factored into a helper; otherwise skip (the landing-page toggle is trivial and best verified by hand).
- No new tests required for the content itself.

**Typecheck + existing tests:**

- `npm run typecheck` passes
- `npm run test` passes (no existing tests should break)

---

## Risk & Rollback

- **Risk:** Low. No data-shape changes, no backend changes, no changes to save/load logic.
- **localStorage key collision:** The key `novel-generate:seen-landing` is namespaced; no collision risk.
- **User data:** Not touched. Nothing in this change reads or writes novel content.
- **Rollback:** Single revert. No migration to undo.

---

## Open Questions for Implementer

None. All content and behavior decisions are above. If the implementer finds a decision that isn't covered, flag it and ask before improvising.
