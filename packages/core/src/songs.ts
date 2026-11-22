// Banco de músicas, playlists e cifras. Só dados e regras; nada de interface.
// BPM, tom e cifra vêm do Pedro, de um arquivo dele ou de uma fonte licenciada.
import type { TrackRef } from "./music-source";
import { validDate } from "./events";

export type DataOrigin =
  | { kind: "usuario" }
  | { kind: "arquivo"; name: string }
  | { kind: "cifra" }
  | { kind: "fonte"; source: string; attribution?: string };

export type LinkKind = "origem" | "youtube" | "spotify" | "outro";
export interface SongLink { kind: LinkKind; url: string; label?: string }

export interface Song {
  id: string;
  title: string;
  artist?: string;
  bpm?: { value: number; origin: DataOrigin };
  key?: { value: string; origin: DataOrigin };
  timeSignature?: string;
  capo?: number;
  links: SongLink[];
  tracks: TrackRef[];
  phase?: 1 | 2 | 3 | 4;
  tags: string[];
  notes?: string;
  /** Cifra ativa da música. */
  chartId?: string;
  deleted?: boolean;
}

export interface Playlist { id: string; name: string; songIds: string[]; deleted?: boolean }

export type ChartImport = "colado" | "chordpro" | "txt" | "manual";
/** Uma revisão de cifra. Imutável: editar cria outra revisão apontando para a anterior. */
export interface ChartRevision {
  chartId: string;
  songId: string;
  revision: string;
  parentRevision?: string;
  /** Outras pontas que esta revisão resolve, ao fechar um conflito. */
  supersedes?: string[];
  chordpro: string;
  importedFrom: ChartImport;
  sourceUrl?: string;
  createdAt: string;
}

export const MAX_CHART_CHARS = 200_000;
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const optText = (v: unknown) => v === undefined || typeof v === "string";
const httpUrl = (v: unknown) => {
  if (typeof v !== "string") return false;
  try { return ["http:", "https:"].includes(new URL(v).protocol); } catch { return false; }
};
const SOURCES = ["local", "youtube", "spotify", "jamendo", "audius", "soundcloud", "deezer"];
const KEY = /^[A-G][#b]?m?$/;
const TIME = /^(?:[1-9]|1[0-9])\/(?:2|4|8|16)$/;

function validOrigin(v: unknown): boolean {
  if (!obj(v)) return false;
  if (v.kind === "usuario" || v.kind === "cifra") return true;
  if (v.kind === "arquivo") return text(v.name);
  if (v.kind === "fonte") return text(v.source) && optText(v.attribution);
  return false;
}

export function validateSong(v: unknown): asserts v is Song {
  const fail = (m: string) => { throw new Error(`Música inválida: ${m}.`); };
  if (!obj(v) || !text(v.id) || !text(v.title)) fail("id ou título");
  const s = v as Record<string, unknown>;
  if (!optText(s.artist) || !optText(s.notes) || !optText(s.chartId)) fail("texto");
  if (s.bpm !== undefined) {
    const b = s.bpm as Record<string, unknown>;
    if (!obj(b) || typeof b.value !== "number" || !Number.isFinite(b.value) || b.value < 20 || b.value > 400 || !validOrigin(b.origin)) fail("BPM");
  }
  if (s.key !== undefined) {
    const k = s.key as Record<string, unknown>;
    if (!obj(k) || typeof k.value !== "string" || !KEY.test(k.value) || !validOrigin(k.origin)) fail("tom");
  }
  if (s.timeSignature !== undefined && (typeof s.timeSignature !== "string" || !TIME.test(s.timeSignature))) fail("compasso");
  if (s.capo !== undefined && !(Number.isInteger(s.capo) && (s.capo as number) >= 0 && (s.capo as number) <= 12)) fail("capo");
  if (s.phase !== undefined && ![1, 2, 3, 4].includes(s.phase as number)) fail("fase");
  if (!Array.isArray(s.links) || !s.links.every((l) => obj(l) && ["origem", "youtube", "spotify", "outro"].includes(String(l.kind)) && httpUrl(l.url) && optText(l.label))) fail("links");
  if (!Array.isArray(s.tracks) || !s.tracks.every((t) => obj(t) && SOURCES.includes(String(t.source)) && text(t.id) && text(t.title))) fail("faixas");
  if (!Array.isArray(s.tags) || !s.tags.every(text)) fail("tags");
  if (s.deleted !== undefined && typeof s.deleted !== "boolean") fail("exclusão");
}

export function validatePlaylist(v: unknown): asserts v is Playlist {
  if (!obj(v) || !text(v.id) || !text(v.name) || !Array.isArray(v.songIds) || !v.songIds.every(text) || new Set(v.songIds).size !== v.songIds.length || (v.deleted !== undefined && typeof v.deleted !== "boolean"))
    throw new Error("Playlist inválida.");
}

export function validateChartRevision(v: unknown): asserts v is ChartRevision {
  if (!obj(v) || !text(v.chartId) || !text(v.songId) || !text(v.revision) || !optText(v.parentRevision) || v.parentRevision === v.revision
    || (v.supersedes !== undefined && (!Array.isArray(v.supersedes) || !v.supersedes.every(text) || v.supersedes.includes(v.revision)))
    || typeof v.chordpro !== "string" || v.chordpro.length > MAX_CHART_CHARS || !["colado", "chordpro", "txt", "manual"].includes(String(v.importedFrom))
    || (v.sourceUrl !== undefined && !httpUrl(v.sourceUrl)) || !validDate(v.createdAt))
    throw new Error("Cifra inválida.");
}

/** Revisões que ninguém continuou. Mais de uma = edições concorrentes (conflito). */
export function chartHeads(revisions: ChartRevision[]): ChartRevision[] {
  const parents = new Set(revisions.flatMap((r) => [r.parentRevision, ...(r.supersedes ?? [])]).filter(Boolean));
  return revisions.filter((r) => !parents.has(r.revision)).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.revision.localeCompare(a.revision));
}

export interface ChartState {
  current: ChartRevision | null;
  /** Outras pontas abertas, mais nova primeiro. Vazio quando não há conflito. */
  conflicts: ChartRevision[];
}
export function chartState(revisions: ChartRevision[]): ChartState {
  const heads = chartHeads(revisions);
  return { current: heads[0] ?? null, conflicts: heads.slice(1) };
}

export interface SongFilter { query?: string; phase?: number; withChart?: boolean; includeDeleted?: boolean }
const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
export function filterSongs(songs: Song[], f: SongFilter = {}): Song[] {
  const q = f.query ? fold(f.query.trim()) : "";
  return songs
    .filter((s) => f.includeDeleted || !s.deleted)
    .filter((s) => f.phase === undefined || s.phase === f.phase)
    .filter((s) => f.withChart === undefined || Boolean(s.chartId) === f.withChart)
    .filter((s) => !q || fold(`${s.title} ${s.artist ?? ""} ${s.tags.join(" ")}`).includes(q))
    .sort((a, b) => (a.phase ?? 9) - (b.phase ?? 9) || a.title.localeCompare(b.title, "pt-BR"));
}

export function playlistSongs(p: Playlist, songs: Song[]): Song[] {
  const byId = new Map(songs.filter((s) => !s.deleted).map((s) => [s.id, s]));
  return p.songIds.flatMap((id) => byId.get(id) ?? []);
}

export function moveInList<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || from >= items.length || to < 0 || to >= items.length) return items;
  const out = [...items];
  const [it] = out.splice(from, 1);
  out.splice(to, 0, it!);
  return out;
}

export interface RepertoireSeed { musicas: { id: string; title: string; artist: string; phase?: number; tags?: string[] }[] }
/**
 * Músicas da semente que ainda não existem no banco. IDs fixos: dois Macs que
 * semeiam ao mesmo tempo gravam o mesmo conteúdo, e o LWW resolve sem duplicar.
 * Uma música apagada (tombstone) não volta.
 */
export function seedSongs(seed: RepertoireSeed, existing: Song[]): Song[] {
  const have = new Set(existing.map((s) => s.id));
  return seed.musicas.filter((m) => !have.has(m.id)).map((m) => {
    const song: Song = { id: m.id, title: m.title, artist: m.artist, links: [], tracks: [], tags: m.tags ?? [] };
    if (m.phase !== undefined) song.phase = m.phase as Song["phase"];
    validateSong(song);
    return song;
  });
}
