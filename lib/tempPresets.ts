export type TempPreset = { key: string; label: string; value: number };

// Plain-language temperature presets shown to the user instead of a raw
// 0–1.5 number. Order matters: ascending temperature.
export const TEMP_PRESETS: TempPreset[] = [
  { key: "safe", label: "ปลอดภัย", value: 0.5 },
  { key: "balanced", label: "สมดุล", value: 0.8 },
  { key: "bold", label: "กล้าทดลอง", value: 1.1 },
];

// Which preset is "active" for a stored temperature. Boundaries sit at the
// midpoints between preset values so legacy/custom values light up the
// nearest button. (No data migration — temperature stays a number.)
export function activeTempPreset(temp: number): string {
  if (temp <= 0.65) return "safe";
  if (temp <= 0.95) return "balanced";
  return "bold";
}
