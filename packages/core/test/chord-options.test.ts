import { describe, expect, it } from "vitest";
import { alternativeChordShapes, chordInversions, chordVariations, chordTones, chordVoicing } from "../src";

describe("inversões e formas alternativas", () => {
  it.each([
    ["C", ["C", "C/E", "C/G"]],
    ["Cm", ["Cm", "Cm/Eb", "Cm/G"]],
    ["C7", ["C7", "C7/E", "C7/G", "C7/Bb"]],
    ["F#", ["F#", "F#/A#", "F#/C#"]],
    ["Db7M", ["Db7M", "Db7M/F", "Db7M/Ab", "Db7M/C"]],
  ])("%s conserva o acorde e a grafia dos graus", (name, expected) => {
    expect(chordInversions(name as string).map((o) => o.name)).toEqual(expected);
  });
  it("preserva baixo explícito fora do acorde e variação digitada", () => {
    expect(chordInversions("C/D").map((o) => o.name)).toContain("C/D");
    expect(chordVariations("Em7(9)/B")[0]!.name).toBe("Em7(9)");
    expect(chordVariations("C").map((o) => o.name)).toContain("Cm");
  });
  it.each(["C", "C/E", "C/G", "Cm/Eb", "C7/Bb", "D/F#", "Db7M", "F#/A#", "G/B"])("%s: formas únicas, notas e baixo conferidos", (name) => {
    const forms = alternativeChordShapes(name);
    expect(forms.length).toBeGreaterThan(0);
    expect(forms.length).toBeLessThanOrEqual(6);
    const keys = forms.map((d) => JSON.stringify(d.notes.map((n) => [n.string, n.fret])));
    expect(new Set(keys).size).toBe(keys.length);
    for (const form of forms) {
      const voiced = chordVoicing(form)!;
      expect(voiced).not.toBeNull();
      expect(voiced.notes[0]!.midi % 12).toBe(chordTones(name)!.bass);
    }
  });
  it("mantém a forma conhecida na frente e oferece alternativas", () => {
    expect(alternativeChordShapes("E")[0]!.notes.map((n) => n.fret)).toEqual([0, 2, 2, 1, 0, 0]);
    expect(alternativeChordShapes("E").length).toBeGreaterThan(1);
  });
  it("recusa acordes desconhecidos sem preencher notas", () => {
    for (const name of ["", "X", "Cfoo", "C999"]) {
      expect(chordInversions(name)).toEqual([]);
      expect(chordVariations(name)).toEqual([]);
      expect(alternativeChordShapes(name)).toEqual([]);
    }
  });
});
