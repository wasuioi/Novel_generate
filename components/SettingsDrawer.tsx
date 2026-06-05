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
import { MODEL_SLUGS } from "@/lib/models";

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

type Props = { open: boolean; onClose: () => void };

export function SettingsDrawer({ open, onClose }: Props) {
  const { novel, update, replace, reset } = useNovel();
  const { reviewing } = useReview();

  // Migrate stale stored model slugs (from earlier app versions) to a current one.
  useEffect(() => {
    if (!MODEL_SLUGS.includes(novel.settings.model)) {
      update((n) => { n.settings.model = MODEL_SLUGS[0]; });
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
      "คุณยืนยันที่จะลบเนื้อหาทั้งหมดไหม? ข้อมูลจะหายถาวร กู้คืนไม่ได้",
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
        <h2 className="font-semibold">ตั้งค่า</h2>
        <Button variant="ghost" onClick={onClose} aria-label="Close settings">✕</Button>
      </div>

      <div className="p-4 space-y-4">
        <p className="text-xs text-zinc-400">
          ตั้งค่าการเขียน (โมเดล · ความสร้างสรรค์ · ความยาว) ย้ายไปอยู่เหนือปุ่ม Generate แล้ว
        </p>
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
        <Button variant="danger" onClick={onReset} title="ลบเนื้อหาทั้งหมด เริ่มนิยายเรื่องใหม่">
          🗑 ลบทั้งหมด
        </Button>
      </div>
    </div>
  );
}
