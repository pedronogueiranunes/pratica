import type { PracticeRecord, Settings } from "./types";
import type { RoutineBlock } from "./routine";
import type { ChartImport, ChartRevision, Playlist, Song } from "./songs";

export interface LogRange { from?: string; to?: string; exerciseId?: string }
export interface SavedRoutine { id: string; name: string; blocks: RoutineBlock[] }
export type SettingsPatch = { [K in keyof Settings]?: Settings[K] extends object ? Partial<Settings[K]> : Settings[K] };
export interface PracticeStore {
  addLog(log: PracticeRecord): Promise<void>;
  listLogs(range?: LogRange): Promise<PracticeRecord[]>;
  countByExercise(): Promise<Record<string, number>>;
  saveRoutine(routine: SavedRoutine): Promise<void>;
  getRoutine(id: string): Promise<SavedRoutine | null>;
  getSettings(): Promise<Settings>;
  saveSettings(patch: SettingsPatch): Promise<void>;
}

/** A origem identifica quem escreveu. O horário da prática pode ser anterior ao evento. */
export interface PracticeEvent {
  version: 1;
  id: string;
  deviceId: string;
  at: string;
  type: "practice.added" | "settings.changed" | "routine.saved" | "song.saved" | "playlist.saved" | "chart.revised";
  data: unknown;
}
export interface SettingChange { key: string; value: unknown }
export interface StoreBackend {
  request(operation: string, data?: unknown): Promise<unknown>;
}

/** Dados para criar uma revisão; o repositório gera IDs e data. */
export interface ChartDraft {
  chartId?: string;
  songId: string;
  chordpro: string;
  importedFrom: ChartImport;
  sourceUrl?: string;
  parentRevision?: string;
  supersedes?: string[];
}
export interface SongStore {
  listSongs(): Promise<Song[]>;
  saveSong(song: Song): Promise<void>;
  listPlaylists(): Promise<Playlist[]>;
  savePlaylist(playlist: Playlist): Promise<void>;
  chartRevisions(chartId: string): Promise<ChartRevision[]>;
  /** Grava a revisão e devolve o que foi salvo. */
  reviseChart(draft: ChartDraft): Promise<ChartRevision>;
}
