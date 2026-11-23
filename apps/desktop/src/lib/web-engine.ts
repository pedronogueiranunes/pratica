// Motor de áudio do webapp: Web Audio no lugar do Rust, mesma interface e
// mesmos eventos. Metrônomo agendado à frente no relógio do AudioContext
// (sem depender da precisão do setTimeout) e afinador YIN sobre o microfone.

import {
  detectPitch,
  guessConnection,
  noteFromFrequency,
  rms,
  synthesizeClick,
  synthesizeChordPreview,
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
  let output: WaveShaperNode | null = null;
  let banks = new Map<string, AudioBuffer>();
  let bankSound: ClickSoundName | null = null;
  let previewGeneration = 0;
  let preview: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  let previewTail: { source: AudioBufferSourceNode; gain: GainNode } | null = null;

  function stopPreview() {
    previewGeneration++;
    if (previewTail) {
      previewTail.source.stop(); previewTail.source.disconnect(); previewTail.gain.disconnect(); previewTail = null;
    }
    if (!preview || !ctx) return;
    const old = preview; preview = null; previewTail = old;
    old.gain.gain.cancelScheduledValues(ctx.currentTime);
    old.gain.gain.setValueAtTime(old.gain.gain.value, ctx.currentTime);
    old.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.01);
    old.source.stop(ctx.currentTime + 0.012);
  }

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
  let tunerGeneration = 0;
  let tunerSource: MediaStreamAudioSourceNode | null = null;
  let tunerSplit: ChannelSplitterNode | null = null;
  const inputCapabilities = new Map<string, { channels: number; sampleRate: number }>();

  async function ensureCtx(deviceId: string | null) {
    if (!ctx) {
      ctx = new AudioContext({ latencyHint: "interactive" }) as Sink;
      master = ctx.createGain();
      output = ctx.createWaveShaper();
      const curve = new Float32Array(65537);
      for (let i = 0; i < curve.length; i++) curve[i] = Math.max(-0.98, Math.min(0.98, i * 2 / (curve.length - 1) - 1));
      output.curve = curve;
      master.connect(output); output.connect(ctx.destination);
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
    const defaultInputGroup = all.find((d) => d.kind === "audioinput" && d.deviceId === "default")?.groupId;
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
        isDefaultInput: input && !!defaultInputGroup && d.groupId === defaultInputGroup,
        isDefaultOutput: false,
        inputChannels: input ? (inputCapabilities.get(id)?.channels ?? 1) : 0,
        outputChannels: input ? 0 : 2,
        sampleRate: input ? (inputCapabilities.get(id)?.sampleRate ?? null) : (ctx?.sampleRate ?? null),
        bufferMin: null,
        bufferMax: null,
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
    stopPreview,
    async previewChord(deviceId: string | null, frequencies: number[], volume: number) {
      stopPreview();
      const generation = previewGeneration;
      // Mantém a saída do metrônomo enquanto ele estiver ativo.
      const c = await ensureCtx(settings ? outputDevice : rawId(deviceId));
      if (generation !== previewGeneration) return;
      const data = synthesizeChordPreview(frequencies, c.sampleRate, volume);
      const buffer = c.createBuffer(1, data.length, c.sampleRate);
      buffer.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
      const source = c.createBufferSource(), gain = c.createGain();
      source.buffer = buffer; source.connect(gain); gain.connect(output!);
      const voice = { source, gain }; preview = voice;
      source.onended = () => {
        source.disconnect(); gain.disconnect();
        if (preview === voice) preview = null;
        if (previewTail === voice) previewTail = null;
      };
      source.start();
    },
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
      const generation = tunerGeneration;
      let acquired: MediaStream | null = null;
      try {
        const c = await ensureCtx(outputDevice);
        if (generation !== tunerGeneration) return;
        const id = rawId(deviceId);
        acquired = await navigator.mediaDevices.getUserMedia({
          audio: {
            ...(id ? { deviceId: { exact: id } } : {}),
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
        if (generation !== tunerGeneration) { acquired.getTracks().forEach((t) => t.stop()); return; }
        stream = acquired;
        const track = stream.getAudioTracks()[0];
        if (!track) throw new Error("Nenhuma entrada disponível.");
        const actual = track.getSettings();
        const actualId = actual.deviceId ? `in:${actual.deviceId}` : deviceId;
        if (!actualId) throw new Error("Não foi possível identificar a entrada. Escolha um dispositivo.");
        const channels = actual.channelCount ?? 1;
        inputCapabilities.set(actualId, { channels, sampleRate: c.sampleRate });
        if (channel >= channels) throw new Error("Canal indisponível. Escolha outro canal.");
        const src = c.createMediaStreamSource(stream);
        const split = c.createChannelSplitter(channels);
        tunerSource = src;
        tunerSplit = split;
        analyser = c.createAnalyser();
        analyser.fftSize = 4096;
        src.connect(split);
        split.connect(analyser, channel);
        const buf = new Float32Array(analyser.fftSize);
        tunerTimer = window.setInterval(() => {
          if (!analyser) return;
          analyser.getFloatTimeDomainData(buf);
          const level = rms(buf);
          const est = level >= 0.004 ? detectPitch(buf, c.sampleRate) : null;
          const reading = est ? noteFromFrequency(est.frequency, a4) : null;
          emit({ type: "pitch", reading, clarity: est?.clarity ?? 0, level });
        }, 30);
        track.addEventListener("ended", () => {
          if (generation !== tunerGeneration) return;
          this.stopTuner();
          emit({ type: "error", code: "deviceLost", direction: "input", message: "A entrada foi desconectada. Escolha uma entrada e ligue o afinador." });
        });
        emit({ type: "tunerStream", deviceId: actualId, channel, channels, sampleRate: c.sampleRate, bufferFrames: null, source: "browserReported" });
        emit({ type: "tunerState", running: true, deviceId: actualId });
        const lat = (track?.getSettings() as { latency?: number } | undefined)?.latency;
        if (lat) emit({ type: "latency", direction: "input", deviceId: actualId, ms: lat * 1000 });
        // Com a permissão dada, os nomes dos dispositivos aparecem.
        emit({ type: "devices", devices: await listDevices() });
      } catch (err) {
        acquired?.getTracks().forEach((t) => t.stop());
        if (generation !== tunerGeneration) return;
        this.stopTuner(true);
        const denied = err instanceof DOMException && err.name === "NotAllowedError";
        emit({
          type: "error",
          code: denied ? "noDevice" : "streamFailed",
          direction: "input",
          message: denied ? "O navegador não deixou usar o microfone." : String(err),
        });
        emit({ type: "tunerState", running: false, deviceId: null });
      }
    },
    setA4(v: number) {
      a4 = v;
    },
    stopTuner(silent = false) {
      tunerGeneration++;
      window.clearInterval(tunerTimer);
      tunerSource?.disconnect();
      tunerSplit?.disconnect();
      analyser?.disconnect();
      tunerSource = null;
      tunerSplit = null;
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      analyser = null;
      if (!silent) emit({ type: "tunerState", running: false, deviceId: null });
    },
  };
}
