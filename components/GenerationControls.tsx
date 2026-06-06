"use client";
import { useNovel } from "@/lib/store";
import { HelpPopover } from "./ui/HelpPopover";
import { MODEL_OPTIONS } from "@/lib/models";
import { TEMP_PRESETS, activeTempPreset } from "@/lib/tempPresets";

// Generation settings surfaced above the Generate button (model, creativity,
// length) so the user can see and change them every time — instead of hidden
// inside the Settings drawer.
export function GenerationControls() {
  const { novel, update } = useNovel();
  const { settings } = novel;
  const activePreset = activeTempPreset(settings.temperature);

  return (
    <div className="border border-zinc-800 rounded p-3 space-y-3 bg-zinc-900/40">
      <div className="text-xs uppercase tracking-wider text-zinc-400">ตั้งค่าการเขียน</div>

      <div>
        <label className="block text-xs uppercase text-zinc-400 mb-1">
          โมเดล
          <HelpPopover side="right" ariaLabel="Help: โมเดล">
            เลือก AI ที่จะใช้ Generate:
            {"\n"}• Claude Sonnet 4.6 — สมดุลคุณภาพ/ความเร็ว/ค่าใช้จ่าย
            {"\n"}• Claude Opus 4.7 — คุณภาพสูงสุด ช้า+แพงกว่า
            {"\n"}• GPT-5.4 — สมดุล เหมาะกับงานทั่วไป
            {"\n"}• Gemini 3 Flash — เร็ว ประหยัด เหมาะกับร่างไว ๆ
            {"\n"}• Gemini 3.1 Pro — คุณภาพสูง รองรับบริบทยาวมาก
          </HelpPopover>
        </label>
        <select
          value={settings.model}
          onChange={(e) => update((n) => { n.settings.model = e.target.value; })}
          className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-sm"
        >
          {MODEL_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-xs uppercase text-zinc-400 mb-1">
          ความสร้างสรรค์
          <HelpPopover side="right" ariaLabel="Help: ความสร้างสรรค์">
            สไตล์การเลือกคำของ AI:
            {"\n"}• ปลอดภัย — คำคุ้นเคย คาดเดาได้ เรื่องไม่ค่อยหลุด
            {"\n"}• สมดุล — สร้างสรรค์กำลังดี (แนะนำ)
            {"\n"}• กล้าทดลอง — แปลกใหม่ กล้าได้กล้าเสีย แต่เสี่ยงหลุดเรื่อง
          </HelpPopover>
        </label>
        <div className="flex gap-1">
          {TEMP_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={activePreset === p.key}
              onClick={() => update((n) => { n.settings.temperature = p.value; })}
              className={`flex-1 text-xs rounded px-2 py-1.5 border transition-colors ${
                activePreset === p.key
                  ? "bg-emerald-600 border-emerald-500 text-white"
                  : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs uppercase text-zinc-400 mb-1">
          ความยาว · {settings.targetChars} ตัวอักษร
          <HelpPopover side="right" ariaLabel="Help: ความยาว">
            ความยาวโดยประมาณของแต่ละตอน นับเป็นตัวอักษรรวมช่องว่าง
            {"\n\n"}• ตอนสั้น 3,000–5,000
            {"\n"}• ตอนกลาง 5,000–8,000
            {"\n"}• ตอนยาว 8,000–12,000
            {"\n"}• ยาวมาก 12,000–20,000 (ช้า+แพงขึ้น)
            {"\n\n"}AI จะพยายามทำตาม แต่ไม่ตรงเป๊ะเสมอไป
          </HelpPopover>
        </label>
        <input
          type="range"
          min={3000}
          max={20000}
          step={500}
          value={settings.targetChars}
          onChange={(e) => update((n) => { n.settings.targetChars = parseInt(e.target.value, 10); })}
          className="w-full"
        />
      </div>
    </div>
  );
}
