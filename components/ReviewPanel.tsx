"use client";
import { useReview } from "@/lib/review";
import { Button } from "./ui/Button";
import { Textarea } from "./ui/Textarea";

type Props = {
  isEditing: boolean;
  onApprove: () => void;
  onCancel: () => void;
  onRetrySummary: () => void;
  onRetryLore: () => void;
};

export function ReviewPanel({ isEditing, onApprove, onCancel, onRetrySummary, onRetryLore }: Props) {
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

  const bothDone = isEditing
    ? state.summaryStatus !== "loading"
    : state.summaryStatus !== "loading" && state.loreStatus !== "loading";

  return (
    <section className="border border-amber-700 bg-amber-950/30 rounded p-4 space-y-4">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-300">
          {isEditing ? "ตรวจตอนที่แก้ไข" : "ตรวจก่อนบันทึกตอน"}
        </h2>
        <p className="text-xs text-zinc-400">
          AI ช่วยสรุปตอนนี้ และจดข้อมูลสำคัญไว้ ให้ตอนต่อ ๆ ไปเขียนได้ต่อเนื่อง — ตรวจแล้วกดยืนยันได้เลย
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs uppercase text-zinc-400">สรุปตอนนี้</label>
          {state.summaryStatus === "loading" && (
            <span className="text-xs text-zinc-500">กำลังสรุป…</span>
          )}
          {state.summaryStatus === "error" && (
            <button onClick={onRetrySummary} className="text-xs text-amber-400 underline">
              ลองสรุปใหม่
            </button>
          )}
        </div>
        <p className="text-xs text-zinc-500">ความจำย่อ ๆ ของตอนนี้ ใช้ตอนเขียนตอนถัดไป (แก้ได้)</p>
        {state.summaryStatus === "error" ? (
          <p className="text-xs text-red-300">
            สรุปไม่สำเร็จ — บันทึกได้โดยไม่มีสรุป
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

      {!isEditing && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs uppercase text-zinc-400">ข้อมูลใหม่</label>
            {state.loreStatus === "loading" && (
              <span className="text-xs text-zinc-500">กำลังดึงข้อมูล…</span>
            )}
            {state.loreStatus === "error" && (
              <button onClick={onRetryLore} className="text-xs text-amber-400 underline">
                ลองดึงใหม่
              </button>
            )}
          </div>
          <p className="text-xs text-zinc-500">
            AI ดึงข้อมูลสำคัญจากตอนนี้ (ชื่อตัวละคร สถานที่ ปมเรื่อง) · ติ๊ก = ให้ AI จำไว้ใช้ตอนต่อไป / เอาติ๊กออก = ไม่เก็บ
          </p>
          {state.loreStatus === "error" ? (
            <p className="text-xs text-red-300">
              ดึงข้อมูลไม่สำเร็จ — จะบันทึกตอนโดยไม่เพิ่มข้อมูลใหม่
            </p>
          ) : state.loreCandidates.length === 0 && state.loreStatus === "ready" ? (
            <p className="text-xs text-zinc-500 italic">ไม่มีข้อมูลใหม่จากตอนนี้</p>
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
      )}

      <div className="flex gap-2 pt-2 border-t border-amber-800">
        <Button onClick={onApprove} disabled={!bothDone}>
          {isEditing ? "บันทึกการแก้ไข" : "ยืนยันบันทึก"}
        </Button>
        <button onClick={onCancel} className="text-xs text-zinc-400 underline ml-auto">
          ยกเลิก
        </button>
      </div>
    </section>
  );
}
