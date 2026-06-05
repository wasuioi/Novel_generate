import { describe, it, expect } from "vitest";
import { TEMP_PRESETS, activeTempPreset } from "@/lib/tempPresets";

describe("tempPresets", () => {
  it("has three presets in ascending temperature order", () => {
    expect(TEMP_PRESETS.map((p) => p.key)).toEqual(["safe", "balanced", "bold"]);
    const values = TEMP_PRESETS.map((p) => p.value);
    expect(values).toEqual([...values].sort((a, b) => a - b));
  });

  it("maps each preset's own value back to itself", () => {
    for (const p of TEMP_PRESETS) {
      expect(activeTempPreset(p.value)).toBe(p.key);
    }
  });

  it("maps legacy/custom temperatures to the nearest preset", () => {
    expect(activeTempPreset(0)).toBe("safe");
    expect(activeTempPreset(0.64)).toBe("safe");
    expect(activeTempPreset(0.7)).toBe("balanced");
    expect(activeTempPreset(0.95)).toBe("balanced");
    expect(activeTempPreset(1.0)).toBe("bold");
    expect(activeTempPreset(1.5)).toBe("bold");
  });
});
