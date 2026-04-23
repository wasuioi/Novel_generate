"use client";
import { useState } from "react";
import { useNovel } from "@/lib/store";
import { useReview } from "@/lib/review";
import { Textarea } from "./ui/Textarea";
import { Button } from "./ui/Button";
import { HelpPopover } from "./ui/HelpPopover";

function wordCount(s: string) {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

export function StoryContextEditor() {
  const { novel, update } = useNovel();
  const { reviewing } = useReview();
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
    <section className={`space-y-2 ${reviewing ? "pointer-events-none opacity-50" : ""}`}>
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Story Context
          <HelpPopover ariaLabel="Help: Story Context">
            บริบทของนิยายที่ AI จะใช้อ้างอิงในทุก Generate — ตัวละคร โลก พล็อต สไตล์การเขียน ยิ่งละเอียด AI ยิ่งช่วยได้ตรงแนว
          </HelpPopover>
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
