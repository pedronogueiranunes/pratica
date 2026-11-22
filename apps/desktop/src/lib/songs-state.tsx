import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { seedSongs, type ChartDraft, type ChartRevision, type Playlist, type RepertoireSeed, type Song, type SongStore } from "@gx/core";
import seed from "../../../../data/repertoire.seed.json";
import { usePractice } from "./practice-state";

export interface SongDraft { song: Song; isNew: boolean }
export interface ImportDraft { songId: string; text: string; sourceUrl: string; fileName?: string; kind: "colado" | "chordpro" | "txt" | "manual" }

interface SongsState {
  songs: Song[];
  playlists: Playlist[];
  ready: boolean;
  error: string | null;
  selectedId: string | null;
  select: (id: string | null) => void;
  /** Rascunhos ficam acima das rotas: trocar de tela não perde o que foi digitado. */
  songDraft: SongDraft | null;
  setSongDraft: (draft: SongDraft | null) => void;
  importDraft: ImportDraft | null;
  setImportDraft: (draft: ImportDraft | null) => void;
  saveSong: (song: Song) => Promise<void>;
  savePlaylist: (playlist: Playlist) => Promise<void>;
  chartRevisions: (chartId: string) => Promise<ChartRevision[]>;
  reviseChart: (draft: ChartDraft) => Promise<ChartRevision>;
  /** Sobe a cada gravação ou sincronização, para as cifras abertas recarregarem. */
  version: number;
}
const Context = createContext<SongsState | null>(null);

export function SongsProvider({ children }: { children: ReactNode }) {
  const { store, ready: practiceReady } = usePractice();
  const songStore = store as unknown as SongStore | null;
  const [songs, setSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(() => { try { return localStorage.getItem("pratica.song"); } catch { return null; } });
  const [songDraft, setSongDraft] = useState<SongDraft | null>(null);
  const [importDraft, setImportDraft] = useState<ImportDraft | null>(null);

  const refresh = useCallback(async () => {
    if (!songStore) return;
    const [all, lists] = await Promise.all([songStore.listSongs(), songStore.listPlaylists()]);
    setSongs(all); setPlaylists(lists); setVersion((v) => v + 1);
  }, [songStore]);

  useEffect(() => {
    if (!songStore || !practiceReady) return;
    let active = true;
    (async () => {
      try {
        // IDs fixos e tombstones: a semente nunca duplica nem traz de volta o que foi apagado.
        const missing = seedSongs(seed as RepertoireSeed, await songStore.listSongs());
        for (const song of missing) await songStore.saveSong(song);
        if (active) { await refresh(); setReady(true); }
      } catch (e) { if (active) setError(`Não foi possível abrir suas músicas. ${String(e)}`); }
    })();
    const synced = () => void refresh();
    window.addEventListener("practice-synced", synced);
    return () => { active = false; window.removeEventListener("practice-synced", synced); };
  }, [songStore, practiceReady, refresh]);

  const written = useCallback(async () => { await refresh(); window.dispatchEvent(new Event("practice-written")); }, [refresh]);
  const need = () => { if (!songStore) throw new Error("Os dados ainda estão carregando."); return songStore; };
  const value: SongsState = {
    songs, playlists, ready, error, version, selectedId,
    select: (id) => { setSelectedId(id); try { if (id) localStorage.setItem("pratica.song", id); else localStorage.removeItem("pratica.song"); } catch {} },
    songDraft, setSongDraft, importDraft, setImportDraft,
    saveSong: async (song) => { await need().saveSong(song); await written(); },
    savePlaylist: async (playlist) => { await need().savePlaylist(playlist); await written(); },
    chartRevisions: (chartId) => need().chartRevisions(chartId),
    reviseChart: async (draft) => { const rev = await need().reviseChart(draft); await written(); return rev; },
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useSongs() {
  const value = useContext(Context);
  if (!value) throw new Error("useSongs fora do SongsProvider");
  return value;
}
