"use client";
import { useReview } from "@/lib/review";
import { Button } from "./ui/Button";
import { Textarea } from "./ui/Textarea";

type Props = {
  onApprove: () => void;
  onSkip: () => void;
  onCancel: () => void;
  onRetrySummary: () => void;
  onRetryLore: () => void;
};

export function ReviewPanel({ onApprove, onSkip, onCancel, onRetrySummary, onRetryLore }: Props) {
  const { state, setState } = useReview();
  if (state.kind !== "active") return null;

  const updateSummary = (text: string) =>
    setState({ ...state, summary: text });

  const toggleLore = (idx: number) =>
    setState({
      ...state,
      loreCandidates: state.loreCandidates.map((c, i) =>
        i === idx ? { ...c, checked: !c.checked } : c,
      ),
    });

  const editLore = (idx: number, text: string) =>
    setState({
      ...state,
      loreCandidates: state.loreCandidates.map((c, i) =>
        i === idx ? { ...c, text } : c,
      ),
    });

  const bothDone =
    state.summaryStatus !== "loading" && state.loreStatus !== "loading";

  return (
    <section className="border border-amber-700 bg-amber-950/30 rounded p-4 space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-300">
        Review chapter before saving
      </h2>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs uppercase text-zinc-400">Summary</label>
          {state.summaryStatus === "loading" && (
            <span className="text-xs text-zinc-500">Summarizing…</span>
          )}
          {state.summaryStatus === "error" && (
            <button onClick={onRetrySummary} className="text-xs text-amber-400 underline">
              Retry summary
            </button>
          )}
        </div>
        {state.summaryStatus === "error" ? (
          <p className="text-xs text-red-300">
            Summarizer failed — you can still save without a summary.
          </p>
        ) : (
          <Textarea
            value={state.summary}
            onChange={(e) => updateSummary(e.target.value)}
            rows={5}
            disabled={state.summaryStatus === "loading"}
          />
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs uppercase text-zinc-400">New lore</label>
          {state.loreStatus === "loading" && (
            <span className="text-xs text-zinc-500">Extracting…</span>
          )}
          {state.loreStatus === "error" && (
            <button onClick={onRetryLore} className="text-xs text-amber-400 underline">
              Retry lore
            </button>
          )}
        </div>
        {state.loreStatus === "error" ? (
          <p className="text-xs text-red-300">
            Lore extraction failed — chapter will save without new lore.
          </p>
        ) : state.loreCandidates.length === 0 && state.loreStatus === "ready" ? (
          <p className="text-xs text-zinc-500 italic">No new lore extracted.</p>
        ) : (
          <ul className="space-y-1">
            {state.loreCandidates.map((c, i) => (
              <li key={i} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={c.checked}
                  onChange={() => toggleLore(i)}
                  className="mt-1.5"
                />
                <input
                  value={c.text}
                  onChange={(e) => editLore(i, e.target.value)}
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded p-1.5 text-sm"
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex gap-2 pt-2 border-t border-amber-800">
        <Button onClick={onApprove} disabled={!bothDone}>
          Approve & save
        </Button>
        <Button variant="secondary" onClick={onSkip} disabled={!bothDone}>
          Skip review & save chapter only
        </Button>
        <button onClick={onCancel} className="text-xs text-zinc-400 underline ml-auto">
          Cancel
        </button>
      </div>
    </section>
  );
}
