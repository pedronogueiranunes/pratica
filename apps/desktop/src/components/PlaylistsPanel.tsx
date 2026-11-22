import { moveInList, playlistSongs, type Playlist } from "@gx/core";
import { useState } from "react";
import { useSongs } from "../lib/songs-state";

export function PlaylistsPanel({ openSong }: { openSong: (id: string) => void }) {
  const s = useSongs();
  const [confirm, setConfirm] = useState<string | null>(null);
  const draft = s.playlistDraft;
  const lists = s.playlists.filter((p) => !p.deleted);
  const songs = s.songs.filter((song) => !song.deleted);
  const set = (patch: Partial<Playlist>) => draft && s.setPlaylistDraft({ ...draft, ...patch });
  return <section className="panel playlists-panel" aria-label="Playlists">
    <div className="panel-head"><h2>Playlists</h2><span className="spacer" /><button className="btn" disabled={!!draft || s.playlistBusy || !s.ready} onClick={() => s.setPlaylistDraft({ id: crypto.randomUUID(), name: "", songIds: [] })}>Nova playlist</button></div>
    {!lists.length && !draft && <p className="muted">Monte uma playlist com as músicas do seu repertório.</p>}
    {!draft && <ul className="songs-items">{lists.map((p) => <li key={p.id} className="playlist-entry">
      <div><h3>{p.name}</h3><span className="muted small">{playlistSongs(p, songs).length} músicas disponíveis</span></div>
      <div className="actions"><button className="btn" disabled={s.playlistBusy} onClick={() => s.setPlaylistDraft(structuredClone(p))}>Editar {p.name}</button>
        {confirm === p.id ? <><span>Apagar playlist?</span><button className="btn" disabled={s.playlistBusy} onClick={() => void s.writePlaylist({ ...p, deleted: true })}>Confirmar</button><button className="btn ghost" disabled={s.playlistBusy} onClick={() => setConfirm(null)}>Cancelar</button></> : <button className="btn ghost" disabled={s.playlistBusy} onClick={() => setConfirm(p.id)}>Apagar</button>}
      </div>
      <ol>{playlistSongs(p, songs).map((song) => <li key={song.id}><button className="btn ghost" onClick={() => openSong(song.id)}>{song.title}</button></li>)}</ol>
    </li>)}</ul>}
    {draft && <form onSubmit={(e) => { e.preventDefault(); if (draft.name.trim()) void s.writePlaylist({ ...draft, name: draft.name.trim() }); }}>
      <fieldset disabled={s.playlistBusy} className="playlist-fields">
        <label className="field"><span className="label">Nome da playlist</span><input required maxLength={200} value={draft.name} onChange={(e) => set({ name: e.target.value })} autoFocus /></label>
        {!draft.songIds.length && <p className="muted">Adicione músicas abaixo.</p>}
        <ol className="playlist-order">{draft.songIds.map((id, i) => {
          const song = songs.find((x) => x.id === id);
          const title = song?.title ?? "Música indisponível";
          return <li key={id}><span>{title}</span><div className="actions">
            <button type="button" className="btn ghost" disabled={i === 0} aria-label={`Subir ${title}`} onClick={() => set({ songIds: moveInList(draft.songIds, i, i - 1) })}>Subir</button>
            <button type="button" className="btn ghost" disabled={i === draft.songIds.length - 1} aria-label={`Descer ${title}`} onClick={() => set({ songIds: moveInList(draft.songIds, i, i + 1) })}>Descer</button>
            <button type="button" className="btn ghost" aria-label={`Tirar ${title} da playlist`} onClick={() => set({ songIds: draft.songIds.filter((x) => x !== id) })}>Tirar</button>
          </div></li>;
        })}</ol>
        <label className="field"><span className="label">Adicionar música</span><select value="" onChange={(e) => { if (e.target.value) set({ songIds: [...draft.songIds, e.target.value] }); }}>
          <option value="">Escolha uma música</option>{songs.filter((song) => !draft.songIds.includes(song.id)).map((song) => <option key={song.id} value={song.id}>{song.title}{song.artist ? ` · ${song.artist}` : ""}</option>)}
        </select></label>
        <div className="actions"><button type="button" className="btn ghost" onClick={() => s.setPlaylistDraft(null)}>Cancelar</button><button type="submit" className="btn primary" disabled={!draft.name.trim()}>{s.playlistBusy ? "Salvando…" : "Salvar playlist"}</button></div>
      </fieldset>
    </form>}
    {s.playlistError && <p className="error-text" role="alert">{s.playlistError}</p>}
  </section>;
}
