"use client";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useNovel } from "@/lib/store";
import { useReview } from "@/lib/review";
import {
  serializeToJson,
  serializeToMarkdown,
  parseNovelJson,
} from "@/lib/io";
import { Button } from "./ui/Button";
import { HelpPopover } from "./ui/HelpPopover";

function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function triggerDownload(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const MODEL_OPTIONS = [
  "anthropic/claude-sonnet-4.6",
  "anthropic/claude-opus-4.7",
  "openai/gpt-5.4",
  "google/gemini-3-flash-preview",
  "google/gemini-3.1-pro-preview",
] as const;

type Props = { open: boolean; onClose: () => void };

export function SettingsDrawer({ open, onClose }: Props) {
  const { novel, update, replace, reset } = useNovel();
  const { reviewing } = useReview();

  // Migrate stale stored model slugs (from earlier app versions) to a current one.
  useEffect(() => {
    if (!(MODEL_OPTIONS as readonly string[]).includes(novel.settings.model)) {
      update((n) => { n.settings.model = MODEL_OPTIONS[0]; });
    }
  }, [novel.settings.model, update]);

  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the user re-pick the same file
    if (!file) return;
    let text: string;
    try {
      text = await file.text();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Could not read file");
      return;
    }
    const result = parseNovelJson(text);
    if (!result.ok) {
      setImportError(result.error);
      return;
    }
    const ok = window.confirm(
      `Import "${file.name}"?\n\nThis will replace your current novel and cannot be undone.`,
    );
    if (!ok) return;
    replace(result.novel);
    setImportError(null);
    onClose();
  };

  const onReset = () => {
    const ok = window.confirm(
      "This deletes your story context, all saved chapters, and the current draft. This cannot be undone. Continue?",
    );
    if (ok) {
      reset();
      onClose();
    }
  };

  const promptFilename = (defaultName: string, ext: string): string | null => {
    const input = window.prompt("Save as:", defaultName);
    if (input === null) return null; // user cancelled
    const name = input.trim() || defaultName;
    return name.endsWith(ext) ? name : `${name}${ext}`;
  };

  const handleExportMd = () => {
    const filename = promptFilename(`novel-${today()}.md`, ".md");
    if (filename === null) return;
    triggerDownload(filename, serializeToMarkdown(novel), "text/markdown");
  };

  const handleExportJson = () => {
    const filename = promptFilename(`novel-backup-${today()}.json`, ".json");
    if (filename === null) return;
    triggerDownload(filename, serializeToJson(novel), "application/json");
  };

  return (
    <div
      className={`fixed inset-y-0 right-0 w-80 bg-zinc-900 border-l border-zinc-800 shadow-xl transform transition-transform z-20 ${
        open ? "translate-x-0" : "translate-x-full"
      } ${reviewing ? "pointer-events-none opacity-50" : ""}`}
      aria-hidden={!open}
    >
      <div className="p-4 flex items-center justify-between border-b border-zinc-800">
        <h2 className="font-semibold">Settings</h2>
        <Button variant="ghost" onClick={onClose} aria-label="Close settings">✕</Button>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <label className="block text-xs uppercase text-zinc-400 mb-1">
            Model
            <HelpPopover side="right" ariaLabel="Help: Model">
              เลือก AI ที่จะใช้ Generate:
              {"\n"}• Claude Sonnet 4.6 — สมดุลคุณภาพ/ความเร็ว/ค่าใช้จ่าย เหมาะกับงานประจำ
              {"\n"}• Claude Opus 4.7 — คุณภาพสูงสุด เข้าใจบริบทซับซ้อน ช้า+แพงกว่า เหมาะกับตอนสำคัญ
              {"\n"}• GPT-5.4 — สมดุลคุณภาพ/ความเร็ว เหมาะกับงานทั่วไป
              {"\n"}• Gemini 3 Flash — เร็ว ประหยัด เหมาะกับทดลอง/ร่างไว ๆ
              {"\n"}• Gemini 3.1 Pro — คุณภาพสูง รองรับ context ยาวมาก เหมาะกับนิยายที่บริบทเยอะ
              {"\n\n"}คำแนะนำเป็นค่าเริ่มต้น — ลองเองแล้วเลือกที่ถูกใจที่สุด
            </HelpPopover>
          </label>
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
            <HelpPopover side="right" ariaLabel="Help: Temperature">
              ควบคุมความหลากหลายของคำที่ AI เลือกใช้
              {"\n"}• 0-0.5 (ต่ำ): คาดเดาได้ คำคุ้นเคย
              {"\n"}• 0.6-0.9 (กลาง): สมดุล สร้างสรรค์+สอดคล้อง
              {"\n"}• 1.0-1.5 (สูง): สร้างสรรค์ แปลกใหม่ แต่เสี่ยงหลุดเรื่อง
              {"\n\n"}แนะนำเริ่มที่ 0.7-0.8
            </HelpPopover>
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

        <div>
          <label className="block text-xs uppercase text-zinc-400 mb-1">
            Output language
            <HelpPopover side="right" ariaLabel="Help: Output language">
              ภาษาที่ AI จะใช้เขียน เปลี่ยนได้ตลอด ไม่จำเป็นต้องตรงกับภาษาที่ใช้ใน Story Context
            </HelpPopover>
          </label>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="outputLanguage"
                value="en"
                checked={novel.settings.outputLanguage === "en"}
                onChange={() => update((n) => { n.settings.outputLanguage = "en"; })}
              />
              English
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="outputLanguage"
                value="th"
                checked={novel.settings.outputLanguage === "th"}
                onChange={() => update((n) => { n.settings.outputLanguage = "th"; })}
              />
              ไทย
            </label>
          </div>
        </div>

        <div>
          <label className="block text-xs uppercase text-zinc-400 mb-1">
            Target chapter length · {novel.settings.targetWords} words
            <HelpPopover side="right" ariaLabel="Help: Target chapter length">
              ความยาวโดยประมาณของแต่ละตอน (คำ) AI จะพยายามทำตาม แต่ไม่ตรงเป๊ะเสมอไป
            </HelpPopover>
          </label>
          <input
            type="range"
            min={500}
            max={3000}
            step={100}
            value={novel.settings.targetWords}
            onChange={(e) => update((n) => { n.settings.targetWords = parseInt(e.target.value, 10); })}
            className="w-full"
          />
        </div>

        <p className="text-xs text-zinc-500">
          API key lives in <code>.env.local</code> on the server.
        </p>
      </div>

      <div className="absolute bottom-0 inset-x-0 p-4 border-t border-zinc-800 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center">
            <Button variant="secondary" onClick={handleExportMd} className="flex-1">
              Export as .md
            </Button>
            <HelpPopover side="right" placement="top" ariaLabel="Help: Export as .md">
              ดาวน์โหลดเนื้อหานิยาย (Story Context + ทุกตอน) เป็นไฟล์ Markdown อ่านได้ในโปรแกรมทั่วไป (Obsidian, VSCode, Notion) เหมาะกับการส่งออกไปใช้ที่อื่น
            </HelpPopover>
          </div>
          <div className="flex items-center">
            <Button variant="secondary" onClick={handleExportJson} className="flex-1">
              Export backup
            </Button>
            <HelpPopover side="right" placement="top" ariaLabel="Help: Export backup">
              ดาวน์โหลดข้อมูลทั้งหมดเป็นไฟล์ JSON สำหรับสำรองข้อมูล นำเข้ากลับมาได้ภายหลัง — แนะนำสำรองเป็นระยะ นิยายของคุณสำคัญ
            </HelpPopover>
          </div>
        </div>
        <div className="flex items-center">
          <Button variant="secondary" className="flex-1" onClick={handleImportClick}>
            Import backup
          </Button>
          <HelpPopover side="right" placement="top" ariaLabel="Help: Import backup">
            นำเข้าไฟล์ JSON ที่เคย Export backup ไว้ คำเตือน: จะเขียนทับข้อมูลปัจจุบันทั้งหมด — ควร Export backup ของเดิมก่อนทุกครั้ง
          </HelpPopover>
        </div>
        {importError && (
          <p className="text-xs text-red-400" aria-live="polite">
            {importError}
          </p>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileSelected}
          className="hidden"
        />
        <Button variant="danger" className="w-full" onClick={onReset}>
          Start New Novel (Clear All Data)
        </Button>
      </div>
    </div>
  );
}
