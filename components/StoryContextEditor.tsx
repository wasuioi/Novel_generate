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
