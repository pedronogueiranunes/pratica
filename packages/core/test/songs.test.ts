import { describe, expect, it } from "vitest";
import seed from "../../../data/repertoire.seed.json";
import { chartState, filterSongs, moveInList, playlistSongs, seedSongs, validateChartRevision, validateEvent, validatePlaylist, validateSong, type ChartRevision, type Song } from "../src";

const song = (over: Partial<Song> = {}): Song => ({ id: "s1", title: "Música", links: [], tracks: [], tags: [], ...over });
const rev = (revision: string, parentRevision?: string, createdAt = "2026-11-22T10:00:00Z"): ChartRevision =>
  ({ chartId: "c1", songId: "s1", revision, ...(parentRevision ? { parentRevision } : {}), chordpro: "[Am]x\n", importedFrom: "colado", createdAt });

describe("música", () => {
  it("aceita só o essencial", () => expect(() => validateSong(song())).not.toThrow());
  it("exige origem para BPM e tom", () => {
    expect(() => validateSong(song({ bpm: { value: 90, origin: { kind: "usuario" } }, key: { value: "Em", origin: { kind: "cifra" } } }))).not.toThrow();
    expect(() => validateSong(song({ bpm: { value: 90 } as never }))).toThrow();
    expect(() => validateSong(song({ key: { value: "Em7", origin: { kind: "usuario" } } }))).toThrow();
    expect(() => validateSong(song({ bpm: { value: 10, origin: { kind: "usuario" } } }))).toThrow();
  });
  it("valida compasso, capo, fase e links", () => {
    expect(() => validateSong(song({ timeSignature: "6/8", capo: 2, phase: 3, links: [{ kind: "origem", url: "https://exemplo.com/x" }] }))).not.toThrow();
    expect(() => validateSong(song({ timeSignature: "4" }))).toThrow();
    expect(() => validateSong(song({ capo: 13 }))).toThrow();
    expect(() => validateSong(song({ links: [{ kind: "origem", url: "javascript:alert(1)" }] }))).toThrow();
  });
  it("entra no envelope de eventos", () => {
    const e = { version: 1, id: "e1", deviceId: "d", at: "2026-11-22T10:00:00Z", type: "song.saved", data: song() };
    expect(() => validateEvent(e)).not.toThrow();
    expect(() => validateEvent({ ...e, data: { id: "s1" } })).toThrow();
  });
});

describe("playlist", () => {
  it("recusa música repetida", () => {
    expect(() => validatePlaylist({ id: "p", name: "Treino", songIds: ["a", "b"] })).not.toThrow();
    expect(() => validatePlaylist({ id: "p", name: "Treino", songIds: ["a", "a"] })).toThrow();
  });
  it("mantém a ordem e pula apagadas ou ausentes", () => {
    const songs = [song({ id: "a" }), song({ id: "b", deleted: true }), song({ id: "c" })];
    expect(playlistSongs({ id: "p", name: "x", songIds: ["c", "b", "z", "a"] }, songs).map((s) => s.id)).toEqual(["c", "a"]);
  });
  it("move itens sem mutar", () => {
    const list = ["a", "b", "c"];
    expect(moveInList(list, 0, 2)).toEqual(["b", "c", "a"]);
    expect(list).toEqual(["a", "b", "c"]);
    expect(moveInList(list, 0, 5)).toBe(list);
  });
});

describe("revisões de cifra", () => {
  it("valida revisão", () => {
    expect(() => validateChartRevision(rev("r1"))).not.toThrow();
    expect(() => validateChartRevision({ ...rev("r1"), parentRevision: "r1" })).toThrow();
    expect(() => validateChartRevision({ ...rev("r1"), chordpro: "x".repeat(200_001) })).toThrow();
  });
  it("linha reta não tem conflito", () => {
    const s = chartState([rev("r1"), rev("r2", "r1", "2026-11-22T11:00:00Z")]);
    expect(s.current?.revision).toBe("r2");
    expect(s.conflicts).toEqual([]);
  });
  it("duas edições sobre a mesma revisão viram conflito, a mais nova na frente", () => {
    const s = chartState([rev("r1"), rev("a", "r1", "2026-11-22T11:00:00Z"), rev("b", "r1", "2026-11-22T12:00:00Z")]);
    expect(s.current?.revision).toBe("b");
    expect(s.conflicts.map((r) => r.revision)).toEqual(["a"]);
  });
  it("resolver o conflito fecha as duas pontas", () => {
    const resolved = { ...rev("m", "b", "2026-11-22T13:00:00Z"), supersedes: ["a"] };
    const s = chartState([rev("r1"), rev("a", "r1"), rev("b", "r1"), resolved]);
    expect(s.current?.revision).toBe("m");
    expect(s.conflicts).toEqual([]);
    expect(() => validateChartRevision({ ...resolved, supersedes: ["m"] })).toThrow();
  });
});

describe("busca e semente", () => {
  const songs = [song({ id: "1", title: "Tudo O Que Você Podia Ser", artist: "Milton Nascimento", phase: 3 }), song({ id: "2", title: "No Mar", artist: "Natiruts", phase: 1, chartId: "c" })];
  it("busca sem acento e ordena por fase", () => {
    expect(filterSongs(songs, { query: "voce" }).map((s) => s.id)).toEqual(["1"]);
    expect(filterSongs(songs).map((s) => s.id)).toEqual(["2", "1"]);
    expect(filterSongs(songs, { withChart: true }).map((s) => s.id)).toEqual(["2"]);
  });
  it("semente só traz título, artista e fase, e não repete", () => {
    const all = seedSongs(seed, []);
    expect(all.length).toBe(12);
    expect(all.every((s) => !s.bpm && !s.key && !s.chartId)).toBe(true);
    expect(seedSongs(seed, all)).toEqual([]);
    expect(seedSongs(seed, [{ ...all[0]!, deleted: true }]).some((s) => s.id === all[0]!.id)).toBe(false);
  });
});
