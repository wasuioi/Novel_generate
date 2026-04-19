"use client";
import { useRef, useState } from "react";
import { useNovel } from "@/lib/store";
import { useReview, type LoreCandidate } from "@/lib/review";
import { buildMessages } from "@/lib/prompt";
import { readBufferedStream } from "@/lib/stream";
import { parseSummarizerOutput } from "@/lib/agents/summarizer";
import { parseLoreKeeperOutput } from "@/lib/agents/loreKeeper";
import { AGENT_TIMEOUT_MS } from "@/lib/agents/config";
import { Button } from "./ui/Button";
import { Textarea } from "./ui/Textarea";
import { ReviewPanel } from "./ReviewPanel";

type Props = {
  viewingId: string | null;
  onClearView: () => void;
  draftActive: boolean;
  onEndDraft: () => void;
};

async function callAgent(
  url: string,
  body: unknown,
  signal: AbortSignal,
): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.text();
}

export function ChapterWorkspace({ viewingId, onClearView, draftActive, onEndDraft }: Props) {
  const { novel, update } = useNovel();
  const { state: reviewState, setState: setReview, reviewing } = useReview();
  const { draft, settings } = novel;
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const agentAbortRef = useRef<AbortController | null>(null);

  const viewedChapter = viewingId ? novel.chapters.find((c) => c.id === viewingId) : undefined;
  const isEditingExisting = Boolean(draft.chapterId);
  const hasSomethingToDiscard =
    isEditingExisting ||
    draftActive ||
    Boolean(draft.title.trim() || draft.prompt.trim() || draft.output.trim());

  const canGenerate =
    !streaming && !reviewing && Boolean(novel.storyContext.trim() || draft.prompt.trim());

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
          maxTokens: Math.min(
            Math.floor(settings.targetWords * (settings.outputLanguage === "th" ? 7 : 2)),
            16000,
          ),
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

  const runAgents = (
    chapterTitle: string,
    chapterContent: string,
    existingLore: string[],
    skipLore: boolean,
  ) => {
    const controller = new AbortController();
    agentAbortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);

    const summaryP = callAgent("/api/summarize",
      { chapterTitle, chapterContent }, controller.signal);

    summaryP
      .then((text) => {
        const bullets = parseSummarizerOutput(text);
        const summary = bullets.length > 0 ? bullets.map((b) => `- ${b}`).join("\n") : text.trim();
        setReview((prev) =>
          prev.kind === "active"
            ? { ...prev, summary, summaryStatus: "ready" }
            : prev,
        );
      })
      .catch((e) => {
        if ((e as Error).name === "AbortError") return;
        console.error("[summarizer]", e);
        setReview((prev) =>
          prev.kind === "active" ? { ...prev, summaryStatus: "error" } : prev,
        );
      });

    if (skipLore) {
      // Mark lore as ready with empty list so the Approve button enables.
      setReview((prev) =>
        prev.kind === "active"
          ? { ...prev, loreCandidates: [], loreStatus: "ready" }
          : prev,
      );
      summaryP.finally(() => clearTimeout(timeout));
      return;
    }

    const loreP = callAgent("/api/extract-lore",
      { chapterTitle, chapterContent, existingLore }, controller.signal);

    loreP
      .then((text) => {
        const bullets = parseLoreKeeperOutput(text);
        const candidates: LoreCandidate[] = bullets.map((b) => ({ text: b, checked: true }));
        setReview((prev) =>
          prev.kind === "active"
            ? { ...prev, loreCandidates: candidates, loreStatus: "ready" }
            : prev,
        );
      })
      .catch((e) => {
        if ((e as Error).name === "AbortError") return;
        console.error("[loreKeeper]", e);
        setReview((prev) =>
          prev.kind === "active" ? { ...prev, loreStatus: "error" } : prev,
        );
      });

    Promise.allSettled([summaryP, loreP]).finally(() => clearTimeout(timeout));
  };

  const send = () => {
    const title = draft.title.trim() || `Chapter ${novel.chapters.length + 1}`;
    const content = draft.output;
    if (!content.trim()) return;

    setReview({
      kind: "active",
      stagedTitle: title,
      stagedPrompt: draft.prompt,
      stagedContent: content,
      summary: "",
      summaryStatus: "loading",
      loreCandidates: [],
      loreStatus: isEditingExisting ? "ready" : "loading",
    });

    runAgents(title, content, novel.lore.map((l) => l.text), isEditingExisting);
  };

  const commitChapter = (summary: string, approvedLore: LoreCandidate[]) => {
    if (reviewState.kind !== "active") return;
    const stagedTitle = reviewState.stagedTitle;
    const stagedPrompt = reviewState.stagedPrompt;
    const stagedContent = reviewState.stagedContent;

    update((n) => {
      const d = n.draft;
      if (d.chapterId) {
        const existing = n.chapters.find((c) => c.id === d.chapterId);
        if (existing) {
          existing.title = stagedTitle;
          existing.prompt = stagedPrompt;
          existing.content = stagedContent;
          existing.summary = summary;
        }
      } else {
        const newId = crypto.randomUUID();
        n.chapters.push({
          id: newId,
          title: stagedTitle,
          prompt: stagedPrompt,
          content: stagedContent,
          summary,
          createdAt: Date.now(),
        });
        for (const c of approvedLore) {
          if (!c.checked || !c.text.trim()) continue;
          n.lore.push({
            id: crypto.randomUUID(),
            text: c.text.trim(),
            source: "ai",
            chapterId: newId,
            createdAt: Date.now(),
          });
        }
      }
      n.draft = { chapterId: null, title: "", prompt: "", output: "" };
    });
  };

  const onApprove = () => {
    if (reviewState.kind !== "active") return;
    commitChapter(reviewState.summary, reviewState.loreCandidates);
    setReview({ kind: "idle" });
    onEndDraft();
  };

  const onSkip = () => {
    agentAbortRef.current?.abort();
    commitChapter("", []);
    setReview({ kind: "idle" });
    onEndDraft();
  };

  const onCancel = () => {
    agentAbortRef.current?.abort();
    setReview({ kind: "idle" });
  };

  const onRetrySummary = () => {
    if (reviewState.kind !== "active") return;
    setReview({ ...reviewState, summaryStatus: "loading" });
    const controller = new AbortController();
    callAgent("/api/summarize",
      { chapterTitle: reviewState.stagedTitle, chapterContent: reviewState.stagedContent },
      controller.signal,
    )
      .then((text) => {
        const bullets = parseSummarizerOutput(text);
        const summary = bullets.length > 0 ? bullets.map((b) => `- ${b}`).join("\n") : text.trim();
        setReview((prev) =>
          prev.kind === "active"
            ? { ...prev, summary, summaryStatus: "ready" }
            : prev,
        );
      })
      .catch(() => {
        setReview((prev) =>
          prev.kind === "active" ? { ...prev, summaryStatus: "error" } : prev,
        );
      });
  };

  const onRetryLore = () => {
    if (reviewState.kind !== "active") return;
    setReview({ ...reviewState, loreStatus: "loading" });
    const controller = new AbortController();
    callAgent("/api/extract-lore",
      {
        chapterTitle: reviewState.stagedTitle,
        chapterContent: reviewState.stagedContent,
        existingLore: novel.lore.map((l) => l.text),
      },
      controller.signal,
    )
      .then((text) => {
        const bullets = parseLoreKeeperOutput(text);
        const candidates: LoreCandidate[] = bullets.map((b) => ({ text: b, checked: true }));
        setReview((prev) =>
          prev.kind === "active"
            ? { ...prev, loreCandidates: candidates, loreStatus: "ready" }
            : prev,
        );
      })
      .catch(() => {
        setReview((prev) =>
          prev.kind === "active" ? { ...prev, loreStatus: "error" } : prev,
        );
      });
  };

  const discard = () => {
    if (!window.confirm("Discard this draft?")) return;
    update((n) => {
      n.draft = { chapterId: null, title: "", prompt: "", output: "" };
    });
    onEndDraft();
  };

  const editViewedChapter = () => {
    if (!viewedChapter) return;
    if (
      draft.chapterId === null &&
      draft.output.trim() &&
      !window.confirm("You have an unsaved new draft. Loading this chapter will discard it. Continue?")
    ) {
      return;
    }
    update((n) => {
      n.draft = {
        chapterId: viewedChapter.id,
        title: viewedChapter.title,
        prompt: viewedChapter.prompt,
        output: viewedChapter.content,
      };
    });
    onClearView();
  };

  const viewerSection = viewedChapter && (
    <div className={`space-y-4 ${reviewing ? "pointer-events-none opacity-50" : ""}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Viewing chapter (read-only)
        </h2>
        <button
          onClick={onClearView}
          className="text-xs text-zinc-400 hover:text-zinc-200 underline"
        >
          ← Back to draft
        </button>
      </div>
      <div className="text-lg font-semibold">{viewedChapter.title || "(untitled)"}</div>
      {viewedChapter.prompt && (
        <div className="space-y-1">
          <div className="text-xs uppercase text-zinc-500">Original prompt</div>
          <div className="text-sm text-zinc-400 italic whitespace-pre-wrap">{viewedChapter.prompt}</div>
        </div>
      )}
      <div className="space-y-1">
        <div className="text-xs uppercase text-zinc-500">Content</div>
        <div className="font-serif text-base leading-relaxed whitespace-pre-wrap border border-zinc-800 rounded p-3 bg-zinc-950 max-h-[60vh] overflow-y-auto">
          {viewedChapter.content}
        </div>
      </div>
      {viewedChapter.summary && (
        <div className="space-y-1">
          <div className="text-xs uppercase text-zinc-500">Summary</div>
          <div className="text-sm text-zinc-400 whitespace-pre-wrap border border-zinc-800 rounded p-3 bg-zinc-950">
            {viewedChapter.summary}
          </div>
        </div>
      )}
      <div>
        <Button onClick={editViewedChapter}>✎ Edit this chapter</Button>
      </div>
    </div>
  );

  const editorSection = (
    <div className={reviewing ? "pointer-events-none opacity-50" : ""}>
      <div className="space-y-2">
        <label className="text-xs uppercase text-zinc-400">Chapter title</label>
        <input
          value={draft.title}
          onChange={(e) => update((n) => { n.draft.title = e.target.value; })}
          placeholder="Chapter 1 · The arrival"
          className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-sm"
        />
      </div>

      <div className="space-y-2 mt-6">
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
        <div className="bg-red-900/40 border border-red-700 text-red-200 rounded p-3 text-sm mt-6">
          {error}
        </div>
      )}

      <div className="space-y-2 mt-6">
        <label className="text-xs uppercase text-zinc-400">Output (editable)</label>
        <Textarea
          value={draft.output}
          onChange={(e) => update((n) => { n.draft.output = e.target.value; })}
          rows={16}
          className="font-serif text-base leading-relaxed"
          placeholder="Generated chapter will stream in here…"
        />
        <div className="flex gap-2">
          <Button onClick={send} disabled={!draft.output.trim() || streaming || reviewing}>
            Send to Chapter History
          </Button>
          <Button
            variant="secondary"
            onClick={discard}
            disabled={streaming || reviewing || !hasSomethingToDiscard}
            title={hasSomethingToDiscard ? "" : "Nothing to discard"}
          >
            Discard
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <section className="space-y-6">
      {viewedChapter ? viewerSection : editorSection}

      {reviewing && (
        <ReviewPanel
          isEditing={isEditingExisting}
          onApprove={onApprove}
          onSkip={onSkip}
          onCancel={onCancel}
          onRetrySummary={onRetrySummary}
          onRetryLore={onRetryLore}
        />
      )}
    </section>
  );
}
