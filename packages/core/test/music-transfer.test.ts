import { describe, expect, it } from "vitest";
import { createMusicPackage, readMusicPackage, validateMusicPackage, packageSummary, exportChordPro, downloadName, type StoredEvent } from "../src";
const event = (id: string, type: string, data: unknown): StoredEvent => ({ version: 1, id, type, data, deviceId: "original-device", at: "2026-11-22T12:00:00Z" });
const song = { id: "song", title: "Teste", links: [], tracks: [], tags: [], deleted: true };
const revision = { songId: "song", chartId: "chart", revision: "r1", importedFrom: "manual" as const, chordpro: "[C]Texto neutro", createdAt: "2026-11-22T12:00:00Z" };
describe("transferência de repertório", () => {
  it("preserva IDs, autoria, tombstones e revisões, sem exportar ajustes ou práticas", () => {
    const events = [event("song", "song.saved", song), event("rev", "chart.revised", revision), event("list", "playlist.saved", { id: "list", name: "Treino", songIds: ["song"] }), event("settings", "settings.changed", []), event("practice", "practice.added", {})];
    const pack = createMusicPackage(events, "2026-11-22T12:00:00Z");
    expect(pack.events).toEqual(events.slice(0, 3));
    expect(readMusicPackage(JSON.stringify(pack))).toEqual(pack);
    expect(packageSummary(pack)).toEqual({ songs: 1, playlists: 1, revisions: 1, deferred: 0, deletions: 1 });
  });
  it("aceita eventos futuros do repertório sem aceitar dados conhecidos inválidos", () => {
    const future = event("future", "song.future", { opaque: true });
    const pack = createMusicPackage([future], "2026-11-22T12:00:00Z");
    expect(packageSummary(pack).deferred).toBe(1);
    expect(() => validateMusicPackage({ ...pack, events: [event("bad", "song.saved", {})] })).toThrow();
    expect(() => validateMusicPackage({ ...pack, events: [event("bad", "settings.changed", [])] })).toThrow();
    expect(() => validateMusicPackage({ ...pack, events: [future, future] })).toThrow();
    expect(() => validateMusicPackage({ ...pack, version: 2 })).toThrow();
    expect(() => readMusicPackage("{" )).toThrow();
  });
  it("exporta a cifra original e limpa nomes de arquivo", () => {
    expect(exportChordPro(revision)).toBe("[C]Texto neutro\n");
    expect(downloadName("../Teste: A/B", "chordpro")).toBe("Teste A B.chordpro");
    expect(downloadName("...", "json")).toBe("repertorio.json");
  });
});
