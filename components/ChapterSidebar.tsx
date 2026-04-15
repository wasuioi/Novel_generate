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
