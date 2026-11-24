import { describe, expect, it } from "vitest";
import { ChordStabilizer, ChromaSmoother, chromaFromSpectrum, lowestPitchClass, powerSpectrum, recognizeChords } from "../src";

const sr = 48000, n = 16384;
// Corda de violão: fundamental + parciais decrescentes, como numa palhetada.
const signal = (midis: number[]) => Float32Array.from({ length: n }, (_, i) => midis.reduce((sum, midi) => {
  const phase = 2 * Math.PI * 440 * 2 ** ((midi - 69) / 12) * i / sr;
  return sum + .1 * (Math.sin(phase) + .5 * Math.sin(2 * phase) + .3 * Math.sin(3 * phase) + .15 * Math.sin(4 * phase));
}, 0) / midis.length);
const listen = (midis: number[], flats = false) => {
  const powers = powerSpectrum(signal(midis));
  const chroma = chromaFromSpectrum(powers, sr, n, .1, 440, flats);
  const bass = lowestPitchClass(powers, sr, n, 440);
  return { chroma, bass, found: recognizeChords(chroma, bass, flats) };
};

describe("reconhecimento de acorde", () => {
  it.each([
    ["G", [43, 47, 50, 55, 59, 67]],
    ["C", [48, 52, 55, 60, 64]],
    ["Am", [45, 52, 57, 60, 64]],
    ["E", [40, 47, 52, 56, 59, 64]],
    ["Dm", [50, 57, 62, 65]],
    ["D7", [50, 57, 60, 66]],
  ])("reconhece %s como primeira opção", (name, midis) => {
    expect(listen(midis as number[]).found[0]?.name).toBe(name);
  });
  it("detecta a inversão pelo baixo", () => {
    const r = listen([40, 48, 52, 55, 60, 64]).found[0]!;
    expect(r.name).toBe("C/E");
    expect(r.inversion).toBe("1ª inversão");
    expect(listen([43, 48, 52, 55, 60]).found[0]).toMatchObject({ name: "C/G", inversion: "2ª inversão" });
  });
  it("o baixo desempata acordes com as mesmas notas", () => {
    expect(listen([40, 47, 50, 55, 59, 64]).found[0]?.name).toBe("Em7");
    expect(listen([43, 47, 52, 55, 64]).found[0]?.base).toBe("G6");
  });
  it("usa bemóis quando pedido", () => {
    expect(listen([46, 53, 58, 62, 65], true).found[0]?.name).toBe("Bb");
  });
  it("nota solta, duas notas e silêncio não viram acorde", () => {
    expect(listen([45]).found).toEqual([]);
    expect(listen([48, 55]).found).toEqual([]);
    expect(recognizeChords(null, null)).toEqual([]);
    expect(lowestPitchClass(new Float32Array(n / 2 + 1), sr, n)).toBeNull();
  });
  it("estabiliza: só confirma depois de leituras iguais e solta depois do silêncio", () => {
    const g = listen([43, 47, 50, 55, 59, 67]).found[0]!, c = listen([48, 52, 55, 60, 64]).found[0]!;
    const s = new ChordStabilizer(3, 1000);
    expect(s.push(g, 0).chord).toBeNull();
    expect(s.push(g, 100).chord).toBeNull();
    expect(s.push(g, 200)).toMatchObject({ chord: { name: "G" }, changed: true });
    expect(s.push(c, 300).chord?.name).toBe("G");
    s.push(c, 400);
    expect(s.push(c, 500)).toMatchObject({ chord: { name: "C" }, changed: true });
    expect(s.push(null, 900).chord?.name).toBe("C");
    expect(s.push(null, 1700)).toMatchObject({ chord: null, changed: true });
  });
  it('baixo fraco ou isolado não vira inversão', () => {
    const r = listen([50, 55, 59, 64, 71]).found[0];
    expect(r?.inversion === '3ª inversão' && r.name.startsWith('Em7')).toBe(false);
  });
  it('suavização faz média e voto do baixo', () => {
    const s = new ChromaSmoother(4);
    const a = Array.from({ length: 12 }, (_, i) => i === 0 ? 1 : 0), b = Array.from({ length: 12 }, (_, i) => i === 0 ? 0 : 0);
    s.push(a, 4); const out = s.push(b, 4);
    expect(out.values[0]).toBeCloseTo(.5);
    expect(out.bass).toBe(4);
    expect(new ChromaSmoother(4).push(a, null).bass).toBeNull();
  });
});
