import { isKnownEvent, validateStoredEvent, validDate } from "./events";
import type { StoredEvent } from "./store";
import type { ChartRevision } from "./songs";

export const MAX_PACKAGE_BYTES = 25_000_000;
export const MAX_PACKAGE_EVENTS = 20_000;
export interface MusicPackage { format: "pratica.repertoire"; version: 1; exportedAt: string; events: StoredEvent[] }
export const isMusicEvent = (event: StoredEvent) => /^(song|playlist|chart)\./.test(event.type);
/** Mantém os eventos originais, inclusive tombstones e todas as pontas de cifra. */
export function createMusicPackage(events: StoredEvent[], at: string): MusicPackage {
  return validateMusicPackage({ format: "pratica.repertoire", version: 1, exportedAt: at, events: events.filter(isMusicEvent) });
}
export function validateMusicPackage(value: unknown): MusicPackage {
  if (!value || typeof value !== "object") throw new Error("Pacote de repertório inválido.");
  const p = value as MusicPackage;
  if (p.format !== "pratica.repertoire" || p.version !== 1 || !validDate(p.exportedAt) || !Array.isArray(p.events) || p.events.length > MAX_PACKAGE_EVENTS) throw new Error("Formato ou versão de pacote incompatível.");
  const ids = new Set<string>();
  for (const event of p.events) {
    validateStoredEvent(event);
    if (!isMusicEvent(event)) throw new Error("O pacote só pode conter músicas, playlists e cifras.");
    if (ids.has(event.id)) throw new Error("O pacote contém IDs de evento repetidos.");
    ids.add(event.id);
  }
  return p;
}
export function readMusicPackage(text: string): MusicPackage {
  if (new TextEncoder().encode(text).length > MAX_PACKAGE_BYTES) throw new Error("Pacote grande demais. O limite é 25 MB.");
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error("Não foi possível ler o JSON do repertório."); }
  return validateMusicPackage(parsed);
}
export function packageSummary(p: MusicPackage) {
  const count = (type: string, key: string) => new Set(p.events.filter((e) => e.type === type).map((e) => (e.data as Record<string, unknown>)[key])).size;
  return {
    songs: count("song.saved", "id"), playlists: count("playlist.saved", "id"), revisions: count("chart.revised", "revision"),
    deferred: p.events.filter((e) => !isKnownEvent(e)).length,
    deletions: p.events.filter((e) => (e.type === "song.saved" || e.type === "playlist.saved") && (e.data as { deleted?: boolean }).deleted).length,
  };
}
export function exportChordPro(revision: ChartRevision): string {
  return revision.chordpro.endsWith("\n") ? revision.chordpro : `${revision.chordpro}\n`;
}
export function downloadName(title: string, extension: "chordpro" | "json"): string {
  const base = title.normalize("NFC").replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().replace(/^[. ]+|[. ]+$/g, "").slice(0, 100);
  return `${base || "repertorio"}.${extension}`;
}
