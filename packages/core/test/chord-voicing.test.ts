import { describe, expect, it } from "vitest";
import { chordAtCapo, chordVoicing, shapesFor, commonChordNames, synthesizeChordPreview, fretMidi, compileChordSequence } from "../src";

describe("altura, escrita e prévia de acordes", () => {
  it("capo move alturas, grafia e sequência sem modificar a forma relativa", () => {
    const form = shapesFor("C").shapes[0]!;
    const before = structuredClone(form), actual = chordAtCapo(form, 2)!;
    expect(actual.name).toBe("D");
    expect(chordVoicing(actual)!.notes.map((n) => n.label)).toEqual(["D3", "F#3", "A3", "D4", "F#4"]);
    expect(compileChordSequence([{ id: "capo", diagram: actual, beats: 4 }])[0]!.frequencies).toEqual(chordVoicing(actual)!.frequencies);
    expect(form).toEqual(before);
    expect(chordAtCapo(form, 3)!.name).toBe("Eb");
    expect(chordVoicing(chordAtCapo(form, 3)!)!.notes.map((n) => n.label)).toEqual(["Eb3", "G3", "Bb3", "Eb4", "G4"]);
    expect(chordAtCapo(shapesFor("Cb").shapes[0]!, 0)!.name).toBe("Cb");
    expect(chordAtCapo(form, 0)).toEqual({ ...form, muted: form.muted, barre: form.barre });
  });
  it("capo preserva inversão e pestana e rejeita limites inválidos", () => {
    const inverse = chordAtCapo(shapesFor("C/E").shapes[0]!, 2)!;
    expect(inverse.name).toBe("D/F#");
    expect(chordVoicing(inverse)!.notes[0]!.label).toBe("F#3");
    const f = shapesFor("F").shapes[0]!;
    expect(chordAtCapo(f, 3)!.barre!.fret).toBe(f.barre!.fret + 3);
    for (const capo of [-1, .5, 13, NaN]) expect(chordAtCapo(f, capo)).toBeNull();
    expect(chordAtCapo({ ...f, notes: f.notes.map((n) => ({ ...n, fret: n.fret + 24 })) }, 2)).toBeNull();
  });
  it("formas do catálogo preservam todas as alturas ao subir o capo", () => {
    for (const name of commonChordNames()) for (const form of shapesFor(name).shapes) {
      const source = chordVoicing(form)!;
      for (const capo of [1, 2, 5, 7, 12]) {
        const actual = chordAtCapo(form, capo);
        if (form.notes.some((n) => n.fret + capo > 24)) { expect(actual).toBeNull(); continue; }
        expect(actual, `${name}, capo ${capo}`).not.toBeNull();
        expect(chordVoicing(actual!)!.notes.map((n) => n.midi)).toEqual(source.notes.map((n) => n.midi + capo));
      }
    }
  });
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
