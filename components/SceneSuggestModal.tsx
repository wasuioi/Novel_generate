"use client";
import { useEffect, useState } from "react";
import type { SceneSuggestion } from "@/lib/types";
import { Button } from "./ui/Button";

type Props = {
  open: boolean;
  loading: boolean;
  error: string | null;
  suggestions: SceneSuggestion[];
  warnOverwrite: boolean;
  onConfirm: (picked: SceneSuggestion) => void;
  onRegenerate: () => void;
  onClose: () => void;
};

export function SceneSuggestModal({
  open,
  loading,
  error,
  suggestions,
  warnOverwrite,
  onConfirm,
  onRegenerate,
  onClose,
}: Props) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    // Reset selection whenever a new batch arrives or modal (re)opens
    setSelectedIndex(null);
  }, [suggestions, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const pickable = !loading && !error && suggestions.length === 3;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
      <div className="relative w-[90vw] max-w-[1400px] h-[85vh] p-8">
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิด"
          className="absolute top-4 left-4 z-10 w-10 h-10 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 text-xl leading-none flex items-center justify-center"
        >
          ✕
        </button>

        <h2 className="text-2xl font-bold text-center mb-6 text-zinc-100">
          จงกำหนดโชคชะตา
        </h2>

        {loading && (
          <div className="h-[calc(100%-8rem)] flex items-center justify-center text-zinc-300 animate-pulse">
            กำลังคิดไอเดีย…
          </div>
        )}

        {error && !loading && (
          <div className="h-[calc(100%-8rem)] flex flex-col items-center justify-center gap-4 text-red-400">
            <div>ขอไอเดียไม่สำเร็จ: {error}</div>
            <Button variant="secondary" onClick={onRegenerate}>
              ลองใหม่
            </Button>
          </div>
        )}

        {pickable && (
          <div className="h-[calc(100%-8rem)] grid grid-cols-3 gap-6 pb-16">
            {suggestions.map((s, i) => {
              const isSelected = selectedIndex === i;
              return (
                <button
                  key={i}
                  onClick={() => setSelectedIndex(i)}
                  className={[
                    "text-left rounded-xl p-6 bg-zinc-900 transition-colors overflow-y-auto",
                    isSelected
                      ? "border-2 border-emerald-500 card-selected"
                      : "border border-zinc-700 hover:border-zinc-500",
                  ].join(" ")}
                >
                  <div className="text-xl font-semibold mb-4 text-center">{s.title}</div>
                  <div className="text-base text-zinc-200 whitespace-pre-wrap leading-relaxed">
                    {s.synopsis}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="absolute right-6 bottom-6 flex items-center gap-3">
          {warnOverwrite && pickable && (
            <span className="text-xs text-amber-400 mr-2">
              ⚠️ จะเขียนทับ title / prompt ที่คุณพิมพ์ไว้
            </span>
          )}
          <Button variant="secondary" onClick={onRegenerate} disabled={loading}>
            ↻ ขอใหม่
          </Button>
          <Button
            onClick={() => {
              if (selectedIndex !== null) onConfirm(suggestions[selectedIndex]);
            }}
            disabled={!pickable || selectedIndex === null}
          >
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}
