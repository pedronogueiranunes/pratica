import { useEffect, useMemo, useRef, useState } from "react";
import {
  chordVoicing, BEAT_OPTIONS, PRESET_PAIRS, changesPerMinute, chordFamily, chordTones, commonChordNames, keyUsesFlats, parseChord, shapesFor, trainerState,
} from "@gx/core";
import { engine, onEngine } from "../lib/engine";
import { ChordStaff } from "../components/ChordStaff";
import { ChordCard, ChordDiagram } from "../components/ChordDiagram";
import { useMetronome } from "../lib/metronome";
import { usePractice } from "../lib/practice-state";
import { useApp } from "../lib/app-state";
import { IconMinus, IconPlay, IconPlus, IconStop } from "../icons";

type Tab = "biblioteca" | "troca";
type Family = "todos" | "maior" | "menor" | "sétima" | "outros";
const FAMILIES: { id: Family; label: string }[] = [
  { id: "todos", label: "Todos" }, { id: "maior", label: "Maiores" }, { id: "menor", label: "Menores" }, { id: "sétima", label: "Com sétima" }, { id: "outros", label: "Outros" },
];
const TRAINER_KEY = "pratica.chords.trainer";
export const TRAINER_EXERCISE = "f1-troca-acordes";

function loadTrainer(): { chords: string[]; beatsPerChord: number } {
  try {
    const v = JSON.parse(localStorage.getItem(TRAINER_KEY) ?? "null") as { chords?: unknown; beatsPerChord?: unknown } | null;
    const chords = Array.isArray(v?.chords) ? v!.chords.filter((c): c is string => typeof c === "string" && !!parseChord(c)).slice(0, 8) : [];
    const beats = BEAT_OPTIONS.includes(v?.beatsPerChord as 4) ? (v!.beatsPerChord as number) : 4;
    return { chords: chords.length ? chords : PRESET_PAIRS[0]!, beatsPerChord: beats };
  } catch { return { chords: PRESET_PAIRS[0]!, beatsPerChord: 4 }; }
}
/** Outras telas abrem a troca com acordes escolhidos. */
export function presetTrainer(chords: string[]) {
  try { localStorage.setItem(TRAINER_KEY, JSON.stringify({ ...loadTrainer(), chords })); localStorage.setItem("pratica.chords.tab", "troca"); } catch {}
}

export function Chords() {
  const [tab, setTab] = useState<Tab>(() => { try { return localStorage.getItem("pratica.chords.tab") === "troca" ? "troca" : "biblioteca"; } catch { return "biblioteca"; } });
  const choose = (t: Tab) => { setTab(t); try { localStorage.setItem("pratica.chords.tab", t); } catch {} };
  return <div className="screen chords-screen">
    <header className="screen-head">
      <h1>Acordes</h1>
      <div className="seg" role="group" aria-label="Seção">
        <button aria-pressed={tab === "biblioteca"} onClick={() => choose("biblioteca")}>Biblioteca</button>
        <button aria-pressed={tab === "troca"} onClick={() => choose("troca")}>Troca de acordes</button>
      </div>
    </header>
    {tab === "biblioteca" ? <Library onTrain={(name) => { presetTrainer([name]); choose("troca"); }} /> : <Trainer />}
  </div>;
}

function Library({ onTrain }: { onTrain: (name: string) => void }) {
  const { settings } = useApp();
  const [formIndex, setFormIndex] = useState(0);
  const [soundOnSelect, setSoundOnSelect] = useState(true);
  const [volume, setVolume] = useState(0.5);
  const [audioError, setAudioError] = useState<string | null>(null);
  const generation = useRef(0);
  useEffect(() => {
    const stop = () => { generation.current++; void engine.stopPreview().catch(() => {}); };
    const hide = () => { if (document.hidden) stop(); };
    document.addEventListener("visibilitychange", hide);
    const unlisten = onEngine((event) => {
      if (event.type === "error" && event.direction !== "input") setAudioError(`Não deu para tocar. Confira a saída em Ajustes. ${event.message}`);
    });
    return () => { stop(); unlisten(); document.removeEventListener("visibilitychange", hide); };
  }, []);
  const play = async (diagram: ReturnType<typeof shapesFor>["shapes"][number] | undefined) => {
    const voiced = diagram ? chordVoicing(diagram, settings.tuner.a4) : null;
    if (!voiced || volume === 0) return;
    const request = ++generation.current; setAudioError(null);
    try { await engine.previewChord(settings.metronome.outputDeviceId ?? null, voiced.frequencies, volume); }
    catch (error) { if (generation.current === request) setAudioError(`Não deu para tocar. Tente de novo. ${String(error)}`); }
  };
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState<Family>("todos");
  const [open, setOpen] = useState<string | null>(null);
  const typed = query.trim().replace(/\s+/g, "");
  const typedValid = typed && chordTones(typed) !== null;
  const names = useMemo(() => {
    const all = commonChordNames().filter((n) => family === "todos" || chordFamily(n) === family);
    const q = typed.toLowerCase();
    const list = q ? all.filter((n) => n.toLowerCase().startsWith(q)) : all;
    // Um nome digitado que não está na tabela também aparece, com forma calculada.
    return typedValid && !list.some((n) => n.toLowerCase() === q) ? [typed, ...list] : list;
  }, [family, typed, typedValid]);
  const detail = open ? shapesFor(open) : null;
  const selected = detail?.shapes[formIndex];
  const voicing = selected ? chordVoicing(selected, settings.tuner.a4) : null;
  return <div className="chord-library">
    <div className="chord-toolbar">
      <input type="search" placeholder="Buscar ou digitar um acorde, como Em7(9) ou D/F#" aria-label="Buscar acorde" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="seg" role="group" aria-label="Tipo de acorde">
        {FAMILIES.map((f) => <button key={f.id} aria-pressed={family === f.id} onClick={() => setFamily(f.id)}>{f.label}</button>)}
      </div>
    </div>
    <div className="chord-audio-controls">
      <label className="chord-preview-toggle"><input type="checkbox" checked={soundOnSelect} onChange={(e) => { setSoundOnSelect(e.target.checked); if (!e.target.checked) { generation.current++; void engine.stopPreview().catch(() => {}); } }} />Som ao selecionar</label>
      <label className="chord-preview-volume">Volume <input aria-label="Volume da prévia" type="range" min="0" max="100" step="5" value={Math.round(volume * 100)} onChange={(e) => { setVolume(Number(e.target.value) / 100); generation.current++; void engine.stopPreview().catch(() => {}); }} /><span className="num">{Math.round(volume * 100)}%</span></label>
      <span className="muted small">Som de referência</span>
    </div>
    {audioError && <p role="alert" className="error">{audioError}</p>}
    {typed && !names.length && <p className="muted">Não reconheci "{typed}". Tente C, Am, G7, C7M, Em7(9) ou D/F#.</p>}
    {detail && open && <section className="panel chord-detail" aria-label={`Formas de ${open}`}>
      <div className="panel-head">
        <h2 className="chord-detail-name">{open}</h2>

        <span className="spacer" />
        <button className="btn primary" disabled={!voicing || volume === 0} onClick={() => void play(selected)}><IconPlay />Tocar</button>
        <button className="btn" onClick={() => onTrain(open)}>Treinar troca</button>
        <button className="btn ghost" onClick={() => { setOpen(null); generation.current++; void engine.stopPreview().catch(() => {}); }}>Fechar</button>
      </div>
      <div className="chord-voicing-layout">
        <div className="chord-voicing-diagram">
          {selected ? <ChordDiagram diagram={selected} size="lg" title={`${open}, forma ${formIndex + 1}`} /> : <p className="muted">Sem forma disponível para tocar ou escrever.</p>}
          {detail.shapes.length > 1 && <div className="seg" role="group" aria-label="Forma do acorde">
            {detail.shapes.map((d, i) => <button key={i} aria-pressed={formIndex === i} onClick={() => { setFormIndex(i); if (soundOnSelect) void play(d); else void engine.stopPreview().catch(() => {}); }}>Forma {i + 1}</button>)}
          </div>}
        </div>
        {voicing && <ChordStaff voicing={voicing} name={open} />}
      </div>
      <p className="muted small">{detail.source === "gerada" ? "Formas calculadas pelo app a partir das notas do acorde. Confira se soam bem na sua mão." : "Bolinha laranja é a fundamental. O número é o dedo: 1 indicador, 2 médio, 3 anelar, 4 mínimo. X não toca, círculo é corda solta."}</p>
    </section>}
    <div className="chord-grid">
      {names.map((n) => { const s = shapesFor(n); return <ChordCard key={n} name={n} diagram={s.shapes[0] ?? null} generated={s.source === "gerada"} onClick={() => { const index = open === n ? formIndex : 0; setOpen(n); setFormIndex(index); if (soundOnSelect) void play(s.shapes[index]); }} pressed={open === n} />; })}
    </div>
  </div>;
}

function Trainer() {
  const m = useMetronome();
  const { catalog } = useApp();
  const { addLog } = usePractice();
  const [config, setConfig] = useState(loadTrainer);
  const [beats, setBeats] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [adding, setAdding] = useState("");
  const [logValue, setLogValue] = useState("");
  const [logState, setLogState] = useState<{ busy: boolean; message?: string; error?: string }>({ busy: false });
  const swapRef = useRef<HTMLDivElement>(null);
  const exercise = catalog.exercicios.find((e) => e.id === TRAINER_EXERCISE);
  useEffect(() => { try { localStorage.setItem(TRAINER_KEY, JSON.stringify(config)); } catch {} }, [config]);

  // Conta só tempos (sub 0) com o metrônomo ligado nesta tela.
  const started = useRef(false);
  useEffect(() => {
    if (m.running && !started.current) { started.current = true; setBeats(0); setStartedAt(performance.now()); setElapsed(0); setLogState({ busy: false }); setLogValue(""); }
    if (!m.running && started.current) { started.current = false; if (startedAt) setElapsed(performance.now() - startedAt); }
  }, [m.running]);
  useEffect(() => m.onTick((t) => { if (t.sub === 0 && started.current) setBeats((b) => b + 1); }), [m]);
  useEffect(() => {
    if (!m.running || startedAt === null) return;
    const id = window.setInterval(() => setElapsed(performance.now() - startedAt), 250);
    return () => window.clearInterval(id);
  }, [m.running, startedAt]);

  // O primeiro clique é o tempo 1 do primeiro acorde.
  const state = trainerState(config, Math.max(0, beats - 1));
  const rate = changesPerMinute(state.changes, elapsed);
  useEffect(() => {
    const el = swapRef.current; if (!el || beats === 0) return;
    if (state.beatsLeft === config.beatsPerChord) { el.classList.remove("swap"); void el.offsetWidth; el.classList.add("swap"); }
  }, [state.changes]);

  const setChords = (chords: string[]) => setConfig((c) => ({ ...c, chords }));
  const addChord = () => {
    const name = adding.trim().replace(/\s+/g, "");
    if (!name || !chordTones(name) || config.chords.length >= 8) return;
    setChords([...config.chords, name]); setAdding("");
  };
  const shape = (name: string | null) => (name ? shapesFor(name).shapes[0] ?? null : null);
  const log = async () => {
    if (!exercise) return;
    const n = Number(logValue);
    if (!Number.isInteger(n) || n <= 0) { setLogState({ busy: false, error: "Informe quantas trocas limpas por minuto saíram." }); return; }
    setLogState({ busy: true });
    try {
      await addLog({ id: crypto.randomUUID(), exerciseId: exercise.id, at: new Date().toISOString(), metric: exercise.metrica, count: n, durationSeconds: Math.round(elapsed / 1000), note: `${config.chords.join(" e ")}, ${config.beatsPerChord} tempos por acorde, ${m.bpm} bpm` });
      setLogState({ busy: false, message: "Registrado no Calendário." });
    } catch (e) { setLogState({ busy: false, error: `Não deu para registrar. ${String(e)}` }); }
  };
  const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
  return <div className="trainer">
    <section className="panel trainer-stage" aria-label="Troca de acordes">
      <div className="trainer-now" ref={swapRef} onAnimationEnd={(e) => e.currentTarget.classList.remove("swap")}>
        <ChordCard name={state.current ?? "Escolha os acordes"} diagram={shape(state.current)} size="lg" live={m.running} />
      </div>
      <div className="trainer-side">
        <div className="trainer-countdown" aria-hidden="true">
          {Array.from({ length: config.beatsPerChord }, (_, i) => <span key={i} className={`beat${m.running && beats > 0 && i < config.beatsPerChord - state.beatsLeft + 1 ? " on" : ""}`} />)}
        </div>
        <p className="trainer-next-label muted small">Próximo</p>
        <div className="trainer-next">{state.next && config.chords.length > 1 ? <ChordCard name={state.next} diagram={shape(state.next)} size="sm" /> : <p className="muted small">Adicione outro acorde para trocar.</p>}</div>
        <div className="trainer-transport">
          <button className="btn icon" aria-label="Menos 4 bpm" onClick={() => m.setBpm(m.bpm - 4)}><IconMinus /></button>
          <span className="trainer-bpm num"><b>{m.bpm}</b> bpm</span>
          <button className="btn icon" aria-label="Mais 4 bpm" onClick={() => m.setBpm(m.bpm + 4)}><IconPlus /></button>
          <button className="btn big primary" onClick={m.toggle}>{m.running ? <IconStop /> : <IconPlay />}{m.running ? "Parar" : "Começar"}</button>
        </div>
        <p className="num trainer-stats" role="status">{mmss(elapsed)} · {state.changes} trocas{rate !== null ? ` · ${rate} por minuto` : ""}</p>
      </div>
    </section>

    <div className="panels two trainer-setup">
      <section className="panel" aria-label="Acordes da troca">
        <div className="panel-head"><h2>Acordes</h2></div>
        <ol className="trainer-chords">
          {config.chords.map((c, i) => <li key={`${c}-${i}`}>
            <span className="num">{c}</span>
            <button className="btn ghost" aria-label={`Subir ${c}`} disabled={i === 0 || m.running} onClick={() => { const n = [...config.chords]; [n[i - 1], n[i]] = [n[i]!, n[i - 1]!]; setChords(n); }}>Subir</button>
            <button className="btn ghost" aria-label={`Remover ${c}`} disabled={m.running || config.chords.length <= 1} onClick={() => setChords(config.chords.filter((_, j) => j !== i))}>Remover</button>
          </li>)}
        </ol>
        <form className="trainer-add" onSubmit={(e) => { e.preventDefault(); addChord(); }}>
          <input type="text" placeholder="Outro acorde, como Am7" aria-label="Adicionar acorde" value={adding} onChange={(e) => setAdding(e.target.value)} disabled={m.running || config.chords.length >= 8} aria-invalid={adding.trim() !== "" && !chordTones(adding.trim())} />
          <button className="btn" type="submit" disabled={m.running || !adding.trim() || !chordTones(adding.trim())}>Adicionar</button>
        </form>
        <p className="muted small">Pares do roadmap:</p>
        <div className="trainer-presets">{PRESET_PAIRS.map((p) => <button key={p.join()} className="btn" disabled={m.running} aria-pressed={p.join() === config.chords.join()} onClick={() => setChords(p)}>{p.join(" e ")}</button>)}</div>
      </section>
      <section className="panel" aria-label="Ritmo da troca">
        <div className="panel-head"><h2>Ritmo</h2></div>
        <div className="field"><span className="label">Trocar a cada</span>
          <div className="seg" role="group" aria-label="Tempos por acorde">{BEAT_OPTIONS.map((b) => <button key={b} disabled={m.running} aria-pressed={config.beatsPerChord === b} onClick={() => setConfig((c) => ({ ...c, beatsPerChord: b }))}>{b} {b === 1 ? "tempo" : "tempos"}</button>)}</div>
        </div>
        <p className="muted small">A {m.bpm} bpm, trocando a cada {config.beatsPerChord} {config.beatsPerChord === 1 ? "tempo" : "tempos"}, são {Math.round(m.bpm / config.beatsPerChord)} trocas por minuto. A meta do roadmap é 30 trocas limpas.</p>
        {!m.running && state.changes > 0 && exercise && <form className="trainer-log" onSubmit={(e) => { e.preventDefault(); void log(); }}>
          <p className="small">O metrônomo pediu {state.changes} trocas em {mmss(elapsed)}. Quantas saíram limpas, por minuto?</p>
          <div className="trainer-log-row">
            <input type="number" min={1} step={1} className="num" aria-label="Trocas limpas por minuto" value={logValue} placeholder={rate !== null ? String(rate) : ""} onChange={(e) => setLogValue(e.target.value)} />
            <button className="btn primary" type="submit" disabled={logState.busy}>{logState.busy ? "Registrando…" : `Registrar em ${exercise.nome}`}</button>
          </div>
          {logState.message && <p className="small" role="status">{logState.message}</p>}
          {logState.error && <p className="small error-text" role="alert">{logState.error}</p>}
        </form>}
      </section>
    </div>
  </div>;
}
