import { describe, expect, it } from "vitest";
import { chordIntervals, chordTones, commonChordNames, diagramMatches, generateShapes, shapesFor, type Diagram } from "../src";

const names = (root: number, iv: number[]) => iv.map((i) => ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][(root + i) % 12]).sort().join(" ");
const notesOf = (name: string) => { const t = chordTones(name)!; return names(t.root, t.intervals); };
const frets = (d: Diagram) => [6, 5, 4, 3, 2, 1].map((s) => d.notes.find((n) => n.string === s)?.fret ?? "x").join("");

describe("notas do acorde", () => {
  it.each([
    ["C", "C E G"], ["Am", "A C E"], ["E7", "B D E G#"], ["C7M", "B C E G"], ["Cmaj7", "B C E G"],
    ["Em7(9)", "B D E F# G"], ["Bm7", "A B D F#"], ["D°", "D F G#"], ["Bm7(b5)", "A B D F"], ["Bø", "A B D F"],
    ["Asus4", "A D E"], ["Dsus2", "A D E"], ["A4", "A D E"], ["C6", "A C E G"], ["Am6", "A C E F#"],
    ["G9", "A B D F G"], ["C(add9)", "C D E G"], ["Cadd9", "C D E G"], ["E5", "B E"], ["C+", "C E G#"],
    ["A7(4/9)", "A B D E G"], ["D7(b9)", "A C D D# F#"], ["Am(7M)", "A C E G#"], ["C6/9", "A C D E G"],
  ])("%s = %s", (name, expected) => expect(notesOf(name)).toBe(expected));
  it("recusa o que não entende, sem chutar", () => {
    expect(chordIntervals("xyz")).toBeNull();
    expect(chordTones("H7")).toBeNull();
  });
  it("baixo invertido", () => expect(chordTones("G/B")!.bass).toBe(11));
});

describe("formas", () => {
  it("toda forma da tabela confere com as notas do acorde", () => {
    for (const name of commonChordNames()) {
      const r = shapesFor(name);
      expect(r.source, name).toBe("tabela");
      expect(r.shapes.length, name).toBeGreaterThan(0);
      for (const d of r.shapes) expect(diagramMatches(d, chordTones(name)!), `${name} ${frets(d)}`).toBe(true);
    }
  });
  it("formas abertas conhecidas", () => {
    expect(frets(shapesFor("C").shapes[0]!)).toBe("x32010");
    expect(frets(shapesFor("Em7(9)").shapes[0]!)).toBe("022032");
    expect(frets(shapesFor("Cmaj7").shapes[0]!)).toBe("x32000");
    expect(shapesFor("F").shapes[0]!.barre).toMatchObject({ fret: 1, from: 6, to: 1 });
  });
  it("enarmônico usa a mesma forma", () => expect(shapesFor("A#").source).toBe("tabela"));
  it("gera formas tocáveis para acordes fora da tabela", () => {
    for (const name of ["Db7M", "Eb", "F#7", "G#m7", "Ab7(9)", "C#m7(b5)", "Bb7M", "D/F#", "G/B", "Fm7", "Eb7M(9)", "B7(13)"]) {
      const r = shapesFor(name);
      expect(r.shapes.length, name).toBeGreaterThan(0);
      for (const d of r.shapes) {
        expect(diagramMatches(d, chordTones(name)!), `${name} ${frets(d)}`).toBe(true);
        const fretted = d.notes.filter((n) => n.fret > 0).map((n) => n.fret);
        if (fretted.length) expect(Math.max(...fretted) - Math.min(...fretted), name).toBeLessThanOrEqual(3);
        expect(d.notes.length, name).toBeGreaterThanOrEqual(4);
        const fingers = new Set(d.notes.filter((n) => n.fret > 0).map((n) => n.finger));
        expect(fingers.size, name).toBeLessThanOrEqual(4);
      }
    }
  });
  it("baixo invertido fica na nota mais grave", () => {
    const d = shapesFor("D/F#").shapes[0]!;
    const lowest = [...d.notes].sort((a, b) => b.string - a.string)[0]!;
    expect(lowest.string === 6 ? lowest.fret % 12 : -1).toBe(2);
  });
  it("sem forma para nome desconhecido", () => {
    expect(shapesFor("Xm").source).toBe("nenhuma");
    expect(generateShapes("Q")).toEqual([]);
  });
});
