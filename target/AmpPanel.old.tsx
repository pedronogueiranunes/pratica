import { useEffect, useState } from "react";
import { useApp } from "../lib/app-state";
import { amp, isNative, type AmpStatus } from "../lib/engine";
import { useDevices } from "../lib/devices";

const LEVELS = [
  { db: -24, label: "-24 dB (padrão)" },
  { db: -18, label: "-18 dB" },
  { db: -12, label: "-12 dB (alto)" },
];
const KEY = "pratica.amp.v1";

interface Saved { deviceId?: string; modelPath?: string; input: number; output: number; frames: 64 | 128; db: number }
function load(): Saved {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Saved>;
    return { deviceId: raw.deviceId, modelPath: raw.modelPath, input: raw.input ?? 1, output: raw.output ?? 1, frames: raw.frames === 128 ? 128 : 64, db: LEVELS.some((l) => l.db === raw.db) ? raw.db! : -24 };
  } catch { return { input: 1, output: 1, frames: 64, db: -24 }; }
}

export function AmpPanel() {
  const { devices } = useDevices();
  const { settings } = useApp();
  const [cfg, setCfg] = useState<Saved>(load);
  const [status, setStatus] = useState<AmpStatus | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const save = (patch: Partial<Saved>) => setCfg((c) => { const next = { ...c, ...patch }; try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {} return next; });

  const interfaces = devices.filter((d) => d.isInput && d.isOutput && d.inputChannels > 0 && d.outputChannels > 0 && d.connection !== "bluetooth" && d.connection !== "builtIn");
  const device = interfaces.find((d) => d.id === cfg.deviceId) ?? interfaces[0];
  const running = !!status?.running;
  void settings;

  useEffect(() => {
    if (!isNative) return;
    let alive = true;
    const tick = () => void amp.status().then((s) => { if (alive) setStatus(s); }).catch(() => {});
    tick();
    const id = window.setInterval(tick, 500);
    return () => { alive = false; window.clearInterval(id); };
  }, []);

  if (!isNative) {
    return (
      <section className="panel" aria-label="Amp">
        <div className="panel-head"><h2>Amp</h2></div>
        <p className="muted">O Amp roda só no app para Mac, com a interface de áudio conectada.</p>
      </section>
    );
  }

  const pick = async () => {
    setError("");
    try { const path = await amp.pickModel(); if (path) save({ modelPath: path }); } catch (e) { setError(String(e)); }
  };
  const start = async () => {
    if (!device || !cfg.modelPath) return;
    setBusy(true); setError("");
    try {
      await amp.start({ deviceId: device.id, modelPath: cfg.modelPath, inputChannel: cfg.input, outputChannel: cfg.output, frames: cfg.frames, outputDb: cfg.db });
      setStatus(await amp.status());
    } catch (e) { setError(String(e)); } finally { setBusy(false); }
  };
  const stop = async () => { try { await amp.stop(); } catch (e) { setError(String(e)); } };
  const modelName = cfg.modelPath?.split("/").pop();
  const channelOptions = (n: number) => Array.from({ length: Math.max(1, Math.min(n, 16)) }, (_, i) => i + 1);

  return (
    <section className="panel amp-panel" aria-label="Amp">
      <div className="panel-head">
        <h2>Amp</h2>
        <span className="spacer" />
        <span className="muted">Teste da A0 · NAM</span>
      </div>
      <p className="muted">Use fones com fio na interface e desligue o monitoramento direto dela. Metrônomo e afinador ficam parados enquanto o Amp está ligado.</p>
      {interfaces.length === 0 && <p className="muted">Conecte uma interface de áudio externa com entrada e saída (sem Bluetooth).</p>}
      <div className="field"><label htmlFor="amp-device">Interface</label>
        <select id="amp-device" disabled={running} value={device?.id ?? ""} onChange={(e) => save({ deviceId: e.target.value })}>
          {interfaces.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <div className="field"><label htmlFor="amp-in">Entrada</label>
        <select id="amp-in" disabled={running} value={cfg.input} onChange={(e) => save({ input: Number(e.target.value) })}>
          {channelOptions(device?.inputChannels ?? 1).map((n) => <option key={n} value={n}>Entrada {n}</option>)}
        </select>
      </div>
      <div className="field"><label htmlFor="amp-out">Saída</label>
        <select id="amp-out" disabled={running} value={cfg.output} onChange={(e) => save({ output: Number(e.target.value) })}>
          {channelOptions(device?.outputChannels ?? 1).map((n) => <option key={n} value={n}>Saída {n} (um canal)</option>)}
        </select>
      </div>
      <div className="field"><label htmlFor="amp-frames">Buffer</label>
        <select id="amp-frames" disabled={running} value={cfg.frames} onChange={(e) => save({ frames: Number(e.target.value) === 128 ? 128 : 64 })}>
          <option value={64}>64 amostras (menor atraso)</option>
          <option value={128}>128 amostras (mais folga)</option>
        </select>
      </div>
      <div className="field"><label htmlFor="amp-level">Volume de saída</label>
        <select id="amp-level" disabled={running} value={cfg.db} onChange={(e) => save({ db: Number(e.target.value) })}>
          {LEVELS.map((l) => <option key={l.db} value={l.db}>{l.label}</option>)}
        </select>
      </div>
      <div className="field"><span className="label">Modelo</span>
        <div className="row">
          <button className="btn" disabled={running} onClick={() => void pick()}>{modelName ? "Trocar .nam" : "Escolher .nam"}</button>
          <span className="muted">{modelName ?? "Nenhum modelo escolhido"}</span>
        </div>
      </div>
      <div className="row amp-actions">
        {!running
          ? <button className="btn primary big" disabled={busy || !device || !cfg.modelPath} onClick={() => void start()}>{busy ? "Carregando..." : "Ligar Amp"}</button>
          : <button className="btn big" onClick={() => void stop()}>Desligar Amp</button>}
      </div>
      {error && <p role="alert" className="amp-error">{error}</p>}
      {status && (
        <dl className="amp-stats" aria-live="polite">
          <div><dt>Estado</dt><dd>{status.running ? "Ligado" : "Desligado"}{status.running && !status.ok ? " · atenção" : ""}</dd></div>
          <div><dt>Modelo</dt><dd>{status.info.modelName} · {status.info.sampleRate / 1000} kHz · {status.info.frames} amostras</dd></div>
          <div><dt>CPU do áudio</dt><dd>média {status.loadAvgPercent.toFixed(0)}% · pico {status.loadMaxPercent.toFixed(0)}%</dd></div>
          <div><dt>Entrada clipada</dt><dd>{status.inputClips === 0 ? "nenhuma" : `${status.inputClips} (abaixe o ganho da interface)`}</dd></div>
          <div><dt>Falhas</dt><dd>{status.errorFlags + status.inputOverflows + status.outputUnderruns + status.resyncedSamples + status.invalidSamples === 0 ? "nenhuma" : `erro ${status.errorFlags} · overflow ${status.inputOverflows} · underrun ${status.outputUnderruns}`}</dd></div>
        </dl>
      )}
    </section>
  );
}
