// Controle do metrônomo compartilhado pelo app inteiro (painel, atalhos, Hoje).

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { MetronomeSettings, Tick } from "@gx/core";
import { engine, onEngine } from "./engine";
import { useApp } from "./app-state";

const BPM_KEY = "pratica.bpm";
const clampBpm = (n: number) => Math.min(400, Math.max(20, Math.round(n)));

interface MetronomeApi {
  bpm: number;
  running: boolean;
  setBpm: (n: number) => void;
  toggle: () => void;
  start: () => void;
  stop: () => void;
  /** Assina os cliques. O callback roda no momento em que o clique soa. */
  onTick: (fn: (t: Tick) => void) => () => void;
}

const Ctx = createContext<MetronomeApi | null>(null);

export function MetronomeProvider({ children }: { children: ReactNode }) {
  const { settings } = useApp();
  const [bpm, setBpmState] = useState(() => clampBpm(Number(localStorage.getItem(BPM_KEY)) || 60));
  const [running, setRunning] = useState(false);
  const tickFns = useRef(new Set<(t: Tick) => void>());

  const engineSettings: MetronomeSettings = useMemo(
    () => ({
      bpm,
      beatsPerBar: settings.metronome.beatsPerBar,
      subdivision: settings.metronome.subdivision,
      accentFirstBeat: settings.metronome.accentFirstBeat,
      volume: settings.metronome.volume,
      sound: settings.metronome.sound,
    }),
    [bpm, settings.metronome],
  );
  const latest = useRef(engineSettings);
  latest.current = engineSettings;

  useEffect(
    () =>
      onEngine((e) => {
        if (e.type === "metronomeState") setRunning(e.running);
        if (e.type === "tick") {
          // O evento chega antes do som: espera o atraso informado pelo motor
          // para o pulso visual coincidir com o clique.
          const fire = () => tickFns.current.forEach((fn) => fn(e.tick));
          if (e.audibleInMs > 4) window.setTimeout(fire, e.audibleInMs);
          else fire();
        }
      }),
    [],
  );

  useEffect(() => {
    if (running) void engine.updateMetronome(engineSettings);
  }, [engineSettings, running]);

  const setBpm = useCallback((n: number) => {
    const v = clampBpm(n);
    setBpmState(v);
    localStorage.setItem(BPM_KEY, String(v));
  }, []);
  const start = useCallback(() => {
    setRunning(true);
    void engine.startMetronome(settings.metronome.outputDeviceId ?? null, latest.current);
  }, [settings.metronome.outputDeviceId]);
  const stop = useCallback(() => {
    setRunning(false);
    void engine.stopMetronome();
  }, []);
  const toggle = useCallback(() => (running ? stop() : start()), [running, start, stop]);
  const onTick = useCallback((fn: (t: Tick) => void) => {
    tickFns.current.add(fn);
    return () => void tickFns.current.delete(fn);
  }, []);

  const api = useMemo(
    () => ({ bpm, running, setBpm, toggle, start, stop, onTick }),
    [bpm, running, setBpm, toggle, start, stop, onTick],
  );
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useMetronome(): MetronomeApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useMetronome fora do MetronomeProvider");
  return v;
}
