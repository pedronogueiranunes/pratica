import { describe, expect, it } from "vitest";
import { chordVoicing, fretPitch, fretboardPitches, fretFrequencies, identifyFretChord, scaleTones, selectFret, shapesFor } from "../src";

describe("braço completo e identificação exata", () => {
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
