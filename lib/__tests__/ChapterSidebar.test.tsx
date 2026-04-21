import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { ChapterSidebar } from "@/components/ChapterSidebar";
import { NovelProvider, STORAGE_KEY } from "@/lib/store";
import { ReviewProvider } from "@/lib/review";
import { DEFAULT_NOVEL, type Chapter, type Draft } from "@/lib/types";

function makeChapter(id: string, title: string, content = `${title} body.`): Chapter {
  return { id, title, prompt: "", content, summary: "", createdAt: 1 };
}

function seed(chapters: Chapter[], draft: Partial<Draft> = {}) {
  const state = {
    ...DEFAULT_NOVEL,
    chapters,
    draft: { ...DEFAULT_NOVEL.draft, ...draft },
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <NovelProvider>
    <ReviewProvider>{children}</ReviewProvider>
  </NovelProvider>
);

const noop = () => {};

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
      {...overrides}
    />,
    { wrapper },
  );
}

describe("ChapterSidebar draft edit row", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("does not render a draft edit row when draft.chapterId is null", async () => {
    seed([makeChapter("a", "Alpha"), makeChapter("b", "Beta")]);
    renderSidebar();
    expect(await screen.findByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByText(/Draft edit/i)).toBeNull();
  });

  it("renders a draft edit row immediately after the chapter being edited", async () => {
    const chapters = [
      makeChapter("a", "Alpha"),
      makeChapter("b", "Beta"),
      makeChapter("c", "Gamma"),
    ];
    seed(chapters, {
      chapterId: "b",
      title: "Beta",
      prompt: "",
      output: "edited body preview",
    });
    renderSidebar();
    await screen.findByText("Alpha");

    const text = document.body.textContent ?? "";
    const posBeta = text.indexOf("Beta");
    const posDraftEdit = text.indexOf("Draft edit");
    const posGamma = text.indexOf("Gamma");
    expect(posBeta).toBeGreaterThanOrEqual(0);
    expect(posDraftEdit).toBeGreaterThan(posBeta);
    expect(posGamma).toBeGreaterThan(posDraftEdit);
  });

  it("highlights the original row when viewing that chapter, not the draft edit row", async () => {
    seed([makeChapter("a", "Alpha"), makeChapter("b", "Beta")], {
      chapterId: "b",
      title: "Beta",
      prompt: "",
      output: "edited body",
    });
    renderSidebar({ viewingId: "b" });
    const betaButton = (await screen.findByText("Beta")).closest("button");
    const draftEditButton = screen.getByText(/Draft edit/i).closest("button");
    expect(betaButton?.className).toContain("bg-zinc-800");
    expect(draftEditButton?.className).not.toContain("bg-zinc-800");
  });

  it("highlights the draft edit row when the editor is open (viewingId=null)", async () => {
    seed([makeChapter("a", "Alpha"), makeChapter("b", "Beta")], {
      chapterId: "b",
      title: "Beta",
      prompt: "",
      output: "edited body",
    });
    renderSidebar({ viewingId: null });
    const betaButton = (await screen.findByText("Beta")).closest("button");
    const draftEditButton = screen.getByText(/Draft edit/i).closest("button");
    expect(draftEditButton?.className).toContain("bg-zinc-800");
    expect(betaButton?.className).not.toContain("bg-zinc-800");
  });

  it("clicking the draft edit row calls onView(null)", async () => {
    seed([makeChapter("a", "Alpha"), makeChapter("b", "Beta")], {
      chapterId: "b",
      title: "Beta",
      prompt: "",
      output: "edited body",
    });
    const calls: Array<string | null> = [];
    const onView = (id: string | null) => calls.push(id);
    renderSidebar({ viewingId: "b", onView });
    const draftEditButton = (await screen.findByText(/Draft edit/i)).closest(
      "button",
    ) as HTMLButtonElement;
    draftEditButton.click();
    expect(calls).toEqual([null]);
  });
});
