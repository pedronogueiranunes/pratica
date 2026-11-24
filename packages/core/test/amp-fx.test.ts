import { describe, expect, it } from "vitest";
import { FX_PARAM_COUNT, FX_PEDALS, fxDefaults, fxFlatten, fxFormat, fxSanitize } from "../src";

// Cópia de DEFAULTS em crates/audio-engine/src/fx.rs. Se um mudar, o outro precisa mudar.
const RUST_DEFAULTS = [
  0, -60, 120,
  0, 0.4, 0.5, 0,
  0, 0, 0, 0,
  0, 0.4, 0.6, 0.3, 0.5,
  0, 0.25, 0.6, 0.4, 0.5,
  0, 0.8, 0.5, 0.5,
  0, 4, 0.5,
  0, 0, 380, 0.35, 0.7, 0.3,
  0, 1, 0.5, 0.4, 20, 0.25,
];

describe("pedais do amp", () => {
  it("tem o mesmo desenho do motor em Rust", () => {
    expect(FX_PARAM_COUNT).toBe(40);
    expect(fxFlatten(fxDefaults())).toEqual(RUST_DEFAULTS);
  });
  it("ids são únicos e todo parâmetro tem faixa válida", () => {
    expect(new Set(FX_PEDALS.map((p) => p.id)).size).toBe(FX_PEDALS.length);
    for (const p of FX_PEDALS) for (const x of p.params) { expect(x.min).toBeLessThan(x.max); expect(x.def).toBeGreaterThanOrEqual(x.min); expect(x.def).toBeLessThanOrEqual(x.max); }
  });
  it("sanitiza lixo, limita faixas e preserva o que é válido", () => {
    expect(fxSanitize(null)).toEqual(fxDefaults());
    const s = fxSanitize({ delay: { on: true, values: [2, 9999, "x", 0.5] }, reverb: "ruim" });
    expect(s.delay!.on).toBe(true);
    expect(s.delay!.values.slice(0, 3)).toEqual([2, 1000, 0.35]);
    expect(s.reverb).toEqual(fxDefaults().reverb);
    expect(fxFlatten(s)).toHaveLength(40);
  });
  it("formata valores", () => {
    const delay = FX_PEDALS.find((p) => p.id === "delay")!;
    expect(fxFormat(delay.params[0]!, 2)).toBe("Slapback");
    expect(fxFormat(delay.params[1]!, 380)).toBe("380 ms");
    expect(fxFormat(delay.params[2]!, 0.35)).toBe("35%");
  });
});
