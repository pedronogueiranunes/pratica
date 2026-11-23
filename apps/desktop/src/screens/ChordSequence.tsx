import { useEffect, useRef, useState, type SetStateAction } from "react";
import { BEAT_OPTIONS, compileChordSequence, MAX_SEQUENCE_STEPS, type ChordSequenceStep, type SequenceDraft, type SavedSequence, compileDrums, DRUM_PATTERNS, type DrumPatternId } from "@gx/core";
import { engine, onEngine } from "../lib/engine";
import { useMetronome } from "../lib/metronome";
import { usePractice } from "../lib/practice-state";
import { useApp } from "../lib/app-state";
import { IconPlay, IconStop } from "../icons";

function MoveIcon({ down = false }: { down?: boolean }) {
  return <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={down ? "M10 4v12m-5-5 5 5 5-5" : "M10 16V4m-5 5 5-5 5 5"} /></svg>;
}

export function ChordSequence({ draft, setDraft, onChoose, standalone = false }: { standalone?: boolean; draft: SequenceDraft; setDraft: (next: SetStateAction<SequenceDraft>) => void; onChoose: () => void }) {
  const { volume, click, drums } = draft;
  const steps = standalone ? [] : draft.steps;
  const setSteps = (steps: ChordSequenceStep[]) => setDraft((current) => ({ ...current, steps }));
  const { store } = usePractice();
  const [saved, setSaved] = useState<SavedSequence[]>([]);
  const [chosen, setChosen] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const m = useMetronome();
  const { settings, update } = useApp();
  const [running, setRunning] = useState(false);
  const [pending, setPending] = useState(false);

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
      if (settings.metronome.volume !== draft.clickVolume && !(await update({ metronome: { volume: draft.clickVolume } }))) throw new Error("Não deu para ajustar o volume do clique.");
      if (!active.current || request !== generation.current) return;
      const s = { ...settings.metronome, bpm: m.bpm, volume: draft.clickVolume };
      await engine.startSequence(settings.metronome.outputDeviceId ?? null, s, steps.length ? compileChordSequence(steps, settings.tuner.a4) : [], volume, click, runId.current, compileDrums(drums));
    } catch (e) { if (request === generation.current) { active.current = false; setPending(false); setRunning(false); setError(`Não deu para iniciar. ${String(e)}`); } }
  };
  useEffect(() => {
    if (running && active.current) void engine.updateSequenceMixer(runId.current, { volume, click, drums: compileDrums(drums) }).catch((e) => setError(String(e)));
  }, [volume, click, drums, running]);
  const refreshSaved = async () => { if (store) setSaved(await store.listSequences()); };
  useEffect(() => {
    let active = true;
    const refresh = () => { if (store) void store.listSequences().then((rows) => { if (active) setSaved(rows); }).catch((e) => { if (active) setError(String(e)); }); };
    refresh(); window.addEventListener("practice-synced", refresh);
    return () => { active = false; window.removeEventListener("practice-synced", refresh); };
  }, [store]);
  const snapshot = { ...draft, bpm: m.bpm };
  const save = async () => {
    if (!store || saving) return; setSaving(true); setError(null);
    try { const copy = structuredClone(snapshot); await store.saveSequence(copy); setLastSaved(JSON.stringify(copy)); setSaveMessage("Sequência salva."); await refreshSaved(); window.dispatchEvent(new Event("practice-written")); }
    catch (e) { setError(`Não deu para salvar. ${String(e)}`); } finally { setSaving(false); }
  };
  const load = () => {
    const item = saved.find((s) => s.id === chosen); if (!item) return;
    const { updatedAt: _at, ...copy } = structuredClone(item);
    setDraft(copy); m.setBpm(copy.bpm); void update({ metronome: { volume: copy.clickVolume } }); setLastSaved(JSON.stringify(copy)); setSaveMessage("Sequência carregada.");
  };
  const removeSaved = async () => {
    const item = saved.find((s) => s.id === chosen); if (!item || !store || saving) return;
    setSaving(true); setError(null);
    try { await store.saveSequence({ ...item, deleted: true }); if (draft.id === item.id) setDraft((current) => ({ ...current, id: crypto.randomUUID() })); setChosen(""); setSaveMessage("Removida das salvas. O rascunho foi mantido."); await refreshSaved(); window.dispatchEvent(new Event("practice-written")); }
    catch (e) { setError(String(e)); } finally { setSaving(false); }
  };
  const locked = running || pending;
  const move = (index: number, direction: number) => { const list = [...steps]; [list[index], list[index + direction]] = [list[index + direction]!, list[index]!]; setSteps(list); };
  return <section className="panel sequence-panel" aria-label={standalone ? "Bateria de acompanhamento" : "Sequenciador de acordes"}>
    <div className="panel-head"><h2>{standalone ? "Acompanhamento" : "Sequenciador"}</h2><span className="spacer" />{!standalone && <button className="btn" disabled={locked || steps.length >= MAX_SEQUENCE_STEPS} onClick={onChoose}>Adicionar acordes</button>}</div>
    <p className="muted small">{standalone ? "Toque com a bateria e ajuste o volume do clique separado." : "Um ataque por bloco. A bateria também toca sozinha, sem adicionar acordes."}</p>
    {!standalone && <div className="sequence-saved">
      <label>Nome<input type="text" aria-label="Nome da sequência" maxLength={80} value={draft.name} onChange={(e) => setDraft((current) => ({ ...current, name: e.target.value }))} /></label>
      <button className="btn" disabled={!store || saving || !draft.name.trim()} onClick={() => void save()}>{saving ? "Salvando…" : "Salvar sequência"}</button>
      <button className="btn ghost" disabled={locked || saving} onClick={() => { setDraft((current) => ({ ...current, id: crypto.randomUUID(), name: "Minha sequência", steps: [] })); setChosen(""); setLastSaved(null); setSaveMessage(""); }}>Novo rascunho</button>
    </div>}
    {saved.length > 0 && !standalone && <div className="sequence-saved">
      <label>Salvas<select aria-label="Sequências salvas" value={chosen} disabled={locked || saving} onChange={(e) => setChosen(e.target.value)}><option value="">Escolha uma sequência</option>{saved.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <button className="btn" disabled={!chosen || locked || saving} onClick={load}>Carregar</button>
      <button className="btn ghost" disabled={!chosen || locked || saving} onClick={() => void removeSaved()}>Apagar salva</button>
    </div>}
    {!standalone && saveMessage && <p className="small muted" role="status">{lastSaved && JSON.stringify(snapshot) !== lastSaved ? "Há alterações para salvar." : saveMessage}</p>}
    {!standalone && (!steps.length ? <p className="sequence-empty">Sem acordes. Use só a bateria ou adicione formas da Biblioteca.</p> : <ol className="sequence-list">
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
    </ol>)}
    <div className="sequence-controls">
      <label>BPM<input type="number" min="20" max="400" value={bpmText} aria-label="BPM da sequência" onChange={(e) => { setBpmText(e.target.value); const n = e.target.valueAsNumber; if (n >= 20 && n <= 400) m.setBpm(n); }} onBlur={() => { const n = Number(bpmText); const value = Number.isFinite(n) && bpmText ? Math.max(20, Math.min(400, Math.round(n))) : m.bpm; m.setBpm(value); setBpmText(String(value)); }} /></label>
      {!standalone && <label className="chord-preview-volume">Acordes<input type="range" min="0" max="100" step="5" aria-label="Volume dos acordes" value={volume * 100} onChange={(e) => setDraft((current) => ({ ...current, volume: Number(e.target.value) / 100 }))} /><span className="num">{Math.round(volume * 100)}%</span></label>}
      <label className="chord-preview-toggle"><input type="checkbox" checked={click} onChange={(e) => setDraft((current) => ({ ...current, click: e.target.checked }))} />Ouvir clique</label>
      <label className="chord-preview-volume">Clique<input aria-label="Volume do clique" type="range" min="0" max="100" step="5" value={draft.clickVolume * 100} onChange={(e) => { const value = Number(e.target.value) / 100; setDraft((current) => ({ ...current, clickVolume: value })); void update({ metronome: { volume: value } }); }} /><span className="num">{Math.round(draft.clickVolume * 100)}%</span></label>

    </div>
    <div className="sequence-drums">
      <h3>Bateria</h3>
      <div className="sequence-controls">
        <label className="chord-preview-toggle"><input type="checkbox" aria-label="Ativar bateria" checked={drums.enabled} onChange={(e) => { if (e.target.checked && settings.metronome.beatsPerBar !== 4) { setError("Escolha compasso 4/4 para ligar a bateria."); return; } setError(null); setDraft((current) => ({ ...current, drums: { ...current.drums, enabled: e.target.checked } })); }} />Ativar bateria</label>
        <label>Ritmo<select aria-label="Ritmo da bateria" value={drums.pattern} onChange={(e) => setDraft((current) => ({ ...current, drums: { ...current.drums, pattern: e.target.value as DrumPatternId } }))}>{DRUM_PATTERNS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label className="chord-preview-volume">Bateria<input aria-label="Volume da bateria" type="range" min="0" max="100" step="5" value={drums.volume * 100} onChange={(e) => setDraft((current) => ({ ...current, drums: { ...current.drums, volume: Number(e.target.value) / 100 } }))} /><span className="num">{Math.round(drums.volume * 100)}%</span></label>
      </div>
      <p className="muted small">Padrões originais em 4/4. Trocas de ritmo entram no próximo compasso.</p>
      {settings.metronome.beatsPerBar !== 4 && <button className="btn" onClick={() => void update({ metronome: { beatsPerBar: 4 } })}>Usar compasso 4/4</button>}
    </div>
    <div className="sequence-controls">{locked ? <button className="btn primary" onClick={stop}><IconStop />Parar loop</button> : <button className="btn primary" disabled={!steps.length && !drums.enabled} onClick={() => void play()}><IconPlay />Ouvir em loop</button>}</div>
    <p className="small muted sequence-position" aria-live="off">{running && !steps.length ? "Bateria em loop." : running && position ? `Agora: ${steps[position.step]?.diagram.name ?? ""} · ${position.beatsLeft} tempo(s). Depois: ${steps[(position.step + 1) % steps.length]?.diagram.name ?? ""}.` : pending ? "Preparando áudio…" : `${standalone ? "" : `${steps.length}/16 blocos. `}Parar o loop também para o metrônomo.${standalone ? "" : " Para editar os acordes, pare o loop."}`}</p>
    {error && <p role="alert" className="error">{error}</p>}
  </section>;
}
