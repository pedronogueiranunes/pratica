import { useEffect, useRef, useState } from "react";
import { noteLabel } from "@gx/core";
import { useApp } from "../lib/app-state";
import { engine, onEngine } from "../lib/engine";
import { useDevices } from "../lib/devices";

const IN_TUNE_CENTS = 3;
const W = 600;
const H = 90;

export function TunerPanel() {
  const { t, settings, update } = useApp();
  const { devices } = useDevices();
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState<{ name: string; octave: number } | null>(null);
  const [inTune, setInTune] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needle = useRef<SVGGElement>(null);
  const centsText = useRef<HTMLDivElement>(null);
  const level = useRef<HTMLDivElement>(null);
  const target = useRef<number | null>(null);
  const shown = useRef(0);
  const lastHeard = useRef(-Infinity);
  const { a4, inputDeviceId, inputChannel } = settings.tuner;
  const inputs = devices.filter((d) => d.isInput && d.inputChannels > 0);
  const selected = inputs.find((d) => d.id === inputDeviceId) ?? inputs.find((d) => d.isDefaultInput);
  const channels = selected?.inputChannels ?? 1;

  useEffect(
    () =>
      onEngine((e) => {
        if (e.type === "tunerState") setRunning(e.running);
        if (e.type === "error") setError(e.message);
        if (e.type !== "pitch") return;
        if (level.current) level.current.style.transform = `scaleX(${Math.min(1, e.level * 8)})`;
        if (e.reading && e.clarity > 0.85) {
          lastHeard.current = performance.now();
          target.current = e.reading.cents;
          setNote((prev) =>
            prev?.name === e.reading!.name && prev.octave === e.reading!.octave
              ? prev
              : { name: e.reading!.name, octave: e.reading!.octave },
          );
          setInTune(Math.abs(e.reading.cents) <= IN_TUNE_CENTS);
        }
      }),
    [],
  );

  // Agulha suavizada a cada quadro, fora do ciclo de render do React.
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const silent = performance.now() - lastHeard.current > 1200;
      const goal = silent ? 0 : (target.current ?? 0);
      shown.current += (goal - shown.current) * 0.22;
      const x = (shown.current / 50) * (W / 2 - 20);
      needle.current?.setAttribute("transform", `translate(${x.toFixed(1)} 0)`);
      if (centsText.current) {
        centsText.current.textContent = silent
          ? running
            ? t("tuner.listening")
            : ""
          : `${shown.current >= 0 ? "+" : ""}${shown.current.toFixed(1).replace(".", ",")} cents`;
      }
      if (silent && note) setNote(null);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, note, t]);

  // Troca de entrada com o afinador ligado: reabre na entrada nova.
  const runningRef = useRef(running);
  runningRef.current = running;
  useEffect(() => {
    if (runningRef.current) void engine.startTuner(inputDeviceId ?? null, inputChannel, a4);
    // a4 muda por setA4, sem reabrir o stream.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputDeviceId, inputChannel]);

  const toggle = () => {
    setError(null);
    if (running) void engine.stopTuner();
    else void engine.startTuner(inputDeviceId ?? null, inputChannel, a4);
  };

  const setA4 = (v: number) => {
    const next = Math.min(450, Math.max(430, v));
    update({ tuner: { a4: next } });
    void engine.setA4(next);
  };

  const ticks = Array.from({ length: 21 }, (_, i) => i - 10);

  return (
    <section className="panel" aria-label={t("tuner.title")}>
      <div className="panel-head">
        <h2>{t("tuner.title")}</h2>
        <span className="spacer" />
        <div className="seg" role="group" aria-label="Referência">
          <button onClick={() => setA4(a4 - 1)} aria-label="Lá mais grave">
            -
          </button>
          <button aria-pressed="true" className="num">
            {t("tuner.reference", { hz: a4 })}
          </button>
          <button onClick={() => setA4(a4 + 1)} aria-label="Lá mais agudo">
            +
          </button>
        </div>
      </div>

      <div className={`tuner-note${inTune ? " in-tune" : ""}${note ? "" : " idle"}`}>
        <span className="big-number">{note ? noteLabel(note.name, "cifra") : "·"}</span>
        <span className="octave">{note?.octave ?? ""}</span>
      </div>

      <svg className="meter" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Desvio em cents">
        {ticks.map((c) => {
          const x = W / 2 + (c / 10) * (W / 2 - 20);
          const major = c % 5 === 0;
          return (
            <line
              key={c}
              x1={x}
              x2={x}
              y1={major ? 22 : 30}
              y2={major ? 62 : 54}
              stroke={c === 0 ? "var(--in-tune)" : "var(--line-strong)"}
              strokeWidth={c === 0 ? 2 : 1.5}
              strokeLinecap="round"
            />
          );
        })}
        <text x={20} y={84} fill="var(--fg-3)" fontSize={12}>
          {t("tuner.flat")}
        </text>
        <text x={W - 20} y={84} fill="var(--fg-3)" fontSize={12} textAnchor="end">
          {t("tuner.sharp")}
        </text>
        <g ref={needle}>
          <line
            x1={W / 2}
            x2={W / 2}
            y1={10}
            y2={74}
            stroke={inTune ? "var(--in-tune)" : "var(--accent)"}
            strokeWidth={3}
            strokeLinecap="round"
          />
        </g>
      </svg>
      <div className="tuner-status" ref={centsText} aria-live="off" />

      <div className="metro-controls">
        <button className="btn big primary" onClick={toggle}>
          {running ? t("tuner.stop") : t("tuner.start")}
        </button>
      </div>

      <div className="field">
        <label htmlFor="tuner-in">{t("tuner.input")}</label>
        <select
          id="tuner-in"
          value={inputDeviceId ?? ""}
          onChange={(e) => update({ tuner: { inputDeviceId: e.target.value || undefined, inputChannel: 0 } })}
        >
          <option value="">{t("devices.default")}</option>
          {inputs.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      {channels > 1 && (
        <div className="field">
          <label htmlFor="tuner-ch">Canal</label>
          <select
            id="tuner-ch"
            value={inputChannel}
            onChange={(e) => update({ tuner: { inputChannel: Number(e.target.value) } })}
          >
            {Array.from({ length: channels }, (_, i) => (
              <option key={i} value={i}>
                {t("tuner.channel", { n: i + 1 })}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="field">
        <span className="label">Sinal</span>
        <div className="level">
          <div ref={level} />
        </div>
      </div>
      {error && <p className="error-text small">{error}</p>}
    </section>
  );
}
