import { describe, expect, it } from "vitest";
import { defaultDrums, shapesFor, validateSavedSequence, validateEvent, createMusicPackage, type SavedSequence } from "../src";
const at = "2026-11-23T12:00:00Z";
const saved: SavedSequence = { id: "loop", name: "Estudo", steps: [{ id: "one", diagram: shapesFor("C/E").shapes[0]!, beats: 2 }], bpm: 80, volume: .5, click: false, clickVolume: .4, drums: { ...defaultDrums, enabled: true }, updatedAt: at };
describe("sequências salvas", () => {
  it("forma, inversão e mixer sobrevivem à serialização", () => {
    const restored = JSON.parse(JSON.stringify(saved));
    expect(() => validateSavedSequence(restored)).not.toThrow();
    expect(restored.steps[0].diagram).toEqual(saved.steps[0]!.diagram);
    expect(() => validateSavedSequence({ ...saved, steps: [] })).not.toThrow();
  });
  it("valida forma, nome e limites antes de persistir", () => {
    for (const bad of [{ ...saved, name: " " }, { ...saved, bpm: 0 }, { ...saved, volume: Infinity }, { ...saved, steps: [{ ...saved.steps[0], diagram: { name: "C", notes: [] } }] }, { ...saved, updatedAt: "2026-02-30T12:00:00Z" }]) expect(() => validateSavedSequence(bad)).toThrow();
  });
  it("evento usa a mesma data e pacote inclui sequência e tombstone", () => {
    const event = { version: 1 as const, id: "save", deviceId: "device-a", type: "sequence.saved", at, data: saved };
    expect(() => validateEvent(event)).not.toThrow();
    expect(() => validateEvent({ ...event, at: "2026-11-24T12:00:00Z" })).toThrow();
    expect(createMusicPackage([event], at).events).toEqual([event]);
    expect(() => validateSavedSequence({ ...saved, deleted: true })).not.toThrow();
  });
});
