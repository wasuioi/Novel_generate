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
