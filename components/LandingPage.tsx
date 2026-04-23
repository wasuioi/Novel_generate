"use client";
import { Button } from "./ui/Button";

type Props = {
  onStart: () => void;
  returning?: boolean;
};

export function LandingPage({ onStart, returning = false }: Props) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-zinc-950">
      <div className="w-full max-w-xl space-y-6">
        <header className="text-center space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Novel_generate</h1>
          <p className="text-sm text-zinc-400">เว็บช่วยเขียนนิยายด้วย AI</p>
        </header>

        <hr className="border-zinc-800" />

        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            เว็บนี้ทำอะไร
          </h2>
          <p className="text-sm leading-relaxed text-zinc-200">
            Novel_generate คือเครื่องมือช่วยนักเขียนร่างและพัฒนานิยาย โดยใช้ AI สร้างเนื้อหาจากบริบทของเรื่องที่คุณสร้างขึ้น — ตัวละคร, โลก, โครงเรื่อง, และบทก่อนหน้า — เพื่อช่วยให้เขียนต่อได้ต่อเนื่องและสอดคล้องกับแนวเรื่อง
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            เกี่ยวกับ AI
          </h2>
          <p className="text-sm leading-relaxed text-zinc-200">
            AI ในเว็บนี้ทำงานโดยคำนวณคำที่ <em>น่าจะเป็น</em> ถัดไปจากรูปแบบภาษาที่เคยเห็น ไม่ใช่การ &quot;คิด&quot; หรือ &quot;เข้าใจ&quot; เนื้อเรื่องอย่างแท้จริง ผลลัพธ์เป็นเพียงเครื่องมือช่วยร่าง — ไม่สามารถทดแทนงานที่มีความเป็นเอกลักษณ์ของผู้เขียนได้ อารมณ์ สไตล์การเขียน มุมมองส่วนตัว และอื่น ๆ ยังคงเป็นสิ่งที่ AI ไม่มี แนะนำให้ใช้เป็นจุดเริ่มต้นแล้วเรียบเรียงด้วยตัวเองเสมอ
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            วิธีใช้แบบย่อ
          </h2>
          <ul className="text-sm leading-relaxed text-zinc-200 list-disc pl-5 space-y-1">
            <li>กรอก <strong>Story Context</strong> — ตัวละคร โลก แนวเรื่อง (ยิ่งละเอียด AI ยิ่งช่วยได้ตรง)</li>
            <li>สร้างตอนใหม่ ใส่ชื่อตอนและโครงสั้น ๆ</li>
            <li>กด <strong>Generate</strong> → AI ร่างตอนให้ตามบริบท</li>
            <li>แก้ไข/เรียบเรียงได้เสมอ และอย่าลืม <strong>Export backup</strong> เป็นระยะ</li>
          </ul>
        </section>

        <hr className="border-zinc-800" />

        <div className="flex justify-center pt-2">
          <Button onClick={onStart} className="px-6 py-2 text-base">
            {returning ? "กลับไปเขียน" : "เริ่มเขียนนิยาย"}
          </Button>
        </div>
      </div>
    </main>
  );
}
