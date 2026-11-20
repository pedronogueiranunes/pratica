import { describe, expect, it } from "vitest";
import seed from "../../../data/exercises.seed.json";
import { detectPitch, exerciseVisual, fretWindow, noteFromFrequency, noteName, parseCatalog, synthesizeClick, CHORDS } from "../src";

const catalog = parseCatalog(seed);

describe("braço e tab", () => {
  it("todo visual aponta para um exercício que existe e tem tab", () => {
    const ids = new Set(catalog.exercicios.map((e) => e.id));
    const withVisual = catalog.exercicios.filter((e) => exerciseVisual(e.id));
    expect(withVisual.length).toBeGreaterThanOrEqual(15);
    for (const e of withVisual) {
      const v = exerciseVisual(e.id)!;
      expect(ids.has(e.id)).toBe(true);
      expect(v.tab.length).toBeGreaterThan(0);
      expect(v.diagrams.length).toBeGreaterThan(0);
    }
  });

  it("spider cobre 6 cordas x 4 casas, subindo e descendo", () => {
    const v = exerciseVisual("f1-spider")!;
    expect(v.tab).toHaveLength(48);
    expect(v.tab[0]!.notes[0]).toEqual({ string: 6, fret: 5 });
    expect(v.tab[23]!.notes[0]).toEqual({ string: 1, fret: 8 });
  });

  it("formas de acorde têm as notas certas", () => {
    const names = (d: typeof CHORDS.G) => [...new Set(d.notes.map((n) => noteName(n.string, n.fret)))].sort();
    expect(names(CHORDS.G)).toEqual(["B", "D", "G"]);
    expect(names(CHORDS.C)).toEqual(["C", "E", "G"]);
    expect(names(CHORDS.Am)).toEqual(["A", "C", "E"]);
    expect(names(CHORDS.F)).toEqual(["A", "C", "F"]);
    expect(names(CHORDS.Bm)).toEqual(["B", "D", "F#"]);
    expect(names(CHORDS.Cmaj7)).toEqual(["B", "C", "E", "G"]);
  });

  it("pentatônica de Lá menor só usa A C D E G nas 5 posições", () => {
    const v = exerciseVisual("f3-pentatonica-5-posicoes")!;
    for (const d of v.diagrams) {
      const set = new Set(d.notes.map((n) => noteName(n.string, n.fret)));
      expect([...set].sort()).toEqual(["A", "C", "D", "E", "G"]);
    }
  });

  it("dórico de Lá usa a sexta maior (F#)", () => {
    const d = exerciseVisual("f4-dorico")!.diagrams[0]!;
    const set = new Set(d.notes.map((n) => noteName(n.string, n.fret)));
    expect(set.has("F#")).toBe(true);
    expect(set.has("F")).toBe(false);
  });

  it("janela de casas", () => {
    expect(fretWindow([{ fret: 0 }, { fret: 3 }])).toEqual({ from: 1, to: 5 });
    expect(fretWindow([{ fret: 12 }, { fret: 15 }])).toEqual({ from: 12, to: 16 });
  });
});

describe("dsp do webapp", () => {
  it("YIN em TS acerta as cordas soltas", () => {
    const sr = 48000;
    for (const f of [82.41, 110, 196, 329.63]) {
      const buf = new Float32Array(4096).map((_, i) => {
        let s = 0;
        for (let h = 1; h <= 6; h++) s += Math.sin((2 * Math.PI * f * h * i) / sr) / h;
        return s * 0.3;
      });
      const est = detectPitch(buf, sr)!;
      expect(Math.abs(1200 * Math.log2(est.frequency / f))).toBeLessThan(2);
      expect(noteFromFrequency(est.frequency)!.cents).toBeLessThan(2);
    }
  });

  it("cliques sintetizados ficam abaixo de 0,91 de pico", () => {
    for (const s of ["madeira", "bip", "aro", "cowbell", "suave"] as const) {
      const c = synthesizeClick(s, "accent", 48000);
      expect(Math.max(...c.map(Math.abs))).toBeLessThanOrEqual(0.91);
    }
  });
});
