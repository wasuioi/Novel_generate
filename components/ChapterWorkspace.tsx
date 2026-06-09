"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNovel } from "@/lib/store";
import { useReview, type LoreCandidate } from "@/lib/review";
import { buildMessages } from "@/lib/prompt";
import { readBufferedStream } from "@/lib/stream";
import { parseSummarizerOutput } from "@/lib/agents/summarizer";
import { parseLoreKeeperOutput } from "@/lib/agents/loreKeeper";
import {
  AGENT_TIMEOUT_MS,
  MAX_OUTPUT_TOKENS,
} from "@/lib/agents/config";
import { COST_DELIMITER_HEADER, extractWriterMeta } from "@/lib/agents/streamMeta";
import { buildChapterCost } from "@/lib/agents/prices";
import type { AgentCall, SceneSuggestion } from "@/lib/types";
import { Button } from "./ui/Button";
import { Textarea } from "./ui/Textarea";
import { ReviewPanel } from "./ReviewPanel";
import { GenerationControls } from "./GenerationControls";
import { PromptPreviewModal } from "./PromptPreviewModal";
import { SceneSuggestModal } from "./SceneSuggestModal";
import { buildSceneSuggestMessages } from "@/lib/agents/sceneSuggester";
import { HelpPopover } from "./ui/HelpPopover";

type Props = {
  viewingId: string | null;
  onClearView: () => void;
  draftActive: boolean;
  onEndDraft: () => void;
};

type AgentResponse = { text: string; cost: AgentCall | null };

async function callAgent(
  url: string,
  body: unknown,
  signal: AbortSignal,
): Promise<AgentResponse> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  const json = (await res.json()) as AgentResponse;
  return { text: json.text ?? "", cost: json.cost ?? null };
}

// A finish reason other than "stop" means the model did not complete the
// chapter on its own — surface why, so the user isn't left with a silently
// truncated draft.
function truncationMessage(finishReason: string | null): string {
  const base = "⚠️ การสร้างถูกตัดกลางคัน — เนื้อหาที่ได้อาจยังไม่จบ";
  switch (finishReason) {
    case "length":
      return `${base} (ถึงลิมิตความยาว) — ลองลด "ระดับรายละเอียด" หรือแบ่งเป็นหลายตอน`;
    case "content-filter":
      return `${base} (ตัวกรองเนื้อหาของโมเดล) — ลองปรับเนื้อหา หรือเปลี่ยนโมเดล`;
    default:
      return `${base} — ลองกด Generate ใหม่ หรือเปลี่ยนโมเดล (อาจเน็ตหลุดหรือโมเดลมีปัญหา)`;
  }
}

export function ChapterWorkspace({ viewingId, onClearView, draftActive, onEndDraft }: Props) {
  const { novel, update } = useNovel();
  const { state: reviewState, setState: setReview, reviewing } = useReview();
  const { draft, settings } = novel;
  const [streaming, setStreaming] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const summaryAbortRef = useRef<AbortController | null>(null);
  const loreAbortRef = useRef<AbortController | null>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SceneSuggestion[]>([]);
  const suggestAbortRef = useRef<AbortController | null>(null);
  const reviewRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the review panel when it opens, so the user sees that
  // clicking "บันทึกตอน" did something (the panel renders below the fold).
  useEffect(() => {
    if (reviewing) {
      reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [reviewing]);

  const INTRO_SEEN_KEY = "sceneSuggest.introSeen";

  const viewedChapter = viewingId ? novel.chapters.find((c) => c.id === viewingId) : undefined;
  const isEditingExisting = Boolean(draft.chapterId);
  const previewMessages = useMemo(() => buildMessages(novel), [novel]);
  const hasSomethingToDiscard =
    isEditingExisting ||
    draftActive ||
    Boolean(draft.title.trim() || draft.prompt.trim() || draft.output.trim());

  const canGenerate =
    !streaming && !reviewing && Boolean(novel.storyContext.trim() || draft.prompt.trim());

  const canSuggest =
    !streaming &&
    !reviewing &&
    !isEditingExisting &&
    (novel.storyContext.trim().length > 0 || novel.chapters.length > 0);

  const generate = async () => {
    if (draft.output.trim()) {
      const ok = window.confirm(
        "There is already generated content in the output. Are you sure you want to overwrite the old story?",
      );
      if (!ok) return;
    }
    if (!draft.prompt.trim()) {
      const ok = window.confirm(
        "Are you sure you want to generate without entering a chapter prompt? The AI will continue the story spontaneously.",
      );
      if (!ok) return;
    }
    setError(null);
    setStreaming(true);
    update((n) => { n.draft.output = ""; n.draft.writerCost = null; });
    const controller = new AbortController();
    abortRef.current = controller;
    let received = "";
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: settings.model,
          temperature: settings.temperature,
          maxTokens: Math.min(settings.targetChars * 2, MAX_OUTPUT_TOKENS),
          messages: buildMessages(novel),
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        setError(`${res.status} · ${await res.text()}`);
        return;
      }
      const delimiter = res.headers.get(COST_DELIMITER_HEADER) ?? "";
      await readBufferedStream(
        res.body,
        (chunk) => {
          received += chunk;
          const metaIdx = delimiter ? received.indexOf(delimiter) : -1;
          const clean = metaIdx >= 0 ? received.slice(0, metaIdx) : received;
          update((n) => { n.draft.output = clean; });
        },
        controller.signal,
      );
      const meta = extractWriterMeta(received, delimiter);
      if (meta?.cost) {
        update((n) => { n.draft.writerCost = meta.cost; });
      }
      if (meta && (meta.errored || (meta.finishReason !== null && meta.finishReason !== "stop"))) {
        setError(truncationMessage(meta.finishReason));
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError((e as Error).message);
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const stop = () => abortRef.current?.abort();

  const runSuggest = async () => {
    suggestAbortRef.current?.abort();
    const controller = new AbortController();
    suggestAbortRef.current = controller;
    setSuggestLoading(true);
    setSuggestError(null);
    setSuggestions([]);
    try {
      const res = await fetch("/api/suggest-scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: settings.model,
          temperature: settings.temperature,
          messages: buildSceneSuggestMessages(novel),
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text();
        setSuggestError(`${res.status} · ${text}`);
        return;
      }
      const json = (await res.json()) as {
        suggestions: SceneSuggestion[];
        cost: AgentCall | null;
      };
      setSuggestions(json.suggestions);
      if (json.cost) {
        update((n) => { n.draft.sceneSuggesterCost = json.cost; });
      }
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      setSuggestError(err instanceof Error ? err.message : String(err));
    } finally {
      setSuggestLoading(false);
    }
  };

  const onSuggestClick = () => {
    const seen =
      typeof window !== "undefined" &&
      window.localStorage.getItem(INTRO_SEEN_KEY) === "1";
    if (!seen) {
      const ok = window.confirm(
        "ฟีเจอร์ขอไอเดีย: AI จะเสนอไอเดีย 3 แบบสำหรับตอนต่อไป โดยดูจากเนื้อเรื่องและ lore ที่คุณมี เลือกหนึ่งได้ (หรือไม่เลือกก็ได้) ใช้ครั้งละประมาณ $0.0005 (ราคาตามโมเดลที่คุณตั้ง) ใช้เลยไหม?"
      );
      if (!ok) return;
      window.localStorage.setItem(INTRO_SEEN_KEY, "1");
    }
    setSuggestOpen(true);
    void runSuggest();
  };

  const startSummarize = (chapterTitle: string, chapterContent: string) => {
    summaryAbortRef.current?.abort();
    const controller = new AbortController();
    summaryAbortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);

    setReview((prev) =>
      prev.kind === "active" ? { ...prev, summaryStatus: "loading" } : prev,
    );

    callAgent(
      "/api/summarize",
      { chapterTitle, chapterContent },
      controller.signal,
    )
      .then(({ text, cost }) => {
        const bullets = parseSummarizerOutput(text);
        const summary = bullets.length > 0 ? bullets.map((b) => `- ${b}`).join("\n") : text.trim();
        setReview((prev) =>
          prev.kind === "active"
            ? { ...prev, summary, summaryStatus: "ready", summarizerCost: cost }
            : prev,
        );
      })
      .catch((e) => {
        if ((e as Error).name === "AbortError") return;
        console.error("[summarizer]", e);
        setReview((prev) =>
          prev.kind === "active" ? { ...prev, summaryStatus: "error" } : prev,
        );
      })
      .finally(() => clearTimeout(timeout));
  };

  const startLore = (
    chapterTitle: string,
    chapterContent: string,
    existingLore: string[],
  ) => {
    loreAbortRef.current?.abort();
    const controller = new AbortController();
    loreAbortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);

    setReview((prev) =>
      prev.kind === "active" ? { ...prev, loreStatus: "loading" } : prev,
    );

    callAgent(
      "/api/extract-lore",
      { chapterTitle, chapterContent, existingLore },
      controller.signal,
    )
      .then(({ text, cost }) => {
        const bullets = parseLoreKeeperOutput(text);
        const candidates: LoreCandidate[] = bullets.map((b) => ({ text: b, checked: true }));
        setReview((prev) =>
          prev.kind === "active"
            ? { ...prev, loreCandidates: candidates, loreStatus: "ready", loreKeeperCost: cost }
            : prev,
        );
      })
      .catch((e) => {
        if ((e as Error).name === "AbortError") return;
        console.error("[loreKeeper]", e);
        setReview((prev) =>
          prev.kind === "active" ? { ...prev, loreStatus: "error" } : prev,
        );
      })
      .finally(() => clearTimeout(timeout));
  };

  const abortAgents = () => {
    summaryAbortRef.current?.abort();
    loreAbortRef.current?.abort();
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
      summarizerCost: null,
      loreKeeperCost: null,
    });

    startSummarize(title, content);
    if (!isEditingExisting) {
      startLore(title, content, novel.lore.map((l) => l.text));
    }
  };

  const commitChapter = (summary: string, approvedLore: LoreCandidate[]) => {
    if (reviewState.kind !== "active") return;
    const stagedTitle = reviewState.stagedTitle;
    const stagedPrompt = reviewState.stagedPrompt;
    const stagedContent = reviewState.stagedContent;
    const writerCost = novel.draft.writerCost ?? null;
    const sceneSuggesterCost = novel.draft.sceneSuggesterCost ?? null;
    const summarizerCost = reviewState.summarizerCost;
    const loreKeeperCost = reviewState.loreKeeperCost;

    update((n) => {
      const d = n.draft;
      if (d.chapterId) {
        const existing = n.chapters.find((c) => c.id === d.chapterId);
        if (existing) {
          existing.title = stagedTitle;
          existing.prompt = stagedPrompt;
          existing.content = stagedContent;
          existing.summary = summary;
          // Merge: keep old per-agent cost when the new capture failed, so a
          // transient OpenRouter /generation lag doesn't wipe saved cost data.
          const findOldCost = (agent: AgentCall["agent"]) =>
            existing.cost?.calls.find((c) => c.agent === agent) ?? null;
          const merged = buildChapterCost([
            writerCost ?? findOldCost("writer"),
            summarizerCost ?? findOldCost("summarizer"),
            loreKeeperCost ?? findOldCost("loreKeeper"),
            sceneSuggesterCost ?? findOldCost("sceneSuggester"),
          ]);
          existing.cost = merged ?? existing.cost;
        }
      } else {
        const chapterCost = buildChapterCost([writerCost, summarizerCost, loreKeeperCost, sceneSuggesterCost]);
        const newId = crypto.randomUUID();
        n.chapters.push({
          id: newId,
          title: stagedTitle,
          prompt: stagedPrompt,
          content: stagedContent,
          summary,
          createdAt: Date.now(),
          cost: chapterCost,
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
      n.draft = { chapterId: null, title: "", prompt: "", output: "", writerCost: null, sceneSuggesterCost: null };
    });
  };

  const confirmMissingSummary = (): boolean => {
    if (reviewState.kind !== "active") return true;
    if (reviewState.summaryStatus !== "error") return true;
    return window.confirm(
      "Summary failed to generate — the chapter will be saved without a summary. Continue?",
    );
  };

  const onApprove = () => {
    if (reviewState.kind !== "active") return;
    if (!confirmMissingSummary()) return;
    commitChapter(reviewState.summary, reviewState.loreCandidates);
    setReview({ kind: "idle" });
    onEndDraft();
  };

  const onCancel = () => {
    abortAgents();
    setReview({ kind: "idle" });
  };

  const onRetrySummary = () => {
    if (reviewState.kind !== "active") return;
    startSummarize(reviewState.stagedTitle, reviewState.stagedContent);
  };

  const onRetryLore = () => {
    if (reviewState.kind !== "active") return;
    startLore(
      reviewState.stagedTitle,
      reviewState.stagedContent,
      novel.lore.map((l) => l.text),
    );
  };

  const discard = () => {
    if (!window.confirm("Discard this draft?")) return;
    update((n) => {
      n.draft = { chapterId: null, title: "", prompt: "", output: "", writerCost: null, sceneSuggesterCost: null };
    });
    onEndDraft();
  };

  const editViewedChapter = () => {
    if (!viewedChapter) return;

    if (draft.chapterId === viewedChapter.id) {
      onClearView();
      return;
    }

    if (
      draft.chapterId === null &&
      draft.output.trim() &&
      !window.confirm("You have an unsaved new draft. Loading this chapter will discard it. Continue?")
    ) {
      return;
    }

    if (draft.chapterId !== null && draft.chapterId !== viewedChapter.id) {
      const origin = novel.chapters.find((c) => c.id === draft.chapterId);
      const dirty =
        !!origin &&
        (draft.title !== origin.title ||
          draft.prompt !== origin.prompt ||
          draft.output !== origin.content);
      if (
        dirty &&
        !window.confirm(
          `You have unsaved changes in your edit of "${origin!.title || "(untitled)"}". Loading this chapter will discard them. Continue?`,
        )
      ) {
        return;
      }
    }

    update((n) => {
      n.draft = {
        chapterId: viewedChapter.id,
        title: viewedChapter.title,
        prompt: viewedChapter.prompt,
        output: viewedChapter.content,
        writerCost: null,
        sceneSuggesterCost: null,
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
      {viewedChapter.cost && (
        <div className="space-y-1">
          <div className="text-xs uppercase text-zinc-500">API cost</div>
          <div className="text-xs font-mono text-zinc-400 border border-zinc-800 rounded p-3 bg-zinc-950 space-y-0.5">
            {viewedChapter.cost.calls.map((c, i) => (
              <div key={i} className="flex justify-between gap-4">
                <span>
                  {c.agent}: {c.model}
                </span>
                <span>
                  in {c.promptTokens.toLocaleString()} / out {c.completionTokens.toLocaleString()} · ${c.costUsd.toFixed(4)}
                </span>
              </div>
            ))}
            <div className="flex justify-between pt-1 border-t border-zinc-800 font-semibold text-zinc-300">
              <span>Total</span>
              <span>${viewedChapter.cost.totalUsd.toFixed(4)}</span>
            </div>
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
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 mb-3">
        Chapter draft
        <HelpPopover ariaLabel="Help: Chapter draft">
          พื้นที่สร้างตอน: ใส่ชื่อตอน, โครงสั้น ๆ ของเนื้อหา, แล้วกด Generate เพื่อให้ AI ร่างให้ แก้ไขได้เสมอก่อน save
        </HelpPopover>
      </h2>
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
        <GenerationControls />
        <div className="flex gap-2">
          {streaming ? (
            <Button variant="danger" onClick={stop}>■ Stop generating</Button>
          ) : (
            <>
              <Button
                variant="secondary"
                onClick={onSuggestClick}
                disabled={!canSuggest}
                title={canSuggest ? "" : "ต้องมี Story Context หรือมีตอนอื่นอยู่แล้วก่อน / ใช้ไม่ได้ตอนแก้ตอนเก่าหรือกำลังสร้าง"}
              >
                💡 ขอไอเดีย
              </Button>
              <Button
                onClick={generate}
                disabled={!canGenerate}
                title={canGenerate ? "" : "Write some guidance first"}
              >
                Generate ▸
              </Button>
              <Button
                variant="secondary"
                onClick={() => setPreviewOpen(true)}
                disabled={!canGenerate}
                title={canGenerate ? "" : "Write some guidance first"}
              >
                Preview prompt
              </Button>
            </>
          )}
        </div>
        {streaming && !draft.output && (
          <p className="text-xs text-zinc-400 animate-pulse">
            Model is thinking…
          </p>
        )}
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-200 rounded p-3 text-sm mt-6">
          {error}
        </div>
      )}

      <div className="space-y-2 mt-6">
        <div className="flex items-baseline justify-between">
          <label className="text-xs uppercase text-zinc-400">Output (editable)</label>
          <span className="text-xs text-zinc-500">{draft.output.length} ตัวอักษร</span>
        </div>
        <Textarea
          value={draft.output}
          onChange={(e) => update((n) => { n.draft.output = e.target.value; })}
          rows={16}
          className="font-serif text-base leading-relaxed"
          placeholder="Generated chapter will stream in here…"
        />
        <div className="flex gap-2">
          <Button onClick={send} disabled={!draft.output.trim() || streaming || reviewing}>
            บันทึกตอน
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
        <div ref={reviewRef}>
          <ReviewPanel
            isEditing={isEditingExisting}
            onApprove={onApprove}
            onCancel={onCancel}
            onRetrySummary={onRetrySummary}
            onRetryLore={onRetryLore}
          />
        </div>
      )}

      <PromptPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        messages={previewMessages}
      />

      <SceneSuggestModal
        open={suggestOpen}
        loading={suggestLoading}
        error={suggestError}
        suggestions={suggestions}
        warnOverwrite={draft.title.trim().length > 0 || draft.prompt.trim().length > 0}
        onConfirm={(picked) => {
          update((n) => {
            n.draft.title = picked.title;
            n.draft.prompt = picked.synopsis;
          });
          setSuggestOpen(false);
        }}
        onRegenerate={() => { void runSuggest(); }}
        onClose={() => {
          suggestAbortRef.current?.abort();
          setSuggestOpen(false);
        }}
      />
    </section>
  );
}
