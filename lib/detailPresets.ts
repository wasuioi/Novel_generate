export type DetailPreset = { key: string; label: string; value: number };

// User-facing "detail level" presets. Each maps to a targetChars value (kept
// in the data model + prompt), but is shown as a plain level instead of a
// misleading character number — actual chapter length also depends on how many
// events the guidance describes, so the number is not a length guarantee.
export const DETAIL_PRESETS: DetailPreset[] = [
  { key: "concise", label: "กระชับ", value: 4000 },
  { key: "balanced", label: "สมดุล", value: 6000 },
  { key: "detailed", label: "ละเอียด", value: 12000 },
];

// Which preset is "active" for a stored targetChars (nearest by range), so
// legacy/custom values still light up a button. Boundaries are midpoints.
export function activeDetailPreset(targetChars: number): string {
  if (targetChars <= 5000) return "concise";
  if (targetChars <= 9000) return "balanced";
  return "detailed";
}
