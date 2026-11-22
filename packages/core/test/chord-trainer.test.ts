import { describe, expect, it } from "vitest";
import { bpmForChangesPerMinute, changesPerMinute, trainerState } from "../src";

describe("troca de acordes", () => {
  const cfg = { chords: ["G", "C"], beatsPerChord: 4 };
  it("troca a cada N tempos e conta as trocas", () => {
    expect(trainerState(cfg, 0)).toMatchObject({ current: "G", next: "C", beatsLeft: 4, changes: 0 });
    expect(trainerState(cfg, 3)).toMatchObject({ current: "G", beatsLeft: 1, changes: 0 });
    expect(trainerState(cfg, 4)).toMatchObject({ current: "C", next: "G", beatsLeft: 4, changes: 1 });
    expect(trainerState(cfg, 9)).toMatchObject({ current: "G", changes: 2 });
  });
  it("percorre mais de dois acordes em ordem", () => {
    const three = { chords: ["Am", "E", "D"], beatsPerChord: 1 };
    expect([0, 1, 2, 3].map((b) => trainerState(three, b).current)).toEqual(["Am", "E", "D", "Am"]);
  });
  it("um acorde só não conta troca", () => expect(trainerState({ chords: ["E"], beatsPerChord: 1 }, 5).changes).toBe(0));
  it("sem acordes não quebra", () => expect(trainerState({ chords: [], beatsPerChord: 4 }, 3).current).toBeNull());
  it("trocas por minuto", () => {
    expect(changesPerMinute(15, 30_000)).toBe(30);
    expect(changesPerMinute(3, 5_000)).toBeNull();
    expect(bpmForChangesPerMinute(30, 2)).toBe(60);
  });
});
