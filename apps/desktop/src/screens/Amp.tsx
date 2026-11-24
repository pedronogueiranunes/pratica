import { useEffect, useRef, useState } from "react";
import { amp, isNative, type AmpMeters, type AmpStatus } from "../lib/engine";
import { useDevices } from "../lib/devices";
import { Knob } from "../components/Knob";
import { Meter } from "../components/Meter";
import { Scope } from "../components/Scope";
import { Pedal } from "../components/Pedal";
import { FX_PEDALS, fxDefaults, fxFlatten, fxSanitize, type FxState } from "@gx/core";

const KEY = "pratica.amp.v2";
const OLD_KEY = "pratica.amp.v1";
const FX_KEY = "pratica.amp.fx.v1";
function loadFx(): FxState { try { return fxSanitize(JSON.parse(localStorage.getItem(FX_KEY) ?? "null")); } catch { return fxDefaults(); } }
interface Saved { deviceId?: string; modelPath?: string; input: number; output: number; frames: 64 | 128; gainDb: number; mix: number }

function load(): Saved {
  const base: Saved = { input: 1, output: 1, frames: 64, gainDb: 0, mix: 1 };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? localStorage.getItem(OLD_KEY) ?? "{}") as Partial<Saved>;
    return {
      deviceId: raw.deviceId, modelPath: raw.modelPath,
      input: raw.input ?? 1, output: raw.output ?? 1, frames: raw.frames === 128 ? 128 : 64,
      gainDb: typeof raw.gainDb === "number" ? Math.min(0, Math.max(-48, raw.gainDb)) : base.gainDb,
      mix: typeof raw.mix === "number" ? Math.min(1, Math.max(0, raw.mix)) : base.mix,
    };
  } catch { return base; }
}

const EMPTY: AmpMeters = { inPeak: 0, outPeak: 0, scopeIn: [], scopeOut: [] };

export function Amp() {
  const { devices } = useDevices();
  const [cfg, setCfg] = useState<Saved>(load);
  const [fx, setFx] = useState<FxState>(loadFx);
  const [status, setStatus] = useState<AmpStatus | null>(null);
  const [meters, setMeters] = useState<AmpMeters>(EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const save = (patch: Partial<Saved>) => setCfg((c) => { const next = { ...c, ...patch }; try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* sem armazenamento */ } return next; });
  const interfaces = devices.filter((d) => d.isInput && d.isOutput && d.inputChannels > 0 && d.outputChannels > 0 && d.connection !== "bluetooth" && d.connection !== "builtIn");
  const device = interfaces.find((d) => d.id === cfg.deviceId) ?? interfaces[0];
  const running = !!status?.running;
  const latest = useRef(cfg);
  latest.current = cfg;

  useEffect(() => {
    if (!isNative) return;
    let alive = true;
    const tick = () => void amp.status().then((s) => { if (alive) setStatus(s); }).catch(() => {});
    tick();
    const id = window.setInterval(tick, 500);
    return () => { alive = false; window.clearInterval(id); };
  }, []);

  useEffect(() => {
    if (!isNative || !running) { setMeters(EMPTY); return; }
    let alive = true, pending = false;
    const id = window.setInterval(() => {
      if (pending || document.hidden) return;
      pending = true;
      void amp.meters().then((m) => { if (alive && m) setMeters(m); }).catch(() => {}).finally(() => { pending = false; });
    }, 40);
    return () => { alive = false; window.clearInterval(id); };
  }, [running]);

  const saveFx = (next: FxState) => { setFx(next); try { localStorage.setItem(FX_KEY, JSON.stringify(next)); } catch { /* sem armazenamento */ } };
  const setPedal = (id: string, patch: Partial<FxState[string]>) => saveFx({ ...fx, [id]: { ...fx[id]!, ...patch } });
  // Efeitos valem na hora, com o Amp ligado.
  useEffect(() => { if (running) void amp.fxSet(fxFlatten(fx)).catch(() => {}); }, [running, fx]);
  // Knobs valem na hora, com o Amp ligado.
  useEffect(() => { if (running) void amp.set(cfg.mix, cfg.gainDb).catch(() => {}); }, [running, cfg.mix, cfg.gainDb]);

  if (!isNative) return <div className="screen"><header className="screen-head"><h1>Amp</h1></header><p className="muted">O Amp roda só no app para Mac, com a interface de áudio conectada.</p></div>;

  const pick = async () => { setError(""); try { const path = await amp.pickModel(); if (path) save({ modelPath: path }); } catch (e) { setError(String(e)); } };
  const start = async () => {
    if (!device || !cfg.modelPath) { setOpen(true); return; }
    setBusy(true); setError("");
    try {
      await amp.start({ deviceId: device.id, modelPath: cfg.modelPath, inputChannel: cfg.input, outputChannel: cfg.output, frames: cfg.frames, outputDb: -12, mix: cfg.mix, gainDb: cfg.gainDb, fx: fxFlatten(fx) });
      setStatus(await amp.status());
    } catch (e) { setError(String(e)); } finally { setBusy(false); }
  };
  const stop = async () => { try { await amp.stop(); } catch (e) { setError(String(e)); } };
  const modelName = cfg.modelPath?.split("/").pop();
  const channels = (n: number) => Array.from({ length: Math.max(1, Math.min(n, 16)) }, (_, i) => i + 1);
  const setupOpen = open || !running && (!cfg.modelPath || !device);
  const faults = status ? status.errorFlags + status.inputOverflows + status.outputUnderruns + status.resyncedSamples + status.invalidSamples : 0;
  const mixLabel = (v: number) => v >= 0.995 ? "100% amp" : v <= 0.005 ? "só dry" : `${Math.round(v * 100)}% amp`;

  return <div className="screen amp-screen">
    <header className="screen-head amp-head">
      <h1>Amp</h1>
      <span className={`amp-pill${running ? (status?.ok ? " is-on" : " is-warn") : ""}`} role="status">{running ? (status?.ok ? "Ligado" : "Atenção") : "Desligado"}</span>
      <span className="spacer" />
      {!running
        ? <button className="btn primary big" disabled={busy || !device || !cfg.modelPath} onClick={() => void start()}>{busy ? "Carregando..." : "Ligar Amp"}</button>
        : <button className="btn big" onClick={() => void stop()}>Desligar Amp</button>}
    </header>
    {error && <p role="alert" className="amp-error">{error}</p>}
    {interfaces.length === 0 && <p className="muted">Conecte uma interface de áudio externa com entrada e saída (sem Bluetooth).</p>}

    <section className="panel amp-stage" aria-label="Controles do Amp">
      <div className="amp-knobs">
        <Knob label="Volume" value={cfg.gainDb} min={-48} max={0} step={1} defaultValue={0} format={(v) => `${v} dB`} onChange={(gainDb) => save({ gainDb })} />
        <Knob label="Dry / Wet" value={cfg.mix} min={0} max={1} step={0.01} defaultValue={1} format={mixLabel} onChange={(mix) => save({ mix })} />
      </div>
      <div className="amp-meters">
        <Meter label="Entrada" peak={meters.inPeak} running={running} />
        <Meter label="Saída" peak={meters.outPeak} running={running} />
        {status && status.inputClips > 0 && <p className="amp-warn small">Entrada estourou {status.inputClips}x. Abaixe o ganho na interface.</p>}
      </div>
      <div className="amp-scope">
        <Scope input={meters.scopeIn} output={meters.scopeOut} running={running} />
        <div className="amp-scope-legend small"><span><i className="dot dry" />Guitarra (dry)</span><span><i className="dot wet" />Saída</span></div>
      </div>
    </section>

    <section className="panel amp-fx" aria-label="Pedais">
      <div className="amp-fx-head">
        <h2>Pedais</h2>
        <ol className="amp-chain small" aria-label="Ordem dos efeitos">
          {FX_PEDALS.filter((p) => p.place === "pre").map((p) => <li key={p.id} className={fx[p.id]?.on ? "is-on" : ""}>{p.name.split(" ")[0]}</li>)}
          <li className="amp-chain-amp">Amp</li>
          {FX_PEDALS.filter((p) => p.place === "post").map((p) => <li key={p.id} className={fx[p.id]?.on ? "is-on" : ""}>{p.name.split(" ")[0]}</li>)}
        </ol>
        <span className="spacer" />
        <button className="btn" disabled={!FX_PEDALS.some((p) => fx[p.id]?.on)} onClick={() => saveFx(Object.fromEntries(FX_PEDALS.map((p) => [p.id, { ...fx[p.id]!, on: false }])))}>Desligar todos</button>
        <button className="btn ghost" onClick={() => saveFx(fxDefaults())}>Restaurar padrões</button>
      </div>
      <div className="pedal-board">
        {FX_PEDALS.map((p) => <Pedal key={p.id} pedal={p} on={!!fx[p.id]?.on} values={fx[p.id]?.values ?? []} onToggle={(on) => setPedal(p.id, { on })} onChange={(i, v) => setPedal(p.id, { values: (fx[p.id]?.values ?? []).map((x, k) => (k === i ? v : x)) })} />)}
      </div>
    </section>

    <section className="panel amp-setup" aria-label="Configuração do Amp">
      <button className="amp-setup-head" aria-expanded={setupOpen} onClick={() => setOpen(!setupOpen)}>
        <h2>Configuração</h2>
        <span className="muted small">{modelName ?? "Escolha um modelo .nam"}{device ? ` · ${device.name}` : ""}</span>
      </button>
      {setupOpen && <div className="amp-setup-body">
        <p className="muted small">Use fones com fio na interface e desligue o monitoramento direto dela. Metrônomo e afinador ficam parados enquanto o Amp está ligado. O volume nunca passa do teto fixo de saída (-12 dB).</p>
        <div className="field"><label htmlFor="amp-device">Interface</label>
          <select id="amp-device" disabled={running} value={device?.id ?? ""} onChange={(e) => save({ deviceId: e.target.value })}>{interfaces.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
        <div className="field"><label htmlFor="amp-in">Entrada</label>
          <select id="amp-in" disabled={running} value={cfg.input} onChange={(e) => save({ input: Number(e.target.value) })}>{channels(device?.inputChannels ?? 1).map((n) => <option key={n} value={n}>Entrada {n}</option>)}</select></div>
        <div className="field"><label htmlFor="amp-out">Saída</label>
          <select id="amp-out" disabled={running} value={cfg.output} onChange={(e) => save({ output: Number(e.target.value) })}>{channels(device?.outputChannels ?? 1).map((n) => <option key={n} value={n}>Saída {n} (um canal)</option>)}</select></div>
        <div className="field"><label htmlFor="amp-frames">Buffer</label>
          <select id="amp-frames" disabled={running} value={cfg.frames} onChange={(e) => save({ frames: Number(e.target.value) === 128 ? 128 : 64 })}><option value={64}>64 amostras (menor atraso)</option><option value={128}>128 amostras (mais folga)</option></select></div>
        <div className="field"><span className="label">Modelo</span>
          <div className="row"><button className="btn" disabled={running} onClick={() => void pick()}>{modelName ? "Trocar .nam" : "Escolher .nam"}</button><span className="muted">{modelName ?? "Nenhum modelo escolhido"}</span></div></div>
      </div>}
    </section>

    {status && <dl className="amp-stats" aria-live="polite">
      <div><dt>Modelo</dt><dd>{status.info.modelName} · {status.info.sampleRate / 1000} kHz · {status.info.frames} amostras</dd></div>
      <div><dt>CPU do áudio</dt><dd>média {status.loadAvgPercent.toFixed(0)}% · pico {status.loadMaxPercent.toFixed(0)}%</dd></div>
      <div><dt>Falhas</dt><dd>{faults === 0 ? "nenhuma" : `erro ${status.errorFlags} · overflow ${status.inputOverflows} · underrun ${status.outputUnderruns}`}</dd></div>
    </dl>}
  </div>;
}
