import { describe, expect, it } from "vitest";
import { DRUM_INSTRUMENTS, DRUM_PATTERNS, compileDrums, defaultDrums, synthesizeDrum, validAudioDrums } from "../src";
describe("bateria original de acompanhamento", () => {
  it("todos os estilos são distintos, compilam e cabem em 16 passos", () => {
    expect(new Set(DRUM_PATTERNS.map((p) => p.steps.join())).size).toBe(DRUM_PATTERNS.length);
    for (const p of DRUM_PATTERNS) expect(validAudioDrums(compileDrums({ ...defaultDrums, pattern: p.id }))).toBe(true);
  });
  it.each(DRUM_INSTRUMENTS)("%s: sinal determinístico, finito e com ataque/liberação", (instrument) => {
    for (const sr of [8000, 44100, 48000]) {
      const pcm = synthesizeDrum(instrument, sr);
      expect(pcm[0]).toBe(0);
      expect(Math.abs(pcm.at(-1)!)).toBeLessThan(.001);
      expect(pcm.some((x) => Math.abs(x) > .005)).toBe(true);
      expect(pcm.every((x) => Number.isFinite(x) && Math.abs(x) <= .4)).toBe(true);
      expect(synthesizeDrum(instrument, sr)).toEqual(pcm);
    }
  });
  it("recusa volume e padrões incompatíveis", () => {
    expect(() => compileDrums({ ...defaultDrums, volume: NaN })).toThrow();
    expect(validAudioDrums({ enabled: true, volume: .5, pattern: [32] })).toBe(false);
  });
});
