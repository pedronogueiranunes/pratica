import { useEffect, useRef, useState } from "react";
import { displayedCents, noteLabel, type TuningStatus } from "@gx/core";
import { useApp } from "../lib/app-state";
import { engine, isNative } from "../lib/engine";
import { suggestion, useDevices } from "../lib/devices";
import { useTuner } from "../lib/tuner";

const LABEL: Record<TuningStatus, string> = {
  stopped: "Afinador desligado", listening: "Toque uma corda", weak: "Sinal baixo. Aproxime o microfone ou ajuste o ganho.",
  unstable: "Toque uma corda por vez e deixe soar", flat: "Aperte um pouco", sharp: "Solte um pouco", inTune: "Afinada",
};
const W = 600;
export function TunerPanel() {
  const { t, settings, update } = useApp();
  const { devices, instrument } = useDevices();
  const tuner = useTuner();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const needle = useRef<SVGGElement>(null);
  const centsText = useRef<HTMLDivElement>(null);
  const shown = useRef(0);
  const { a4, inputDeviceId, inputChannel, inputProfiles } = settings.tuner;
  const inputs = devices.filter((d) => d.isInput && d.inputChannels > 0);
  const selected = inputs.find((d) => d.id === inputDeviceId) ?? (!inputDeviceId ? inputs.find((d) => d.isDefaultInput) : undefined);
  const missing = !!inputDeviceId && !inputs.some((d) => d.id === inputDeviceId);
  const channels = tuner.running && tuner.stream ? tuner.stream.channels : selected?.inputChannels ?? 1;
  const recommended = suggestion(instrument, inputDeviceId, devices, true);
  const profile = inputProfiles.find((p) => p.deviceId === (tuner.stream?.deviceId ?? inputDeviceId ?? selected?.id));
  const reading = tuner.status === "flat" || tuner.status === "sharp" || tuner.status === "inTune" ? tuner.reading : null;
  const current = useRef({ reading, running: tuner.running });
  current.current = { reading, running: tuner.running };
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const value = current.current.reading;
      shown.current += (displayedCents(value?.cents ?? 0) - shown.current) * (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 0.22);
      needle.current?.setAttribute("transform", `translate(${(shown.current / 50 * 280).toFixed(1)} 0)`);
      if (centsText.current) centsText.current.textContent = value ? `${value.cents >= 0 ? "+" : ""}${value.cents.toFixed(1).replace(".", ",")} cents · ${value.frequency.toFixed(1).replace(".", ",")} Hz` : "";
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => { setSaved(false); }, [tuner.stream, tuner.bufferFrames, inputChannel]);
  const chooseInput = (id: string) => {
    const savedProfile = inputProfiles.find((p) => p.deviceId === id);
    void update({ tuner: { inputDeviceId: id || undefined, inputChannel: savedProfile?.channel ?? 0 } });
  };
  const save = async () => {
    setSaving(true);
    try { setSaved(await tuner.saveProfile()); } finally { setSaving(false); }
  };
  return (
    <section className="panel" aria-label={t("tuner.title")}>
      <div className="panel-head">
        <h2>{t("tuner.title")}</h2>
        <span className="spacer" />
        <div className="seg" role="group" aria-label="Referência do Lá">
          <button disabled={a4 <= 430} onClick={() => void update({ tuner: { a4: a4 - 1 } })} aria-label="Lá mais grave">-</button>
          <span className="num tuner-reference">Lá {a4} Hz</span>
          <button disabled={a4 >= 450} onClick={() => void update({ tuner: { a4: a4 + 1 } })} aria-label="Lá mais agudo">+</button>
        </div>
      </div>
      <div className={`tuner-note${tuner.status === "inTune" ? " in-tune" : ""}${reading ? "" : " idle"}`} aria-label={reading ? `${noteLabel(reading.name, "cifra")}, oitava ${reading.octave}` : "Sem nota"}>
        <span className="big-number">{reading ? noteLabel(reading.name, "cifra") : "·"}</span>
        <span className="octave">{reading?.octave ?? ""}</span>
      </div>
      <svg className="meter" viewBox="0 0 600 90" role="img" aria-label="Desvio de menos 50 a mais 50 cents">
        {Array.from({ length: 21 }, (_, i) => i - 10).map((c) => (
          <line key={c} x1={300 + c * 28} x2={300 + c * 28} y1={c % 5 === 0 ? 22 : 30} y2={c % 5 === 0 ? 62 : 54} stroke={c === 0 ? "var(--in-tune)" : "var(--line-strong)"} strokeWidth={c === 0 ? 2 : 1.5} />
        ))}
        <text x={20} y={84} fill="var(--fg-2)" fontSize={12}>-50 · Grave</text>
        <text x={W - 20} y={84} fill="var(--fg-2)" fontSize={12} textAnchor="end">Agudo · +50</text>
        <g ref={needle}><line x1={300} x2={300} y1={10} y2={74} stroke={tuner.status === "inTune" ? "var(--in-tune)" : "var(--accent)"} strokeWidth={3} /></g>
      </svg>
      <div className="tuner-status" ref={centsText} aria-live="off" />
      <p className={`tuner-instruction${tuner.status === "inTune" ? " in-tune" : ""}`} role="status">{tuner.pending ? "Abrindo a entrada…" : `${reading ? `${noteLabel(reading.name, "cifra")}${reading.octave}. ` : ""}${LABEL[tuner.status]}`}</p>
      <div className="metro-controls">
        <button className="btn big primary" onClick={tuner.toggle}>{tuner.pending ? "Cancelar" : tuner.running ? t("tuner.stop") : t("tuner.start")}</button>
      </div>
      {tuner.running && tuner.stream && <p className="muted small" role="status">Ouvindo: {devices.find((d) => d.id === tuner.stream!.deviceId)?.name ?? "entrada ativa"}, canal {tuner.stream.channel + 1}.</p>}
      <div className="field">
        <label htmlFor="tuner-in">{t("tuner.input")}</label>
        <select id="tuner-in" value={inputDeviceId ?? ""} onChange={(e) => chooseInput(e.target.value)} disabled={tuner.pending}>
          <option value="">{t("devices.default")}</option>
          {missing && <option value={inputDeviceId}>Entrada desconectada</option>}
          {inputs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      {missing && <p className="error-text small">A entrada salva não está disponível. Escolha outra ou use a padrão.</p>}
      {(channels > 1 || inputChannel > 0) && <div className="field">
        <label htmlFor="tuner-ch">Canal</label>
        <select id="tuner-ch" value={inputChannel} disabled={tuner.pending} onChange={(e) => void update({ tuner: { inputChannel: Number(e.target.value) } })}>
          {inputChannel >= channels && <option value={inputChannel}>Canal {inputChannel + 1} indisponível</option>}
          {Array.from({ length: channels }, (_, i) => <option key={i} value={i}>{t("tuner.channel", { n: i + 1 })}</option>)}
        </select>
      </div>}
      <div className="field">
        <span className="label">Sinal</span>
        <div className="level" role="meter" aria-label="Nível de entrada" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(1, tuner.level * 8) * 100)}><div style={{ transform: `scaleX(${Math.min(1, tuner.level * 8)})` }} /></div>
      </div>
      {recommended && <div className="notice tuner-notice"><span>Entrada sugerida: {inputs.find((d) => d.id === recommended.deviceId)?.name}</span><button className="btn" disabled={tuner.pending} onClick={() => chooseInput(recommended.deviceId)}>Usar entrada</button></div>}
      <details className="tuner-profile">
        <summary>Perfil da entrada{profile ? " salvo" : ""}</summary>
        {isNative ? <div className="field">
          <label htmlFor="tuner-buffer">Buffer solicitado</label>
          <select id="tuner-buffer" value={tuner.bufferFrames ?? ""} disabled={tuner.pending || !selected} onChange={(e) => tuner.setBuffer(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Automático</option>
            {[64, 128, 256, 512, 1024, 2048].filter((n) => selected?.bufferMin != null && selected.bufferMax != null && n >= selected.bufferMin && n <= selected.bufferMax).map((n) => <option key={n} value={n}>{n} amostras</option>)}
            {tuner.bufferFrames && ![64,128,256,512,1024,2048].includes(tuner.bufferFrames) && <option value={tuner.bufferFrames}>{tuner.bufferFrames} amostras</option>}
          </select>
        </div> : <p className="muted small">O navegador escolhe o buffer. A permissão de microfone libera os nomes das entradas.</p>}
        {tuner.running && tuner.stream && <p className="num small">{devices.find((d) => d.id === tuner.stream!.deviceId)?.name ?? "Entrada ativa"} · canal {tuner.stream.channel + 1} · {tuner.stream.sampleRate.toLocaleString("pt-BR")} Hz</p>}
        <p className="small">{tuner.running && tuner.inputMs !== null ? `${tuner.inputMs.toFixed(1).replace(".", ",")} ms ${isNative ? "pelos timestamps de captura" : "informados pelo navegador"}` : "Latência atual não informada."}</p>
        {profile && <p className="muted small">Último perfil: canal {profile.channel + 1}, {profile.bufferFrames ? `${profile.bufferFrames} amostras solicitadas` : "buffer automático"}{profile.inputMs !== null ? `, ${profile.inputMs.toFixed(1).replace(".", ",")} ms` : ""}. {new Date(profile.measuredAt).toLocaleString("pt-BR")}</p>}
        <p className="muted small">A análise usa 4.096 amostras{tuner.stream ? `, cerca de ${Math.round(4096000 / tuner.stream.sampleRate)} ms de janela` : ""}. Isso se soma à captura. Não é uma medição de ida e volta.</p>
        <p className="muted small">Salvar mantém esta entrada selecionada, mesmo se o padrão do sistema mudar.</p>
        <button className="btn" disabled={!tuner.running || tuner.pending || saving || !tuner.stream} onClick={() => void save()}>{saving ? "Salvando…" : "Salvar perfil da entrada"}</button>
        {saved && <p role="status" className="small">Perfil salvo neste aparelho. A entrada fica selecionada.</p>}
      </details>
      {tuner.error && <p className="error-text small" role="alert">{tuner.error}</p>}
    </section>
  );
}
