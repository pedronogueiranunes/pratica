import { useEffect, useMemo, useRef, useState } from "react";
import {
  exportChordPro, downloadName, chartState, filterSongs, parseChordPro, plainTextToChordPro, transposeDoc, transposeChord,
  type ChartRevision, type DataOrigin, type Song,
} from "@gx/core";
import { useSongs, type ImportDraft } from "../lib/songs-state";
import { MusicTransfer } from "../components/MusicTransfer";
import { downloadText } from "../lib/download";
import { PlaylistsPanel } from "../components/PlaylistsPanel";
import { ChordChart } from "../components/ChordChart";
import { SongChords } from "../components/SongChords";

const KEYS = ["C", "C#", "Db", "D", "Eb", "E", "F", "F#", "Gb", "G", "Ab", "A", "Bb", "B"];
const PHASES = [1, 2, 3, 4] as const;
const CHART_FILES = ".cho,.chordpro,.chopro,.pro,.crd,.txt";

function originLabel(o: DataOrigin) {
  if (o.kind === "usuario") return "informado por você";
  if (o.kind === "cifra") return "da cifra";
  if (o.kind === "arquivo") return `do arquivo ${o.name}`;
  return `de ${o.source}`;
}
const looksLikeChordPro = (text: string) => /^\s*\{[a-z_]+\s*(:|\})/im.test(text) || /\[[A-G][^\]\s]{0,8}\][^\s]/.test(text);
function toChordPro(draft: ImportDraft) {
  if (draft.kind === "chordpro" || draft.kind === "manual" || looksLikeChordPro(draft.text)) return { chordpro: draft.text.endsWith("\n") ? draft.text : `${draft.text}\n`, warnings: [] };
  return plainTextToChordPro(draft.text);
}
const emptySong = (): Song => ({ id: crypto.randomUUID(), title: "", links: [], tracks: [], tags: [] });

export function Songs() {
  const s = useSongs();
  const [mode, setMode] = useState<"songs" | "playlists">(() => s.playlistDraft ? "playlists" : "songs");
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState<number | "all">("all");
  const [chartOnly, setChartOnly] = useState(false);
  const list = useMemo(() => filterSongs(s.songs, { query, phase: phase === "all" ? undefined : phase, withChart: chartOnly ? true : undefined }), [s.songs, query, phase, chartOnly]);
  const visible = s.songs.filter((x) => !x.deleted);
  const selected = visible.find((x) => x.id === s.selectedId) ?? null;
  const editing = s.songDraft !== null;
  const importing = s.importDraft !== null && (s.importDraft.songId === selected?.id);

  const startNew = () => { setMode("songs"); s.setSongDraft({ song: emptySong(), isNew: true }); };
  return <div className="screen songs-screen">
    <header className="screen-head">
      <h1>Músicas</h1>
      <span className="sub">Seu repertório e as cifras que você salvou.</span>
      <div className="actions"><button className="btn" onClick={startNew}>Nova música</button></div>
    </header>
    {s.error && <p className="error-text" role="alert">{s.error}</p>}
    <MusicTransfer />
    <div className="seg songs-mode" role="group" aria-label="Repertório">
      <button aria-pressed={mode === "songs"} onClick={() => setMode("songs")}>Músicas</button>
      <button aria-pressed={mode === "playlists"} onClick={() => setMode("playlists")}>Playlists{s.playlistDraft ? " · editando" : ""}</button>
    </div>
    {mode === "playlists" ? <PlaylistsPanel openSong={(id) => { s.select(id); setMode("songs"); }} /> : <div className="songs-layout" data-focus={editing || selected ? "detail" : "list"}>
      <section className="panel songs-list" aria-label="Lista de músicas">
        <div className="songs-filters">
          <input type="search" placeholder="Buscar por música, artista ou estilo" aria-label="Buscar música" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="songs-filter-row">
            <select aria-label="Fase" value={phase} onChange={(e) => setPhase(e.target.value === "all" ? "all" : Number(e.target.value))}>
              <option value="all">Todas as fases</option>
              {PHASES.map((p) => <option key={p} value={p}>Fase {p}</option>)}
            </select>
            <label className="inline-check"><input type="checkbox" checked={chartOnly} onChange={(e) => setChartOnly(e.target.checked)} /> Só com cifra</label>
          </div>
        </div>
        <p className="muted small" role="status">{s.ready ? `${list.length} de ${visible.length} músicas` : "Carregando músicas…"}</p>
        {s.ready && !list.length && <div className="songs-none">
          {visible.length ? <><p>Nenhuma música com esses filtros.</p><button className="btn" onClick={() => { setQuery(""); setPhase("all"); setChartOnly(false); }}>Limpar filtros</button></>
            : <><p>Nenhuma música ainda.</p><button className="btn" onClick={startNew}>Adicionar a primeira</button></>}
        </div>}
        <ul className="songs-items">
          {list.map((song) => <li key={song.id}>
            <button className="song-item" aria-current={song.id === selected?.id ? "true" : undefined} onClick={() => { s.select(song.id); if (s.songDraft && !s.songDraft.isNew) s.setSongDraft(null); }}>
              <span className="song-item-title">{song.title}</span>
              <span className="song-item-artist">{song.artist ?? "Artista não informado"}</span>
              <span className="song-item-meta num">{song.phase ? `fase ${song.phase}` : "sem fase"}{song.chartId ? " · cifra" : ""}</span>
            </button>
          </li>)}
        </ul>
      </section>
      <section className="panel song-detail" aria-label="Música">
        {(editing || selected) && <button className="btn ghost songs-back" onClick={() => { if (s.songDraft) s.setSongDraft(null); else if (s.importDraft) s.setImportDraft(null); else s.select(null); }}>Voltar para a lista</button>}
        {editing ? <SongEditor />
          : !selected ? <div className="songs-none"><p>Escolha uma música na lista.</p></div>
          : importing ? <ChartImporter song={selected} />
          : <SongView song={selected} />}
      </section>
    </div>}
  </div>;
}

function SongView({ song }: { song: Song }) {
  const s = useSongs();
  const [revisions, setRevisions] = useState<ChartRevision[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [shift, setShift] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setShift(0); setConfirmDelete(false); setComparing(false); setError(null); }, [song.id]);
  useEffect(() => {
    let active = true;
    if (!song.chartId) { setRevisions([]); return; }
    s.chartRevisions(song.chartId).then((r) => { if (active) { setRevisions(r); setLoadError(null); } }).catch((e) => active && setLoadError(String(e)));
    return () => { active = false; };
  }, [song.chartId, s.version]);
  const state = useMemo(() => chartState(revisions), [revisions]);
  const doc = useMemo(() => state.current ? transposeDoc(parseChordPro(state.current.chordpro), shift) : null, [state.current, shift]);
  const capo = song.capo ?? doc?.meta.capo ?? 0;
  const key = song.key ? (shift ? `${song.key.value} → ${transposeChord(song.key.value, shift)}` : song.key.value) : null;

  const openImport = (kind: ImportDraft["kind"], text = "") => s.setImportDraft({ songId: song.id, chartId: song.chartId, parentRevision: state.current?.revision, text, sourceUrl: song.links.find((l) => l.kind === "origem")?.url ?? "", kind });
  const resolve = async (keep: ChartRevision) => {
    if (!state.current || !song.chartId) return;
    setBusy(true); setError(null);
    try {
      await s.reviseChart({ chartId: song.chartId, songId: song.id, chordpro: keep.chordpro, importedFrom: "manual", parentRevision: state.current.revision, supersedes: state.conflicts.map((r) => r.revision), sourceUrl: keep.sourceUrl });
      setComparing(false);
    } catch (e) { setError(`Não deu para salvar a escolha. ${String(e)}`); } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await s.saveSong({ ...song, deleted: true }); s.select(null); } catch (e) { setError(`Não deu para apagar. ${String(e)}`); setBusy(false); }
  };
  return <div className="song-view">
    <div className="song-head">
      <div>
        <h2 className="song-title">{song.title}</h2>
        <p className="song-artist">{song.artist ?? "Artista não informado"}</p>
      </div>
      <div className="song-actions">
        <button className="btn" onClick={() => s.setSongDraft({ song: structuredClone(song), isNew: false })}>Editar</button>
        {!confirmDelete ? <button className="btn ghost" onClick={() => setConfirmDelete(true)}>Apagar</button>
          : <span className="song-confirm" role="group" aria-label="Confirmar exclusão">Apagar música e cifra?
              <button className="btn" disabled={busy} onClick={remove}>Apagar</button>
              <button className="btn ghost" onClick={() => setConfirmDelete(false)}>Cancelar</button></span>}
      </div>
    </div>
    <dl className="song-facts">
      <div><dt>Tom</dt><dd className="num">{key ?? "não informado"}{song.key && !shift && <span className="song-origin">{originLabel(song.key.origin)}</span>}</dd></div>
      <div><dt>BPM</dt><dd className="num">{song.bpm?.value ?? "não informado"}{song.bpm && <span className="song-origin">{originLabel(song.bpm.origin)}</span>}</dd></div>
      <div><dt>Compasso</dt><dd className="num">{song.timeSignature ?? "não informado"}</dd></div>
      <div><dt>Capo</dt><dd className="num">{capo ? `casa ${capo}` : "sem capo"}</dd></div>
      <div><dt>Fase</dt><dd className="num">{song.phase ?? "sem fase"}</dd></div>
    </dl>
    {song.links.length > 0 && <ul className="song-links">{song.links.map((l) => <li key={l.url}><a href={l.url} target="_blank" rel="noreferrer">{l.label || (l.kind === "origem" ? "Cifra original" : new URL(l.url).hostname)}</a></li>)}</ul>}
    {song.notes && <p className="song-notes">{song.notes}</p>}
    {error && <p className="error-text" role="alert">{error}</p>}
    {loadError && <p className="error-text" role="alert">Não deu para abrir a cifra. {loadError}</p>}

    <div className="chart-head">
      <h3>Cifra</h3>
      {doc && <div className="chart-tools">
        <span className="muted small">Transpor</span>
        <div className="seg" role="group" aria-label="Transpor">
          <button aria-label="Meio tom abaixo" onClick={() => setShift((v) => Math.max(-11, v - 1))}>−</button>
          <button aria-pressed={shift === 0} onClick={() => setShift(0)} className="num">{shift > 0 ? `+${shift}` : shift}</button>
          <button aria-label="Meio tom acima" onClick={() => setShift((v) => Math.min(11, v + 1))}>+</button>
        </div>
        <button className="btn" onClick={() => downloadText(downloadName(song.title, "chordpro"), exportChordPro(state.current!), "text/plain;charset=utf-8")}>Exportar ChordPro</button>
        <button className="btn" onClick={() => openImport("manual", state.current!.chordpro)}>Editar cifra</button>
        <button className="btn ghost" onClick={() => openImport("colado")}>Substituir</button>
      </div>}
    </div>
    {state.conflicts.length > 0 && <div className="notice chart-conflict" role="status">
      <span>Esta cifra foi editada em dois lugares. Escolha qual versão fica.</span><span className="spacer" />
      <button className="btn" onClick={() => setComparing((v) => !v)}>{comparing ? "Fechar comparação" : "Comparar"}</button>
    </div>}
    {comparing && state.conflicts.length > 0 && state.current && <div className="chart-compare">
      <div><div className="chart-compare-head"><span>Esta versão</span><button className="btn" disabled={busy} onClick={() => resolve(state.current!)}>Ficar com esta</button></div><ChordChart doc={parseChordPro(state.current.chordpro)} label="Versão atual" /></div>
      {state.conflicts.map((revision, i) => <div key={revision.revision}><div className="chart-compare-head"><span>Outra versão {i + 1} · {new Date(revision.createdAt).toLocaleString("pt-BR")}</span><button className="btn" aria-label={`Ficar com a outra versão ${i + 1}`} disabled={busy} onClick={() => resolve(revision)}>Ficar com esta</button></div><ChordChart doc={parseChordPro(revision.chordpro)} label={`Outra versão ${i + 1}`} /></div>)}
    </div>}
    {!comparing && (doc ? <>
      <SongChords key={`${song.id}:${shift}:${state.current?.revision}:${capo}`} doc={doc} label={`Cifra de ${song.title}`} capo={capo} />
    </> : song.chartId && !revisions.length && !loadError ? <p className="muted">Abrindo a cifra…</p>
      : <div className="chart-empty">
        <p>Sem cifra ainda. Cole do site que você usa ou abra um arquivo ChordPro. Ela fica salva aqui e abre sem internet.</p>
        <button className="btn primary" onClick={() => openImport("colado")}>Adicionar cifra</button>
      </div>)}
  </div>;
}

function ChartImporter({ song }: { song: Song }) {
  const s = useSongs();
  const draft = s.importDraft!;
  const set = (patch: Partial<ImportDraft>) => s.setImportDraft({ ...draft, ...patch });
  const fileRef = useRef<HTMLInputElement>(null);
  const [useMeta, setUseMeta] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const result = useMemo(() => draft.text.trim() ? toChordPro(draft) : null, [draft.text, draft.kind]);
  const doc = useMemo(() => result ? parseChordPro(result.chordpro) : null, [result]);
  const fills = doc ? { key: !song.key && doc.meta.key && /^[A-G][#b]?m?$/.test(doc.meta.key) ? doc.meta.key : undefined, bpm: !song.bpm && doc.meta.tempo && doc.meta.tempo >= 20 && doc.meta.tempo <= 400 ? doc.meta.tempo : undefined } : {};
  const sourceOk = !draft.sourceUrl || /^https?:\/\/\S+\.\S+/.test(draft.sourceUrl);

  const readFile = async (file: File) => {
    if (file.size > 400_000) { setError("Arquivo grande demais para uma cifra."); return; }
    const text = await file.text();
    set({ text, fileName: file.name, kind: /\.txt$/i.test(file.name) ? "txt" : "chordpro" });
    setError(null);
  };
  const save = async () => {
    if (!result) return;
    setSaving(true); setError(null);
    try {
      const rev = await s.reviseChart({ chartId: draft.chartId, songId: song.id, chordpro: result.chordpro, importedFrom: draft.kind, sourceUrl: draft.sourceUrl || undefined, parentRevision: draft.parentRevision });
      const origin: DataOrigin = draft.fileName ? { kind: "arquivo", name: draft.fileName } : { kind: "cifra" };
      const next: Song = { ...song, chartId: rev.chartId };
      if (useMeta && fills.key) next.key = { value: fills.key, origin };
      if (useMeta && fills.bpm) next.bpm = { value: fills.bpm, origin };
      if (draft.sourceUrl && !song.links.some((l) => l.url === draft.sourceUrl)) next.links = [...song.links, { kind: "origem", url: draft.sourceUrl }];
      if (JSON.stringify(next) !== JSON.stringify(song)) await s.saveSong(next);
      s.setImportDraft(null);
    } catch (e) { setError(`Não deu para salvar a cifra. ${String(e)}`); } finally { setSaving(false); }
  };
  const editingExisting = draft.kind === "manual";
  return <div className="chart-import">
    <div className="song-head">
      <div><h2 className="song-title">{editingExisting ? "Editar cifra" : "Adicionar cifra"}</h2><p className="song-artist">{song.title}</p></div>
    </div>
    {!editingExisting && <div className="chart-import-source">
      <p className="muted small">Cole a cifra com os acordes em cima da letra, como aparece nos sites, ou abra um arquivo ChordPro ou texto.</p>
      <button className="btn" onClick={() => fileRef.current?.click()}>Abrir arquivo</button>
      <input ref={fileRef} type="file" accept={CHART_FILES} hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void readFile(f); e.target.value = ""; }} />
      {draft.fileName && <span className="tag">{draft.fileName}</span>}
    </div>}
    <div className="chart-import-grid">
      <label className="chart-input">
        <span className="sr-only">Texto da cifra</span>
        <textarea spellCheck={false} value={draft.text} placeholder={"[Intro] Em  D  C  B7\n\nEm              D\nPrimeira linha da letra"} onChange={(e) => set({ text: e.target.value, ...(draft.fileName ? {} : {}) })} />
      </label>
      <div className="chart-preview" aria-live="polite">
        {doc ? <>
          <p className="muted small">Prévia{result!.warnings.length ? ` · confira ${result!.warnings.length === 1 ? "1 linha" : `${result!.warnings.length} linhas`}` : ""}</p>
          {result!.warnings.map((w) => <p key={w.line} className="small error-text">Linha {w.line}: {w.message}</p>)}
          <ChordChart doc={doc} label="Prévia da cifra" />
        </> : <p className="muted">A prévia aparece aqui.</p>}
      </div>
    </div>
    {!editingExisting && <label className="field chart-source"><span className="label">Link de origem</span>
      <input type="text" inputMode="url" placeholder="https://" value={draft.sourceUrl} onChange={(e) => set({ sourceUrl: e.target.value.trim() })} aria-invalid={!sourceOk} />
    </label>}
    {!sourceOk && <p className="small error-text">O link precisa começar com http:// ou https://.</p>}
    {(fills.key || fills.bpm) && <label className="inline-check chart-meta"><input type="checkbox" checked={useMeta} onChange={(e) => setUseMeta(e.target.checked)} />
      Usar {[fills.key && `tom ${fills.key}`, fills.bpm && `${fills.bpm} bpm`].filter(Boolean).join(" e ")} da cifra nesta música</label>}
    {error && <p className="error-text" role="alert">{error}</p>}
    <div className="chart-import-foot">
      <button className="btn ghost" onClick={() => s.setImportDraft(null)}>Cancelar</button>
      <button className="btn primary" disabled={!result || saving || !sourceOk} onClick={save}>{saving ? "Salvando…" : "Salvar cifra"}</button>
    </div>
  </div>;
}

function SongEditor() {
  const s = useSongs();
  const { song, isNew } = s.songDraft!;
  const original = isNew ? null : s.songs.find((x) => x.id === song.id) ?? null;
  const set = (patch: Partial<Song>) => s.setSongDraft({ song: { ...song, ...patch }, isNew });
  const [bpmText, setBpmText] = useState(song.bpm ? String(song.bpm.value) : "");
  const [tagsText, setTagsText] = useState(song.tags.join(", "));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const origin = song.links.find((l) => l.kind === "origem")?.url ?? "";
  const bpm = bpmText.trim() ? Number(bpmText.replace(",", ".")) : null;
  const bpmOk = bpm === null || (Number.isFinite(bpm) && bpm >= 20 && bpm <= 400);
  const linkOk = !origin || /^https?:\/\/\S+\.\S+/.test(origin);
  const titleOk = song.title.trim().length > 0;

  const save = async () => {
    const next: Song = { ...song, title: song.title.trim(), tags: tagsText.split(",").map((t) => t.trim()).filter(Boolean) };
    if (!next.artist?.trim()) delete next.artist; else next.artist = next.artist.trim();
    if (!next.notes?.trim()) delete next.notes;
    // Se o valor não mudou, a origem antiga continua valendo (cifra, arquivo).
    if (bpm === null) delete next.bpm;
    else next.bpm = original?.bpm?.value === bpm ? original.bpm : { value: bpm, origin: { kind: "usuario" } };
    setSaving(true); setError(null);
    try { await s.saveSong(next); s.select(next.id); s.setSongDraft(null); }
    catch (e) { setError(`Não deu para salvar. ${String(e)}`); } finally { setSaving(false); }
  };
  const setOrigin = (url: string) => set({ links: [...song.links.filter((l) => l.kind !== "origem"), ...(url ? [{ kind: "origem" as const, url }] : [])] });
  return <form className="song-editor" onSubmit={(e) => { e.preventDefault(); if (titleOk && bpmOk && linkOk) void save(); }}>
    <h2 className="song-title">{isNew ? "Nova música" : "Editar música"}</h2>
    <label className="field"><span className="label">Música</span><input type="text" required value={song.title} onChange={(e) => set({ title: e.target.value })} autoFocus /></label>
    <label className="field"><span className="label">Artista</span><input type="text" value={song.artist ?? ""} onChange={(e) => set({ artist: e.target.value })} /></label>
    <label className="field"><span className="label">Fase</span>
      <select value={song.phase ?? ""} onChange={(e) => { const v = e.target.value; const next = { ...song }; if (v) next.phase = Number(v) as Song["phase"]; else delete next.phase; s.setSongDraft({ song: next, isNew }); }}>
        <option value="">Sem fase</option>{PHASES.map((p) => <option key={p} value={p}>Fase {p}</option>)}
      </select></label>
    <label className="field"><span className="label">Tom</span>
      <select value={song.key?.value ?? ""} onChange={(e) => { const v = e.target.value; const next = { ...song }; if (v) next.key = original?.key?.value === v ? original.key : { value: v, origin: { kind: "usuario" } }; else delete next.key; s.setSongDraft({ song: next, isNew }); }}>
        <option value="">Não informado</option>
        <optgroup label="Maior">{KEYS.map((k) => <option key={k} value={k}>{k}</option>)}</optgroup>
        <optgroup label="Menor">{KEYS.map((k) => <option key={`${k}m`} value={`${k}m`}>{k}m</option>)}</optgroup>
      </select></label>
    <label className="field"><span className="label">BPM</span><input type="text" inputMode="decimal" className="num" placeholder="não informado" value={bpmText} onChange={(e) => setBpmText(e.target.value)} aria-invalid={!bpmOk} /></label>
    {!bpmOk && <p className="small error-text">Use um valor entre 20 e 400.</p>}
    <label className="field"><span className="label">Compasso</span>
      <select value={song.timeSignature ?? ""} onChange={(e) => { const next = { ...song }; if (e.target.value) next.timeSignature = e.target.value; else delete next.timeSignature; s.setSongDraft({ song: next, isNew }); }}>
        <option value="">Não informado</option>{["2/4", "3/4", "4/4", "6/8", "12/8"].map((t) => <option key={t}>{t}</option>)}
      </select></label>
    <label className="field"><span className="label">Capo</span>
      <select value={song.capo ?? ""} onChange={(e) => { const next = { ...song }; if (e.target.value === "") delete next.capo; else next.capo = Number(e.target.value); s.setSongDraft({ song: next, isNew }); }}>
        <option value="">Da cifra, se informado</option>
        {Array.from({ length: 13 }, (_, i) => <option key={i} value={i}>{i ? `Casa ${i}` : "Sem capo"}</option>)}
      </select></label>
    <label className="field"><span className="label">Link da cifra</span><input type="text" inputMode="url" placeholder="https://" value={origin} onChange={(e) => setOrigin(e.target.value.trim())} aria-invalid={!linkOk} /></label>
    {!linkOk && <p className="small error-text">O link precisa começar com http:// ou https://.</p>}
    <label className="field"><span className="label">Estilos</span><input type="text" placeholder="reggae, indie" value={tagsText} onChange={(e) => setTagsText(e.target.value)} /></label>
    <label className="field field-notes"><span className="label">Notas</span><textarea rows={3} value={song.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} /></label>
    {error && <p className="error-text" role="alert">{error}</p>}
    <div className="chart-import-foot">
      <button type="button" className="btn ghost" onClick={() => s.setSongDraft(null)}>Cancelar</button>
      <button type="submit" className="btn primary" disabled={!titleOk || !bpmOk || !linkOk || saving}>{saving ? "Salvando…" : "Salvar"}</button>
    </div>
  </form>;
}
