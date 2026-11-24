import { useEffect, useMemo, useRef, useState } from "react";
import { ChromaSmoother, ChordStabilizer, chordInversions, chordVariations, chromaFromSpectrum, lowestPitchClass, recognizeChords, shapesFor, transposeNote, type RecognizedChord } from "@gx/core";
import { useTuner } from "../lib/tuner";
import { ChordCard } from "./ChordDiagram";

/** Ouve o instrumento, reconhece o acorde e mostra variações e inversões ao vivo. Não toca som: a entrada está aberta. */
export function ChordListener({ flats, onDetect, onPick }: { flats: boolean; onDetect: (name: string) => void; onPick: (name: string) => void }) {
  const tuner = useTuner();
  const [on, setOn] = useState(false);
  const [candidates, setCandidates] = useState<RecognizedChord[]>([]);
  const [current, setCurrent] = useState<RecognizedChord | null>(null);
  const [silent, setSilent] = useState(false);
  const lastHeard = useRef(0);
  const smoother = useRef(new ChromaSmoother(4));
  const [heard, setHeard] = useState<number[]>([]);
  const stabilizer = useRef(new ChordStabilizer(3, 1800));
  const detect = useRef(onDetect);
  detect.current = onDetect;
  useEffect(() => { if (on) return tuner.observeSpectrum(); }, [on, tuner.observeSpectrum]);
  useEffect(() => { if (!on) { stabilizer.current.reset(); smoother.current.reset(); setHeard([]); setCandidates([]); setCurrent(null); setSilent(false); } }, [on]);
  const spectrum = on && tuner.running && !tuner.pending ? tuner.spectrum : null;
  useEffect(() => {
    if (!spectrum) return;
    const chroma = chromaFromSpectrum(spectrum.powers, spectrum.sampleRate, spectrum.fftSize, spectrum.level, spectrum.a4, flats);
    const bass = lowestPitchClass(spectrum.powers, spectrum.sampleRate, spectrum.fftSize, spectrum.a4);
    const smooth = chroma ? smoother.current.push(chroma.values, bass) : null;
    if (smooth) setHeard(smooth.values);
    const found = chroma && smooth ? recognizeChords({ ...chroma, values: smooth.values }, smooth.bass, flats) : [];
    if (found.length) setCandidates(found);
    const out = stabilizer.current.push(found[0] ?? null, performance.now());
    if (out.changed && out.chord) { setCurrent(out.chord); detect.current(out.chord.name); }
    setSilent(!out.chord || performance.now() - lastHeard.current > 1800);
    if (found.length) lastHeard.current = performance.now();
  }, [spectrum, flats]);
  const shown = current ?? candidates[0] ?? null;
  const variations = useMemo(() => current ? chordVariations(current.name) : [], [current]);
  const inversions = useMemo(() => current ? chordInversions(current.name) : [], [current]);
  const listening = on && tuner.running && !tuner.pending;
  return <section className="panel chord-listener" aria-label="Reconhecer acorde tocado">
    <div className="panel-head">
      <h2>Reconhecer o que você toca</h2>
      <span className="spacer" />
      <button className="btn primary" aria-pressed={on} onClick={() => { const next = !on; setOn(next); if (next && !tuner.running && !tuner.pending) tuner.toggle(); }}>{on ? "Parar de ouvir" : "Ouvir"}</button>
    </div>
    {!on && <p className="muted small">Toque um acorde com todas as cordas soando. O app mostra o nome, a inversão e as variações em tempo real. É uma estimativa: cordas abafadas ou muito ruído podem confundir.</p>}
    {on && !listening && <p className="muted small" role="status">{tuner.error ?? "Abrindo a entrada de áudio..."}</p>}
    {listening && <div className="chord-listener-live" role="status" aria-live="polite">
      <div className={`chord-listener-name${silent ? " is-silent" : ""}`}>{current ? <><strong>{current.name}</strong>{current.inversion && <span className="muted small"> · {current.inversion}</span>}{silent && <span className="muted small"> · último acorde</span>}</> : <span className="muted">{shown ? "Confirmando..." : "Toque um acorde"}</span>}</div>
      {candidates.length > 1 && <p className="muted small">Também pode ser: {candidates.filter((c) => c.name !== current?.name).slice(0, 3).map((c) => c.name).join(", ")}</p>}
    </div>}
    {listening && heard.length === 12 && <div className="chord-listener-bars" aria-label="Notas que o app está ouvindo">{heard.map((v, i) => { const top = Math.max(...heard, 1e-9); return <div key={i} className="chord-listener-bar"><span className="chord-listener-bar-fill" style={{ height: `${Math.round(100 * v / top)}%` }} /><span className="small">{transposeNote("C", i, flats)}</span></div>; })}</div>}
    {current && <>
      <h3 className="small">Inversões</h3>
      <div className="chord-listener-row">{inversions.map((o) => { const s = shapesFor(o.name); return <ChordCard key={o.name} name={o.name} diagram={s.shapes[0] ?? null} generated={s.source === "gerada"} size="sm" pressed={o.name === current.name} onClick={() => onPick(o.name)} />; })}</div>
      <h3 className="small">Variações</h3>
      <div className="chord-listener-row">{variations.map((o) => { const s = shapesFor(o.name); return <ChordCard key={o.name} name={o.name} diagram={s.shapes[0] ?? null} generated={s.source === "gerada"} size="sm" pressed={o.name === (current.name.split("/")[0])} onClick={() => onPick(o.name)} />; })}</div>
    </>}
  </section>;
}
