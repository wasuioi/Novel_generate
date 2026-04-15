"use client";
import { useNovel } from "@/lib/store";
import { Button } from "./ui/Button";

const MODEL_OPTIONS = [
  "anthropic/claude-sonnet-4.6",
  "anthropic/claude-opus-4.6",
  "openai/gpt-5.2",
  "google/gemini-3-flash-preview",
] as const;

type Props = { open: boolean; onClose: () => void };

export function SettingsDrawer({ open, onClose }: Props) {
  const { novel, update, reset } = useNovel();

  const onReset = () => {
    const ok = window.confirm(
      "This deletes your story context, all saved chapters, and the current draft. This cannot be undone. Continue?",
    );
    if (ok) {
      reset();
      onClose();
    }
  };

  return (
    <div
      className={`fixed inset-y-0 right-0 w-80 bg-zinc-900 border-l border-zinc-800 shadow-xl transform transition-transform z-20 ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
      aria-hidden={!open}
    >
      <div className="p-4 flex items-center justify-between border-b border-zinc-800">
        <h2 className="font-semibold">Settings</h2>
        <Button variant="ghost" onClick={onClose} aria-label="Close settings">✕</Button>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <label className="block text-xs uppercase text-zinc-400 mb-1">Model</label>
          <select
            value={novel.settings.model}
            onChange={(e) => update((n) => { n.settings.model = e.target.value; })}
            className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-sm"
          >
            {MODEL_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs uppercase text-zinc-400 mb-1">
            Temperature · {novel.settings.temperature.toFixed(1)}
          </label>
          <input
            type="range"
            min={0}
            max={1.5}
            step={0.1}
            value={novel.settings.temperature}
            onChange={(e) => update((n) => { n.settings.temperature = parseFloat(e.target.value); })}
            className="w-full"
          />
        </div>

        <p className="text-xs text-zinc-500">
          API key lives in <code>.env.local</code> on the server.
        </p>
      </div>

      <div className="absolute bottom-0 inset-x-0 p-4 border-t border-zinc-800">
        <Button variant="danger" className="w-full" onClick={onReset}>
          Start New Novel (Clear All Data)
        </Button>
      </div>
    </div>
  );
}
