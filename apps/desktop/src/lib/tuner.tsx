import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { type EngineEvent, type InputProfile, type NoteReading, tuningStatus } from "@gx/core";
import { engine, isNative, onEngine } from "./engine";
import { useApp } from "./app-state";
import { useDevices } from "./devices";

type Stream = Extract<EngineEvent, { type: "tunerStream" }>;
interface TunerState {
  spectrum: Extract<EngineEvent, { type: "spectrum" }> | null;
  observeSpectrum: () => () => void;
  running: boolean;
  pending: boolean;
  error: string | null;
  reading: NoteReading | null;
  clarity: number;
  level: number;
  status: ReturnType<typeof tuningStatus>;
  stream: Stream | null;
  inputMs: number | null;
  bufferFrames: number | null;
  setBuffer: (frames: number | null) => void;
  toggle: () => void;
  saveProfile: () => Promise<boolean>;
}
const Ctx = createContext<TunerState | null>(null);

export function TunerProvider({ children }: { children: ReactNode }) {
  const { settings, update } = useApp();
  const { devices } = useDevices();
  const defaultInputId = devices.find((d) => d.isDefaultInput)?.id;
  const [spectrum, setSpectrum] = useState<Extract<EngineEvent, { type: "spectrum" }> | null>(null);
  const spectrumUsers = useRef(0), lastSpectrum = useRef(0), currentA4 = useRef(settings.tuner.a4);
  currentA4.current = settings.tuner.a4;
  const observeSpectrum = useCallback(() => {
    spectrumUsers.current++;
    if (spectrumUsers.current === 1) void engine.setSpectrum(true).catch((e) => setError(String(e)));
    return () => {
      spectrumUsers.current--;
      if (!spectrumUsers.current) { setSpectrum(null); void engine.setSpectrum(false).catch((e) => setError(String(e))); }
    };
  }, []);
  const [running, setRunning] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pitch, setPitch] = useState({ reading: null as NoteReading | null, clarity: 0, level: 0 });
  const [stream, setStream] = useState<Stream | null>(null);
  const [inputMs, setInputMs] = useState<number | null>(null);
  const [bufferFrames, setBuffer] = useState<number | null>(null);
  const runningRef = useRef(false);
  const streamRef = useRef<Stream | null>(null);
  const lastPitch = useRef(0);
  const profiles = settings.tuner.inputProfiles;
  const { inputDeviceId, inputChannel, a4 } = settings.tuner;
  const selectedProfile = profiles.find((p) => p.deviceId === inputDeviceId);

  useEffect(() => { setBuffer(isNative ? selectedProfile?.bufferFrames ?? null : null); }, [inputDeviceId, selectedProfile?.bufferFrames]);

  useEffect(() => {
    const off = onEngine((e) => {
      if (e.type === "tunerState") {
        runningRef.current = e.running;
        setRunning(e.running);
        setPending(false);
        if (!e.running) { setSpectrum(null); setPitch({ reading: null, clarity: 0, level: 0 }); streamRef.current = null; }
      }
      if (e.type === "tunerStream") {
        streamRef.current = e;
        setStream(e);
        setInputMs(null);
      }
      if (e.type === "spectrum" && runningRef.current && spectrumUsers.current > 0 && e.a4 === currentA4.current) { lastSpectrum.current = performance.now(); setSpectrum(e); }
      if (e.type === "pitch") { lastPitch.current = performance.now(); setPitch(e); }
      if (e.type === "latency" && e.direction === "input" && e.deviceId === streamRef.current?.deviceId) setInputMs(e.ms);
      if (e.type === "error" && e.direction === "input") { setError(e.message); setPending(false); }
    });
    const timer = window.setInterval(() => {
      if (performance.now() - lastSpectrum.current > 1200) setSpectrum((s) => s ? null : s);
      if (performance.now() - lastPitch.current > 1200) setPitch((p) => p.reading || p.level ? { reading: null, clarity: 0, level: 0 } : p);
    }, 300);
    return () => { off(); window.clearInterval(timer); };
  }, []);

  const start = () => {
    setPending(true); setSpectrum(null); setError(null); setPitch({ reading: null, clarity: 0, level: 0 }); setStream(null); streamRef.current = null;
    void engine.startTuner(inputDeviceId ?? null, inputChannel, a4, bufferFrames).catch((e) => { setPending(false); setError(String(e)); });
  };
  useEffect(() => { if (runningRef.current) start(); }, [inputDeviceId, inputChannel, bufferFrames, inputDeviceId ? undefined : defaultInputId]);
  useEffect(() => { setSpectrum(null); void engine.setA4(a4).catch((e) => setError(String(e))); }, [a4]);

  const saveProfile = async () => {
    if (!stream || !running || pending) return false;
    const profile: InputProfile = {
      deviceId: stream.deviceId, channel: stream.channel, bufferFrames: stream.bufferFrames,
      sampleRate: stream.sampleRate, inputMs, source: stream.source, measuredAt: new Date().toISOString(),
    };
    return update({ tuner: { inputDeviceId: profile.deviceId, inputChannel: profile.channel, inputProfiles: [...profiles.filter((p) => p.deviceId !== profile.deviceId).slice(-127), profile] } });
  };
  const toggle = () => {
    if (pending || running) { void engine.stopTuner().catch((e) => { setPending(false); setError(String(e)); }); }
    else start();
  };
  return <Ctx.Provider value={{ spectrum, observeSpectrum, running, pending, error, ...pitch, status: tuningStatus(running, pitch.reading, pitch.clarity, pitch.level), stream, inputMs, bufferFrames, setBuffer, toggle, saveProfile }}>{children}</Ctx.Provider>;
}
export function useTuner() {
  const value = useContext(Ctx);
  if (!value) throw new Error("Afinador sem TunerProvider");
  return value;
}
