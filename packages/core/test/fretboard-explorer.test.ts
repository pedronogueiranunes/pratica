import { describe, expect, it } from "vitest";
import { chordVoicing, detectedFretPositions, detectPitch, noteFromFrequency, rms, fretPitch, fretboardPitches, fretFrequencies, identifyFretChord, scaleTones, selectFret, shapesFor } from "../src";

describe("braço completo e identificação exata", () => {
  it.each([82.4069, 110, 220, 440, 880])("leva YIN sintético de %s Hz ao braço sem confundir oitavas", (frequency) => {
    const signal = Float32Array.from({ length: 4096 }, (_, i) => .25 * Math.sin(2 * Math.PI * frequency * i / 48000));
    const pitch = detectPitch(signal, 48000)!;
    const reading = noteFromFrequency(pitch.frequency)!;
    const positions = detectedFretPositions(true, reading, pitch.clarity, rms(signal));
    expect(positions.length).toBeGreaterThan(0);
    expect(positions).toEqual(fretboardPitches().filter((p) => p.midi === reading.midi).map(({ string, fret }) => ({ string, fret })));
    expect(positions.every((p) => fretPitch(p).midi === Math.round(69 + 12 * Math.log2(frequency / 440)))).toBe(true);
  });
  it("não adivinha a corda e respeita a referência Lá", () => {
    const reading = noteFromFrequency(442, 442)!;
    const positions = detectedFretPositions(true, reading, .99, .1);
    expect(positions).toHaveLength(5);
    expect(positions).toContainEqual({ string: 1, fret: 5 });
    expect(positions).not.toContainEqual({ string: 5, fret: 0 });
  });
  it("limpa parada, silêncio, sinal fraco, instabilidade e dados inválidos", () => {
    const note = noteFromFrequency(440)!;
    expect(detectedFretPositions(false, note, 1, .1)).toEqual([]);
    expect(detectedFretPositions(true, null, 1, .1)).toEqual([]);
    expect(detectedFretPositions(true, note, 1, .003)).toEqual([]);
    expect(detectedFretPositions(true, note, .84, .1)).toEqual([]);
    expect(detectedFretPositions(true, note, NaN, .1)).toEqual([]);
    expect(detectedFretPositions(true, note, 1, Infinity)).toEqual([]);
    expect(detectedFretPositions(true, { ...note, midi: 69.5 }, 1, .1)).toEqual([]);
    expect(detectedFretPositions(true, { ...note, cents: NaN }, 1, .1)).toEqual([]);
    expect(detectedFretPositions(true, noteFromFrequency(30), 1, .1)).toEqual([]);
    expect(detectedFretPositions(true, noteFromFrequency(2000), 1, .1)).toEqual([]);
  });
  it("mapeia 150 posições e duas oitavas por corda sem mudar a afinação", () => {
    const map = fretboardPitches(); expect(map).toHaveLength(150);
    expect(fretPitch({ string: 6, fret: 0 }).label).toBe("E2");
    expect(fretPitch({ string: 1, fret: 24 }).label).toBe("E6");
    for (const string of [1, 2, 3, 4, 5, 6] as const) expect(fretPitch({ string, fret: 24 }).midi - fretPitch({ string, fret: 0 }).midi).toBe(24);
    expect(() => fretPitch({ string: 6, fret: 25 })).toThrow();
  });
  it("mantém grafias teóricas e oitavas enarmônicas", () => {
    expect(fretPitch({ string: 2, fret: 1 }, false, "B#").label).toBe("B#3");
    expect(fretPitch({ string: 1, fret: 1 }, false, "C#").label).toBe("E#4");
    expect(fretPitch({ string: 2, fret: 2 }, true).label).toBe("Db4");
  });
  it("prévia usa a afinação escolhida e recusa notas simultâneas na mesma corda", () => {
    expect(fretFrequencies([{ string: 1, fret: 5 }], 442)[0]).toBe(442);
    expect(() => fretFrequencies([{ string: 1, fret: 5 }, { string: 1, fret: 7 }])).toThrow();
    expect(() => fretFrequencies([], 0)).toThrow();
  });
  it("seleciona uma nota por corda, substitui e desmarca sem mutar a origem", () => {
    const old = [{ string: 6 as const, fret: 3 }];
    expect(selectFret(old, { string: 6, fret: 5 })).toEqual([{ string: 6, fret: 5 }]);
    expect(selectFret(old, old[0]!)).toEqual([]); expect(old[0]!.fret).toBe(3);
    expect(() => selectFret([...old, ...old], { string: 5, fret: 2 })).toThrow();
  });
  it.each(["C", "Am", "G7", "C7M", "F#m7(b5)", "C/E", "D/F#", "E5"])("reconhece %s pelas notas completas e pelo baixo real", (name) => {
    const shape = shapesFor(name).shapes[0]!;
    const matches = identifyFretChord(shape.notes);
    expect(matches.some((m) => m.name === name)).toBe(true);
    for (const m of matches) expect(chordVoicing(m.diagram)).not.toBeNull();
  });
  it("preserva ambiguidades e não completa notas ausentes", () => {
    const selection = [{ string: 5 as const, fret: 3 }, { string: 4 as const, fret: 2 }, { string: 3 as const, fret: 2 }, { string: 2 as const, fret: 1 }, { string: 1 as const, fret: 3 }];
    const names = identifyFretChord(selection).map((m) => m.name);
    expect(names).toContain("C6"); expect(names).toContain("Am7/C");
    expect(identifyFretChord([{ string: 6, fret: 0 }])).toEqual([]);
    expect(identifyFretChord([{ string: 6, fret: 25 }])).toEqual([]);
    expect(identifyFretChord([{ string: 6, fret: 0 }, { string: 6, fret: 7 }])).toEqual([]);
  });
  it("escalas são intervalos de teoria, sem metadados de música", () => {
    expect(scaleTones("C", "major")!.pcs).toEqual([0, 2, 4, 5, 7, 9, 11]);
    expect(scaleTones("A", "minor-pentatonic")!.pcs).toEqual([9, 0, 2, 4, 7]);
    expect(scaleTones("D", "dorian")!.pcs).toEqual([2, 4, 5, 7, 9, 11, 0]);
    expect(scaleTones("H", "major")).toBeNull();
  });
});
