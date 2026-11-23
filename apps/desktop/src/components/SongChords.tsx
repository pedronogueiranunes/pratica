import { useEffect, useMemo, useRef, useState } from "react";
import { alternativeChordShapes, chordAtCapo, chordInversions, chordVoicing, chordsUsed, MAX_SEQUENCE_STEPS, type ChordProDoc, type Diagram } from "@gx/core";
import { engine, onEngine } from "../lib/engine";
import { useApp } from "../lib/app-state";
import { useNav } from "../lib/nav";
import { useSequenceDraft } from "../lib/sequence-draft";
import { ChordCard, ChordDiagram } from "./ChordDiagram";
import { ChordStaff } from "./ChordStaff";
import { ChordChart } from "./ChordChart";
import { IconPlay } from "../icons";
import { FretboardExplorer } from "./FretboardExplorer";

/** Exploração de estudo: não altera a cifra, a revisão ou os metadados da música. */
export function SongChords({ doc, label, capo }: { doc: ChordProDoc; label: string; capo: number }) {
  const { settings } = useApp(); const nav = useNav();
  const { draft, setDraft, error: draftError } = useSequenceDraft();
  const chords = useMemo(() => chordsUsed(doc), [doc]);
  const firstShapes = useMemo(() => new Map(chords.map((chord) => [chord, alternativeChordShapes(chord)[0]])), [chords]);
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [name, setName] = useState(""); const [index, setIndex] = useState(0);
  const [sound, setSound] = useState(true), [volume, setVolume] = useState(.5);
  const [message, setMessage] = useState<string | null>(null), [error, setError] = useState<string | null>(null);
  const [focusDetail, setFocusDetail] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null), trigger = useRef<HTMLButtonElement | null>(null);
  const generation = useRef(0);
  const shapes = useMemo(() => alternativeChordShapes(name), [name]);
  const relative = shapes[index];
  const actual = useMemo(() => relative ? chordAtCapo(relative, capo) : null, [relative, capo]);
  const voiced = useMemo(() => actual ? chordVoicing(actual, settings.tuner.a4) : null, [actual, settings.tuner.a4]);
  const stop = () => { generation.current++; void engine.stopPreview().catch(() => {}); };
  useEffect(() => {
    const hide = () => { if (document.hidden) stop(); };
    const off = onEngine((event) => { if (event.type === "error" && event.direction !== "input") setError(`Não deu para tocar. Confira a saída em Ajustes. ${event.message}`); });
    document.addEventListener("visibilitychange", hide);
    return () => { stop(); off(); document.removeEventListener("visibilitychange", hide); };
  }, []);
  useEffect(() => { if (focusDetail) { heading.current?.focus(); setFocusDetail(false); } }, [focusDetail]);
  // Alterar afinação invalida a prévia antiga; abrir/atualizar nunca toca por efeito.
  useEffect(() => { stop(); }, [settings.tuner.a4]);
  const play = async (diagram: Diagram | undefined) => {
    stop(); setError(null);
    const positioned = diagram ? chordAtCapo(diagram, capo) : null;
    const notes = positioned ? chordVoicing(positioned, settings.tuner.a4) : null;
    if (!notes || volume === 0) return;
    const request = generation.current;
    try { await engine.previewChord(settings.metronome.outputDeviceId ?? null, notes.frequencies, volume); }
    catch (e) { if (generation.current === request) setError(`Não deu para tocar. Confira a saída em Ajustes. ${String(e)}`); }
  };
  const select = (next: string, button?: HTMLButtonElement) => {
    trigger.current = button ?? null;
    setMessage(null); setError(null);
    if (sourceName !== next) { setSourceName(next); setName(next); setIndex(0); if (sound) void play(alternativeChordShapes(next)[0]); else stop(); }
    else if (sound) void play(relative);
    if (button) setFocusDetail(true);
  };
  const selectInversion = (next: string) => {
    setName(next); setIndex(0); setMessage(null); setError(null);
    if (sound) void play(alternativeChordShapes(next)[0]); else stop();
  };
  const close = () => { stop(); setSourceName(null); setMessage(null); setError(null); trigger.current?.focus(); };
  const add = () => {
    if (!actual || draft.steps.length >= MAX_SEQUENCE_STEPS) return;
    const diagram = structuredClone(actual);
    setDraft((current) => current.steps.length >= MAX_SEQUENCE_STEPS ? current : { ...current, steps: [...current.steps, { id: crypto.randomUUID(), diagram, beats: 4 }] });
    setMessage(`${diagram.name} adicionado à sequência${capo ? ", com as casas reais do capo" : ""}. Salve a sequência para manter.`);
  };
  return <>
    {chords.length > 0 && <div className="chord-strip-songs">
      <div className="chord-strip-scroll" role="list" aria-label="Acordes da música">
        {chords.map((chord) => <div role="listitem" key={chord}><ChordCard name={chord} diagram={firstShapes.get(chord) ?? null} size="sm" onClick={() => select(chord)} pressed={sourceName === chord} /></div>)}
      </div>
      <div className="chord-strip-foot"><span className="muted small">Toque no diagrama ou no acorde da cifra para explorar.</span>
        {chords.length > 1 && <button className="btn ghost" onClick={() => nav.openChordTrainer(chords.slice(0, 8))}>Treinar a troca destes acordes</button>}
      </div>
    </div>}
    {sourceName && <section className="song-chord-detail chord-detail" aria-label={`Acorde da cifra: ${sourceName}`}>
      <div className="panel-head">
        <h3 className="chord-detail-name" tabIndex={-1} ref={heading}>{name}</h3><span className="spacer" />
        <button className="btn primary" disabled={!voiced || volume === 0} onClick={() => void play(relative)}><IconPlay />Tocar acorde</button>
        <button className="btn" disabled={!actual || draft.steps.length >= MAX_SEQUENCE_STEPS} onClick={add}>Adicionar à sequência</button>
        <button className="btn ghost" onClick={close}>Fechar acorde</button>
      </div>
      <p className="muted small">Opções para estudar. A cifra continua igual.{capo ? ` Capo na casa ${capo}.${actual ? ` O diagrama é relativo ao capo; som e pauta em ${actual.name}.` : ""}` : ""}</p>
      <div className="chord-audio-controls">
        <label className="chord-preview-toggle"><input type="checkbox" checked={sound} onChange={(e) => { setSound(e.target.checked); if (!e.target.checked) stop(); }} />Som ao selecionar</label>
        <label className="chord-preview-volume">Volume<input type="range" min="0" max="100" step="5" aria-label="Volume do acorde da cifra" value={volume * 100} onChange={(e) => { setVolume(Number(e.target.value) / 100); stop(); }} /><span className="num">{Math.round(volume * 100)}%</span></label>
        <span className="muted small">Som de referência</span>
      </div>
      <div className="chord-options">
        <label>Baixo / inversão<select aria-label="Inversão do acorde da cifra" value={name} onChange={(e) => selectInversion(e.target.value)}>
          {chordInversions(sourceName).length ? chordInversions(sourceName).map((o) => <option key={o.name} value={o.name}>{o.label}</option>) : <option value={name}>{name}</option>}
        </select></label>
        <label>Posição no braço<select aria-label="Forma do acorde da cifra" value={index} disabled={!shapes.length} onChange={(e) => { const i = Number(e.target.value); setIndex(i); setMessage(null); if (sound) void play(shapes[i]); else stop(); }}>
          {shapes.length ? shapes.map((d, i) => <option key={i} value={i}>Forma {i + 1} · {d.notes.some((n) => n.fret === 0) ? "cordas soltas" : `casa ${Math.min(...d.notes.map((n) => n.fret))}`}</option>) : <option value={0}>Sem forma disponível</option>}
        </select></label>
      </div>
      <div className="chord-voicing-layout">
        <div className="chord-voicing-diagram">{relative && actual ? <ChordDiagram diagram={relative} size="lg" /> : <p className="muted">Sem forma validada para este acorde e capo. Experimente outro baixo ou confira o capo da música.</p>}</div>
        {voiced && actual && <ChordStaff voicing={voiced} name={actual.name} />}
      </div>
      {actual && <details className="song-fretboard" onToggle={(e) => setBoardOpen(e.currentTarget.open)}><summary>Ver no braço completo</summary>{boardOpen && <FretboardExplorer diagram={actual} embedded />}</details>}
      <div className="song-chord-actions"><button className="btn" onClick={nav.openChordSequence}>Abrir sequência ({draft.steps.length}/16)</button>
        {draft.steps.length >= MAX_SEQUENCE_STEPS && <span className="muted small">Sequência cheia. Remova um bloco para adicionar outro.</span>}
      </div>
      {message && <p role="status" className="small muted">{message}</p>}
      {(error || draftError) && <p role="alert" className="error-text">{error || draftError}</p>}
    </section>}
    <ChordChart doc={doc} label={label} selectedChord={sourceName} onChord={select} />
  </>;
}
