import { useEffect, useRef, useState } from "react";
import { BEAT_OPTIONS, compileChordSequence, MAX_SEQUENCE_STEPS, type ChordSequenceStep } from "@gx/core";
import { engine, onEngine } from "../lib/engine";
import { useMetronome } from "../lib/metronome";
import { useApp } from "../lib/app-state";
import { IconPlay, IconStop } from "../icons";

function MoveIcon({ down = false }: { down?: boolean }) {
  return <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={down ? "M10 4v12m-5-5 5 5 5-5" : "M10 16V4m-5 5 5-5 5 5"} /></svg>;
}

export function ChordSequence({ steps, setSteps, onChoose }: { steps: ChordSequenceStep[]; setSteps: (steps: ChordSequenceStep[]) => void; onChoose: () => void }) {
  const m = useMetronome();
  const { settings } = useApp();
  const [running, setRunning] = useState(false);
  const [pending, setPending] = useState(false);
  const [volume, setVolume] = useState(.5);
  const [click, setClick] = useState(true);
  const [position, setPosition] = useState<{ step: number; beatsLeft: number } | null>(null);
  const [bpmText, setBpmText] = useState(String(m.bpm));
  useEffect(() => setBpmText(String(m.bpm)), [m.bpm]);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(false);
  const runId = useRef(0);
  const generation = useRef(0);
  const timers = useRef(new Set<number>());
  const invalidate = () => { generation.current++; for (const t of timers.current) window.clearTimeout(t); timers.current.clear(); setPosition(null); };
  const stop = () => { invalidate(); active.current = false; setPending(false); setRunning(false); void engine.stopSequence().catch((e) => setError(String(e))); };
  useEffect(() => {
    const clear = () => { generation.current++; for (const t of timers.current) window.clearTimeout(t); timers.current.clear(); };
    const hide = () => { if (document.hidden && active.current) { clear(); active.current = false; setRunning(false); setPending(false); setPosition(null); void engine.stopSequence().catch(() => {}); } };
    document.addEventListener("visibilitychange", hide);
    const unlisten = onEngine((e) => {
      if (e.type === "sequenceState" && e.runId === runId.current) {
        // O motor web encerra o transporte anterior antes de iniciar o novo.
        if (e.running && active.current) { setRunning(true); setPending(false); }
        else { clear(); active.current = false; setPending(false); setRunning(false); setPosition(null); }
      }
      if (e.type === "error" && e.direction !== "input" && active.current) {
        clear(); active.current = false; setRunning(false); setPending(false); setPosition(null); setError(`Não deu para tocar. Confira a saída em Ajustes. ${e.message}`);
      }
      if (e.type === "sequenceBeat" && e.runId === runId.current && active.current) {
        const request = generation.current;
        const id = window.setTimeout(() => { timers.current.delete(id); if (active.current && request === generation.current) setPosition({ step: e.step, beatsLeft: e.beatsLeft }); }, e.audibleInMs);
        timers.current.add(id);
      }
    });
    return () => { clear(); unlisten(); document.removeEventListener("visibilitychange", hide); if (active.current) { active.current = false; void engine.stopSequence().catch(() => {}); } };
  }, []);
  const play = async () => {
    if (pending || running) return;
    invalidate(); setError(null); setPending(true); active.current = true;
    const request = generation.current;
    runId.current = crypto.getRandomValues(new Uint32Array(1))[0]!;
    try {
      const s = { ...settings.metronome, bpm: m.bpm };
      await engine.startSequence(settings.metronome.outputDeviceId ?? null, s, compileChordSequence(steps, settings.tuner.a4), volume, click, runId.current);
    } catch (e) { if (request === generation.current) { active.current = false; setPending(false); setRunning(false); setError(`Não deu para iniciar. ${String(e)}`); } }
  };
  const locked = running || pending;
  const move = (index: number, direction: number) => { const list = [...steps]; [list[index], list[index + direction]] = [list[index + direction]!, list[index]!]; setSteps(list); };
  return <section className="panel sequence-panel" aria-label="Sequenciador de acordes">
    <div className="panel-head"><h2>Sequenciador</h2><span className="spacer" /><button className="btn" disabled={locked || steps.length >= MAX_SEQUENCE_STEPS} onClick={onChoose}>Adicionar acordes</button></div>
    <p className="muted small">Sequência desta sessão. Um ataque por bloco, em loop. Salvar sequências entra numa próxima entrega.</p>
    {!steps.length ? <p className="sequence-empty">Escolha um acorde na Biblioteca e adicione a forma que você quer ouvir.</p> : <ol className="sequence-list">
      {steps.map((step, i) => <li className={`sequence-row${running && position?.step === i ? " current" : ""}`} key={step.id} aria-current={running && position?.step === i ? "step" : undefined}>
        <div className="sequence-name"><span className="num muted">{i + 1}</span><strong>{step.diagram.name}</strong><span className="num small muted">{[6, 5, 4, 3, 2, 1].map((s) => step.diagram.notes.find((n) => n.string === s)?.fret ?? "x").join(" ")}</span></div>
        <label>Tempos<select aria-label={`Tempos do bloco ${i + 1}`} disabled={locked} value={step.beats} onChange={(e) => setSteps(steps.map((s, n) => n === i ? { ...s, beats: Number(e.target.value) } : s))}>{BEAT_OPTIONS.map((beats) => <option key={beats} value={beats}>{beats}</option>)}</select></label>
        <div className="sequence-actions">
          <button className="btn" aria-label={`Subir bloco ${i + 1}`} disabled={locked || i === 0} onClick={() => move(i, -1)}><MoveIcon /></button>
          <button className="btn" aria-label={`Descer bloco ${i + 1}`} disabled={locked || i === steps.length - 1} onClick={() => move(i, 1)}><MoveIcon down /></button>
          <button className="btn" aria-label={`Repetir bloco ${i + 1}`} disabled={locked || steps.length >= MAX_SEQUENCE_STEPS} onClick={() => { const list = [...steps]; list.splice(i + 1, 0, { ...step, id: crypto.randomUUID() }); setSteps(list); }}>Repetir</button>
          <button className="btn ghost" aria-label={`Remover bloco ${i + 1}`} disabled={locked} onClick={() => setSteps(steps.filter((s) => s.id !== step.id))}>Remover</button>
        </div>
      </li>)}
    </ol>}
    <div className="sequence-controls">
      <label>BPM<input type="number" min="20" max="400" value={bpmText} aria-label="BPM da sequência" onChange={(e) => { setBpmText(e.target.value); const n = e.target.valueAsNumber; if (n >= 20 && n <= 400) m.setBpm(n); }} onBlur={() => { const n = Number(bpmText); const value = Number.isFinite(n) && bpmText ? Math.max(20, Math.min(400, Math.round(n))) : m.bpm; m.setBpm(value); setBpmText(String(value)); }} /></label>
      <label className="chord-preview-volume">Acordes<input type="range" min="0" max="100" step="5" aria-label="Volume dos acordes" disabled={locked} value={volume * 100} onChange={(e) => setVolume(Number(e.target.value) / 100)} /><span className="num">{Math.round(volume * 100)}%</span></label>
      <label className="chord-preview-toggle"><input type="checkbox" checked={click} disabled={locked} onChange={(e) => setClick(e.target.checked)} />Ouvir clique</label>
      {locked ? <button className="btn primary" onClick={stop}><IconStop />Parar loop</button> : <button className="btn primary" disabled={!steps.length} onClick={() => void play()}><IconPlay />Ouvir em loop</button>}
    </div>
    <p className="small muted sequence-position" aria-live="off">{running && position ? `Agora: ${steps[position.step]?.diagram.name ?? ""} · ${position.beatsLeft} tempo(s). Depois: ${steps[(position.step + 1) % steps.length]?.diagram.name ?? ""}.` : pending ? "Preparando áudio…" : `${steps.length}/16 blocos. Parar o loop também para o metrônomo. Para editar, pare o loop.`}</p>
    {error && <p role="alert" className="error">{error}</p>}
  </section>;
}
