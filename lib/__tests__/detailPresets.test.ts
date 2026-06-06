import { describe, it, expect } from "vitest";
import { DETAIL_PRESETS, activeDetailPreset } from "@/lib/detailPresets";

describe("detailPresets", () => {
  it("has three presets in ascending length order", () => {
    expect(DETAIL_PRESETS.map((p) => p.key)).toEqual(["concise", "balanced", "detailed"]);
    const values = DETAIL_PRESETS.map((p) => p.value);
    expect(values).toEqual([...values].sort((a, b) => a - b));
  });

  it("maps each preset's own value back to itself", () => {
    for (const p of DETAIL_PRESETS) {
      expect(activeDetailPreset(p.value)).toBe(p.key);
    }
  });

  it("maps legacy/custom targetChars to the nearest preset", () => {
    expect(activeDetailPreset(3000)).toBe("concise");
    expect(activeDetailPreset(5000)).toBe("concise");
    expect(activeDetailPreset(6000)).toBe("balanced");
    expect(activeDetailPreset(9000)).toBe("balanced");
    expect(activeDetailPreset(12000)).toBe("detailed");
    expect(activeDetailPreset(20000)).toBe("detailed");
  });
});
