"use client";
import { useEffect } from "react";
import type { Message } from "@/lib/types";
import { Button } from "./ui/Button";

type Props = {
  open: boolean;
  onClose: () => void;
  messages: Message[];
};

export function PromptPreviewModal({ open, onClose, messages }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const labelFor = (role: Message["role"]) =>
    role === "system" ? "System message" : role === "user" ? "User message" : "Assistant message";

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Prompt preview"
    >
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 flex items-center justify-between border-b border-zinc-800">
          <div>
            <h2 className="font-semibold">Prompt preview</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              This is exactly what will be sent to the model when you click Generate.
            </p>
          </div>
          <Button variant="ghost" onClick={onClose} aria-label="Close preview">✕</Button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4">
          {messages.map((m, i) => (
            <div key={i} className="space-y-1">
              <div className="text-xs uppercase text-zinc-500">{labelFor(m.role)}</div>
              <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed border border-zinc-800 rounded p-3 bg-zinc-950 text-zinc-200">
                {m.content}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
