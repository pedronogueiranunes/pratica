import { describe, expect, it } from "vitest";
import { chordVoicing, shapesFor, commonChordNames, synthesizeChordPreview, fretMidi } from "../src";

describe("altura, escrita e prévia de acordes", () => {
  it("E aberto: seis cordas, registros reais e oitava escrita da guitarra", () => {
    const v = chordVoicing(shapesFor("E").shapes[0]!)!;
    expect(v.notes.map((n) => n.midi)).toEqual([40, 47, 52, 56, 59, 64]);
    expect(v.notes.map((n) => n.label)).toEqual(["E2", "B2", "E3", "G#3", "B3", "E4"]);
    expect(v.notes[0]!.staffStep).toBe(-7);
    expect(v.notes.at(-1)!.staffStep).toBe(7);
  });
  it.each(["C#", "Db", "F#", "Gb", "Cb", "B#", "D°7", "C7(#9)", "C7(#11)", "D/F#", "G/B"])("%s mantém frequência e grafia coerentes", (name) => {
    const forms = shapesFor(name).shapes;
    expect(forms.length).toBeGreaterThan(0);
    for (const form of forms) {
      const v = chordVoicing(form)!;
      expect(v).not.toBeNull();
      for (const n of v.notes) expect(n.frequency).toBeCloseTo(440 * 2 ** ((n.midi - 69) / 12), 8);
    }
  });
  it("grafias que uma tabela simples de cromatismos perde", () => {
    expect(chordVoicing(shapesFor("F#").shapes[0]!)!.notes.some((n) => n.label.startsWith("A#"))).toBe(true);
    expect(chordVoicing(shapesFor("C#").shapes[0]!)!.notes.some((n) => n.label.startsWith("E#"))).toBe(true);
    expect(chordVoicing(shapesFor("D°7").shapes[0]!)!.notes.some((n) => n.label.startsWith("Cb"))).toBe(true);
  });
  it("todas as formas consagradas produzem alturas válidas sem incluir abafadas", () => {
    for (const name of commonChordNames()) for (const form of shapesFor(name).shapes) {
      const v = chordVoicing(form)!;
      expect(v, name).not.toBeNull();
      expect(v.notes.length).toBe(form.notes.length);
      expect(v.notes.every((n) => !form.muted?.includes(n.string))).toBe(true);
    }
  });
  it("recusa casas inválidas, cordas duplicadas e formas contraditórias", () => {
    const form = shapesFor("E").shapes[0]!;
    expect(fretMidi(6, -1)).toBeNull();
    expect(chordVoicing({ ...form, notes: [...form.notes, form.notes[0]!] })).toBeNull();
    expect(chordVoicing({ ...form, muted: [6] })).toBeNull();
  });
  it("envelope, limites de ganho e cancelamento da duração são finitos", () => {
    const data = synthesizeChordPreview([110, 220, 330, 440, 550, 660], 48000, 1);
    expect(data.length).toBe(67200);
    expect(data[0]).toBe(0);
    expect(Math.abs(data.at(-1)!)).toBeLessThan(0.0001);
    expect(data.every((x) => Number.isFinite(x) && Math.abs(x) <= 0.18)).toBe(true);
    expect(() => synthesizeChordPreview([NaN], 48000)).toThrow();
    expect(() => synthesizeChordPreview(Array(7).fill(440), 48000)).toThrow();
  });
});
