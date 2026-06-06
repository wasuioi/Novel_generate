"use client";
import { useNovel } from "@/lib/store";
import { HelpPopover } from "./ui/HelpPopover";
import { MODEL_OPTIONS } from "@/lib/models";
import { TEMP_PRESETS, activeTempPreset } from "@/lib/tempPresets";
import { DETAIL_PRESETS, activeDetailPreset } from "@/lib/detailPresets";

// Generation settings surfaced above the Generate button (model, creativity,
// length) so the user can see and change them every time — instead of hidden
// inside the Settings drawer.
export function GenerationControls() {
  const { novel, update } = useNovel();
  const { settings } = novel;
  const activePreset = activeTempPreset(settings.temperature);
  const activeDetail = activeDetailPreset(settings.targetChars);

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
          ระดับรายละเอียด
          <HelpPopover side="right" ariaLabel="Help: ระดับรายละเอียด">
            AI จะเล่าละเอียดแค่ไหน — ไม่ใช่การันตีความยาว
            {"\n"}(ความยาวจริง = ระดับนี้ × จำนวนเหตุการณ์ที่ guidance บอก)
            {"\n\n"}• กระชับ — เล่าเร็ว ตรงประเด็น
            {"\n"}• สมดุล — กำลังดี (แนะนำ)
            {"\n"}• ละเอียด — บรรยายเยอะ ลงลึก
          </HelpPopover>
        </label>
        <div className="flex gap-1">
          {DETAIL_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={activeDetail === p.key}
              onClick={() => update((n) => { n.settings.targetChars = p.value; })}
              className={`flex-1 text-xs rounded px-2 py-1.5 border transition-colors ${
                activeDetail === p.key
                  ? "bg-emerald-600 border-emerald-500 text-white"
                  : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
