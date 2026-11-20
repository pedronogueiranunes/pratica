// Motor de áudio do webapp: Web Audio no lugar do Rust, mesma interface e
// mesmos eventos. Metrônomo agendado à frente no relógio do AudioContext
// (sem depender da precisão do setTimeout) e afinador YIN sobre o microfone.

import {
  detectPitch,
  guessConnection,
  noteFromFrequency,
  rms,
  synthesizeClick,
  type ClickSoundName,
  type DeviceInfo,
  type EngineEvent,
  type MetronomeSettings,
} from "@gx/core";

type Emit = (e: EngineEvent) => void;

const LOOKAHEAD_S = 0.12;
const TICK_MS = 25;

interface Sink extends AudioContext {
  setSinkId?: (id: string) => Promise<void>;
}

export function createWebEngine(emit: Emit) {
  let ctx: Sink | null = null;
  let master: GainNode | null = null;
  let banks = new Map<string, AudioBuffer>();
  let bankSound: ClickSoundName | null = null;

  // Metrônomo
  let settings: MetronomeSettings | null = null;
  let timer = 0;
  let anchorTime = 0;
  let anchorIndex = 0;
  let nextIndex = 0;
  let lastTickTime = 0;
  let outputDevice: string | null = null;

  // Afinador
  let stream: MediaStream | null = null;
  let analyser: AnalyserNode | null = null;
  let tunerTimer = 0;
  let a4 = 440;

  async function ensureCtx(deviceId: string | null) {
    if (!ctx) {
      ctx = new AudioContext({ latencyHint: "interactive" }) as Sink;
      master = ctx.createGain();
      master.connect(ctx.destination);
    }
    if (deviceId !== outputDevice && ctx.setSinkId) {
      try {
        await ctx.setSinkId(deviceId ?? "");
        outputDevice = deviceId;
      } catch {
        // Navegador sem escolha de saída: fica na padrão.
      }
    }
    await ctx.resume();
    return ctx;
  }

  function buildBanks(sound: ClickSoundName) {
    if (!ctx || bankSound === sound) return;
    banks = new Map();
    for (const kind of ["accent", "beat", "subdivision"] as const) {
      const data = synthesizeClick(sound, kind, ctx.sampleRate);
      const buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
      buf.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
      banks.set(kind, buf);
    }
    bankSound = sound;
  }

  const per = (s: MetronomeSettings) => 60 / (s.bpm * s.subdivision);

  function schedule() {
    if (!ctx || !settings || !master) return;
    const s = settings;
    const latency = ((ctx.baseLatency ?? 0) + (ctx.outputLatency ?? 0)) * 1000;
    while (true) {
      const when = anchorTime + (nextIndex - anchorIndex) * per(s);
      if (when > ctx.currentTime + LOOKAHEAD_S) break;
      const i = nextIndex;
      const sub = i % s.subdivision;
      const beatTotal = Math.floor(i / s.subdivision);
      const beat = beatTotal % s.beatsPerBar;
      const accent = s.accentFirstBeat && beat === 0 && sub === 0 && s.beatsPerBar > 1;
      const kind = sub > 0 ? "subdivision" : accent ? "accent" : "beat";
      const src = ctx.createBufferSource();
      src.buffer = banks.get(kind) ?? null;
      src.connect(master);
      src.start(Math.max(when, ctx.currentTime));
      emit({
        type: "tick",
        tick: { index: i, bar: Math.floor(beatTotal / s.beatsPerBar), beat, sub, accent, frame: 0, offsetInBlock: 0 },
        audibleInMs: Math.max(0, (when - ctx.currentTime) * 1000 + latency),
      });
      lastTickTime = when;
      nextIndex++;
    }
  }

  async function listDevices(): Promise<DeviceInfo[]> {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const all = await navigator.mediaDevices.enumerateDevices();
    const byId = new Map<string, DeviceInfo>();
    for (const d of all) {
      if (d.kind !== "audioinput" && d.kind !== "audiooutput") continue;
      if (d.deviceId === "default" || d.deviceId === "communications") continue;
      const input = d.kind === "audioinput";
      const id = `${input ? "in" : "out"}:${d.deviceId}`;
      const label = d.label || (input ? "Entrada de áudio" : "Saída de áudio");
      byId.set(id, {
        id,
        name: label,
        manufacturer: null,
        connection: guessConnection(label),
        isInput: input,
        isOutput: !input,
        isDefaultInput: false,
        isDefaultOutput: false,
        inputChannels: input ? 2 : 0,
        outputChannels: input ? 0 : 2,
        sampleRate: ctx?.sampleRate ?? 48000,
        bufferMin: 128,
        bufferMax: 4096,
        measuredInputMs: null,
        measuredOutputMs: null,
      });
    }
    return [...byId.values()];
  }

  const rawId = (id: string | null) => (id ? id.replace(/^(in|out):/, "") : null);

  if (navigator.mediaDevices?.addEventListener) {
    navigator.mediaDevices.addEventListener("devicechange", () => {
      void listDevices().then((devices) => emit({ type: "devices", devices }));
    });
  }

  return {
    devices: listDevices,
    async startMetronome(deviceId: string | null, s: MetronomeSettings) {
      const c = await ensureCtx(rawId(deviceId));
      buildBanks(s.sound);
      settings = s;
      master!.gain.setTargetAtTime(s.volume, c.currentTime, 0.01);
      anchorTime = c.currentTime + 0.05;
      anchorIndex = 0;
      nextIndex = 0;
      window.clearInterval(timer);
      timer = window.setInterval(schedule, TICK_MS);
      schedule();
      emit({ type: "metronomeState", running: true, deviceId });
      const ms = ((c.baseLatency ?? 0) + (c.outputLatency ?? 0)) * 1000;
      if (ms > 0) emit({ type: "latency", direction: "output", deviceId: deviceId ?? "padrão", ms });
    },
    updateMetronome(s: MetronomeSettings) {
      if (!ctx || !settings) return;
      const tempoChanged = s.bpm !== settings.bpm || s.subdivision !== settings.subdivision;
      if (tempoChanged) {
        // Reancora no último clique: o próximo vem no tempo novo.
        anchorIndex = nextIndex;
        anchorTime = Math.max(lastTickTime + per(s), ctx.currentTime + 0.01);
      }
      buildBanks(s.sound);
      master?.gain.setTargetAtTime(s.volume, ctx.currentTime, 0.01);
      settings = s;
    },
    stopMetronome() {
      window.clearInterval(timer);
      settings = null;
      emit({ type: "metronomeState", running: false, deviceId: null });
    },
    async startTuner(deviceId: string | null, channel: number, ref: number) {
      a4 = ref;
      this.stopTuner(true);
      try {
        const c = await ensureCtx(outputDevice);
        const id = rawId(deviceId);
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            ...(id ? { deviceId: { exact: id } } : {}),
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
        const src = c.createMediaStreamSource(stream);
        const split = c.createChannelSplitter(2);
        analyser = c.createAnalyser();
        analyser.fftSize = 4096;
        src.connect(split);
        split.connect(analyser, Math.min(channel, 1));
        const buf = new Float32Array(analyser.fftSize);
        tunerTimer = window.setInterval(() => {
          if (!analyser) return;
          analyser.getFloatTimeDomainData(buf);
          const level = rms(buf);
          const est = level >= 0.004 ? detectPitch(buf, c.sampleRate) : null;
          const reading = est ? noteFromFrequency(est.frequency, a4) : null;
          emit({ type: "pitch", reading, clarity: est?.clarity ?? 0, level });
        }, 30);
        emit({ type: "tunerState", running: true, deviceId });
        const track = stream.getAudioTracks()[0];
        const lat = (track?.getSettings() as { latency?: number } | undefined)?.latency;
        if (lat) emit({ type: "latency", direction: "input", deviceId: deviceId ?? "padrão", ms: lat * 1000 });
        // Com a permissão dada, os nomes dos dispositivos aparecem.
        emit({ type: "devices", devices: await listDevices() });
      } catch (err) {
        const denied = err instanceof DOMException && err.name === "NotAllowedError";
        emit({
          type: "error",
          code: denied ? "noDevice" : "streamFailed",
          message: denied ? "O navegador não deixou usar o microfone." : String(err),
        });
        emit({ type: "tunerState", running: false, deviceId: null });
      }
    },
    setA4(v: number) {
      a4 = v;
    },
    stopTuner(silent = false) {
      window.clearInterval(tunerTimer);
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      analyser = null;
      if (!silent) emit({ type: "tunerState", running: false, deviceId: null });
    },
  };
}
