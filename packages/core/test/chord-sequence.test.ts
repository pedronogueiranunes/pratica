import { describe, expect, it } from "vitest";
import { compileChordSequence, sequenceAtBeat, shapesFor, validAudioSequence } from "../src";
describe("sequência de acordes", () => {
  const steps = [{ id: "a", diagram: shapesFor("C/E").shapes[0]!, beats: 1 }, { id: "b", diagram: shapesFor("G").shapes[0]!, beats: 2 }];
  it("compila a forma e afinação exatas, sem alterar a seleção", () => {
    const result = compileChordSequence(steps, 442);
    expect(validAudioSequence(result, .5)).toBe(true);
    expect(result[0]!.frequencies[0]).toBeCloseTo(442 * 2 ** ((52 - 69) / 12));
    expect(steps[0]!.diagram.name).toBe("C/E");
  });
  it("fronteiras, repetição e volta fora de um compasso inteiro", () => {
    expect([0, 1, 2, 3, 300001].map((beat) => sequenceAtBeat(steps, beat))).toEqual([
      { step: 0, beatsLeft: 1 }, { step: 1, beatsLeft: 2 }, { step: 1, beatsLeft: 1 }, { step: 0, beatsLeft: 1 }, { step: 1, beatsLeft: 2 },
    ]);
  });
  it("rejeita duração inválida, IDs repetidos, quantidade e ganho", () => {
    expect(() => compileChordSequence([])).toThrow();
    expect(() => compileChordSequence([...steps, steps[0]!])).toThrow();
    expect(() => compileChordSequence([{ ...steps[0]!, beats: 3 }])).toThrow();
    expect(() => compileChordSequence(Array.from({ length: 17 }, (_, i) => ({ ...steps[0]!, id: String(i) })))).toThrow();
    expect(validAudioSequence([{ beats: 4, frequencies: [NaN] }], .5)).toBe(false);
    expect(validAudioSequence([{ beats: 4, frequencies: [440] }], Infinity)).toBe(false);
    expect(sequenceAtBeat(steps, -1)).toBeNull();
  });
});
