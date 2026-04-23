"use client";
import { Fragment } from "react";
import { useNovel } from "@/lib/store";
import { useReview } from "@/lib/review";
import { Button } from "./ui/Button";

type Props = {
  viewingId: string | null;
  onView: (id: string | null) => void;
  draftActive: boolean;
  onStartDraft: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
};

function preview(text: string) {
  return text.split("\n").slice(0, 2).join(" ").slice(0, 80);
}

export function ChapterSidebar({ viewingId, onView, draftActive, onStartDraft, onOpenSettings, onOpenHelp }: Props) {
  const { novel, update } = useNovel();
  const { reviewing } = useReview();
  const { chapters, draft } = novel;

  const showDraftRow =
    draft.chapterId === null && (draftActive || Boolean(draft.title || draft.output));
  const editingExisting = draft.chapterId !== null;
  const newChapterDisabled = showDraftRow || editingExisting;
  const novelTotalUsd = chapters.reduce((sum, c) => sum + (c.cost?.totalUsd ?? 0), 0);

  const newChapter = () => {
    onView(null);
    onStartDraft();
    update((n) => {
      n.draft = { chapterId: null, title: "", prompt: "", output: "" };
    });
  };

  return (
    <aside className={`w-56 shrink-0 h-screen sticky top-0 border-r border-zinc-800 flex flex-col ${reviewing ? "pointer-events-none opacity-50" : ""}`}>
      <div className="p-4 border-b border-zinc-800">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Chapters</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {chapters.length === 0 && !showDraftRow && (
          <p className="p-4 text-xs text-zinc-500">No chapters yet.</p>
        )}
        {chapters.map((c) => {
          const chapterHighlight = viewingId === c.id;
          const draftEditHighlight = viewingId === null && draft.chapterId === c.id;
          const draftEditTitle = draft.title || c.title || "(untitled)";
          return (
            <Fragment key={c.id}>
              <button
                onClick={() => onView(c.id)}
                className={`w-full text-left p-3 border-b border-zinc-900 hover:bg-zinc-800 ${
                  chapterHighlight ? "bg-zinc-800" : ""
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-sm font-medium truncate">{c.title || "(untitled)"}</div>
                  {c.cost && (
                    <div className="text-[10px] font-mono text-zinc-500 shrink-0">
                      ${c.cost.totalUsd.toFixed(4)}
                    </div>
                  )}
                </div>
                <div className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{preview(c.content)}</div>
              </button>
              {draft.chapterId === c.id && (
                <button
                  onClick={() => onView(null)}
                  className={`w-full text-left p-3 border-b border-zinc-900 hover:bg-zinc-800 ${
                    draftEditHighlight ? "bg-zinc-800" : ""
                  }`}
                >
                  <div className="text-sm font-medium text-emerald-400">
                    ▸ Draft edit — {draftEditTitle}
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5 line-clamp-2">
                    {preview(draft.output) || "(empty)"}
                  </div>
                </button>
              )}
            </Fragment>
          );
        })}
        {showDraftRow && (
          <button
            onClick={() => onView(null)}
            className={`w-full text-left p-3 border-b border-zinc-900 hover:bg-zinc-800 ${
              viewingId === null ? "bg-zinc-800" : ""
            }`}
          >
            <div className="text-sm font-medium text-emerald-400">▸ Draft</div>
            <div className="text-xs text-zinc-500 mt-0.5 line-clamp-2">
              {preview(draft.output) || "(empty)"}
            </div>
          </button>
        )}
      </div>
      <div className="p-3 space-y-2 border-t border-zinc-800">
        {novelTotalUsd > 0 && (
          <div className="flex justify-between text-xs text-zinc-500 px-1">
            <span>Total spent</span>
            <span className="font-mono text-zinc-300">${novelTotalUsd.toFixed(4)}</span>
          </div>
        )}
        <Button
          variant="secondary"
          className="w-full"
          onClick={newChapter}
          disabled={newChapterDisabled}
          title={newChapterDisabled ? "Finish or discard the current draft first" : ""}
        >
          + New chapter
        </Button>
        <Button variant="ghost" className="w-full" onClick={onOpenHelp}>? Help</Button>
        <Button variant="ghost" className="w-full" onClick={onOpenSettings}>⚙ Settings</Button>
      </div>
    </aside>
  );
}
