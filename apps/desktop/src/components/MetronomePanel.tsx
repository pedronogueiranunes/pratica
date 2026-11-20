import { useEffect, useRef } from "react";
import { tapTempo, type ClickSound } from "@gx/core";
import { useApp } from "../lib/app-state";
import { useMetronome } from "../lib/metronome";
import { IconMinus, IconPlay, IconPlus, IconStop, IconTap } from "../icons";

const SOUNDS: ClickSound[] = ["madeira", "bip", "aro", "cowbell", "suave"];
const SUBDIVISIONS = [1, 2, 3, 4] as const;
const SUB_NAME: Record<number, string> = { 1: "Semínima", 2: "Colcheia", 3: "Tercina", 4: "Semicolcheia" };

export function MetronomePanel({ compact = false }: { compact?: boolean }) {
  const { t, settings, update } = useApp();
  const m = useMetronome();
  const beatsRef = useRef<HTMLDivElement>(null);
  const taps = useRef<number[]>([]);
  const beatsPerBar = settings.metronome.beatsPerBar;

  // Pulso visual direto no DOM, sem re-render do React a cada clique.
  useEffect(
    () =>
      m.onTick((tick) => {
        const dots = beatsRef.current?.children;
        if (!dots || tick.sub !== 0) return;
        const el = dots[tick.beat] as HTMLElement | undefined;
        if (!el) return;
        el.classList.add("hit");
        window.setTimeout(() => el.classList.remove("hit"), 90);
      }),
    [m],
  );

  const onTap = () => {
    const now = performance.now();
    taps.current = [...taps.current, now].slice(-9);
    const bpm = tapTempo(taps.current);
    if (bpm) m.setBpm(bpm);
  };

  return (
    <section className="panel" aria-label={t("metronome.title")}>
      <div className="panel-head">
        <h2>{t("metronome.title")}</h2>
        <span className="spacer" />
        <span className="muted small">Espaço inicia. Setas mudam o bpm.</span>
      </div>

      <div className="metro-readout">
        <button className="btn icon" onClick={() => m.setBpm(m.bpm - 1)} aria-label="Menos 1 bpm">
          <IconMinus />
        </button>
        <div>
          <div className="big-number" aria-live="polite">
            {m.bpm}
          </div>
          <span className="big-unit">{t("metronome.bpm")}</span>
        </div>
        <button className="btn icon" onClick={() => m.setBpm(m.bpm + 1)} aria-label="Mais 1 bpm">
          <IconPlus />
        </button>
      </div>

      <div className="beats" ref={beatsRef} aria-hidden="true">
        {Array.from({ length: beatsPerBar }, (_, i) => (
          <span key={i} className={`beat${i === 0 && settings.metronome.accentFirstBeat && beatsPerBar > 1 ? " accent" : ""}`} />
        ))}
      </div>

      <div className="metro-controls">
        <button className="btn big primary" onClick={m.toggle}>
          {m.running ? <IconStop /> : <IconPlay />}
          {m.running ? t("metronome.stop") : t("metronome.start")}
        </button>
        <button className="btn big" onClick={onTap}>
          <IconTap />
          {t("metronome.tap")}
        </button>
      </div>

      <input
        type="range"
        min={20}
        max={300}
        value={m.bpm}
        onChange={(e) => m.setBpm(Number(e.target.value))}
        aria-label="bpm"
      />

      {!compact && (
        <div style={{ marginTop: 20 }}>
          <div className="field">
            <span className="label">{t("metronome.sound")}</span>
            <div className="seg" role="group">
              {SOUNDS.map((s) => (
                <button
                  key={s}
                  aria-pressed={settings.metronome.sound === s}
                  onClick={() => update({ metronome: { sound: s } })}
                >
                  {t(`sound.${s}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="vol">{t("metronome.volume")}</label>
            <input
              id="vol"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={settings.metronome.volume}
              onChange={(e) => update({ metronome: { volume: Number(e.target.value) } })}
            />
          </div>
          <div className="field">
            <span className="label">{t("metronome.beats")}</span>
            <div className="seg" role="group">
              {[2, 3, 4, 5, 6, 7].map((n) => (
                <button key={n} aria-pressed={beatsPerBar === n} onClick={() => update({ metronome: { beatsPerBar: n } })}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="label">{t("metronome.subdivision")}</span>
            <div className="seg" role="group">
              {SUBDIVISIONS.map((n) => (
                <button
                  key={n}
                  aria-pressed={settings.metronome.subdivision === n}
                  title={SUB_NAME[n]}
                  onClick={() => update({ metronome: { subdivision: n } })}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="accent">{t("metronome.accent")}</label>
            <input
              id="accent"
              type="checkbox"
              className="switch"
              checked={settings.metronome.accentFirstBeat}
              onChange={(e) => update({ metronome: { accentFirstBeat: e.target.checked } })}
            />
          </div>
        </div>
      )}
    </section>
  );
}
