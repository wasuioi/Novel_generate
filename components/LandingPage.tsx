"use client";
import { Button } from "./ui/Button";

type Props = {
  onStart: () => void;
  returning?: boolean;
};

export function LandingPage({ onStart, returning = false }: Props) {
  return (
    <main className="min-h-screen flex items-start justify-center p-6 py-12 bg-zinc-950">
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
            <li>สร้างตอนใหม่ ใส่ <strong>ชื่อตอน</strong></li>
            <li>เขียน <strong>Chapter prompt</strong> — โครงสั้น ๆ ว่าตอนนี้จะเกิดอะไร (AI ใช้เป็นแนวในการร่าง)</li>
            <li>กด <strong>Generate</strong> → AI ร่างตอนให้ตามบริบท</li>
            <li>แก้ไขและเรียบเรียงด้วยตัวเองเสมอ ใส่สไตล์ของคุณลงไป</li>
            <li>พอใจแล้วกด <strong>Export as .md</strong> เก็บไฟล์ไว้ใช้ต่อ</li>
            <li>อย่าลืม <strong>Export backup</strong> (.json) เป็นระยะ กันข้อมูลหาย</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            เริ่มต้นด้วย Gemini 3 Flash
          </h2>
          <p className="text-sm leading-relaxed text-zinc-200">
            เว็บเริ่มต้นให้คุณด้วย <strong>Gemini 3 Flash</strong> — เร็ว ประหยัด เหมาะกับการทดลองและร่างไว ๆ ถ้าต้องการคุณภาพสูงกว่า (Claude, GPT, Gemini Pro) เปลี่ยนได้ใน <strong>Settings</strong> (ปุ่ม ⚙ ใน sidebar ด้านซ้าย)
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            ใน Settings ทำอะไรได้บ้าง
          </h2>
          <ul className="text-sm leading-relaxed text-zinc-200 list-disc pl-5 space-y-1">
            <li>เลือก <strong>AI Model</strong> (Claude / GPT / Gemini)</li>
            <li>ปรับ <strong>Temperature</strong> — ความสร้างสรรค์ของ AI</li>
            <li>เปลี่ยน <strong>ภาษา</strong> ที่ AI ใช้เขียน</li>
            <li>ตั้ง <strong>ความยาวตอน</strong> เป้าหมาย</li>
            <li><strong>Export / Import</strong> ข้อมูลนิยาย</li>
          </ul>
          <p className="text-xs text-zinc-400 pt-1">
            แต่ละช่องมีไอคอน <strong>?</strong> อธิบายเพิ่มเติม กดดูได้ในหน้า Settings
          </p>
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
