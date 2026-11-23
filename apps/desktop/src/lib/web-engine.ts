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
  validAudioSequence, sequenceAtBeat, compileDrums, defaultDrums, DRUM_INSTRUMENTS, synthesizeDrum, validAudioDrums, validSequenceMixer,
  type AudioDrums, type SequenceMixer,
  type AudioSequenceStep,
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
  let transportGeneration = 0;
  let sequence: { steps: AudioSequenceStep[]; buffers: AudioBuffer[]; beat: number; click: boolean; runId: number; drums: AudioDrums; drumPattern: number[] } | null = null;
  let sequenceBus: GainNode | null = null;
  let drumBus: GainNode | null = null;
  const drumBanks = new Map<number, AudioBuffer>();
  let drumQueue: { when: number; step: number }[] = [];
  let drumEnabled = false;
  const drumVoices = new Map<number, { source: AudioBufferSourceNode; gain: GainNode; end: number }>();
  const scheduled = new Set<AudioBufferSourceNode>();
  const chordVoices = new Set<{ source: AudioBufferSourceNode; gain: GainNode; end: number }>();

  function stopTransport(silent = false) {
    const runId = sequence?.runId ?? 0;
    transportGeneration++;
    window.clearInterval(timer);
    drumBus?.gain.setTargetAtTime(0, ctx?.currentTime ?? 0, 0.003);
    drumQueue = []; drumEnabled = false;
    drumVoices.clear();
    sequenceBus?.gain.setTargetAtTime(0, ctx?.currentTime ?? 0, 0.003);
    master?.gain.setTargetAtTime(0, ctx?.currentTime ?? 0, 0.003);
    for (const source of scheduled) { try { source.stop((ctx?.currentTime ?? 0) + 0.02); } catch {} }
    scheduled.clear();
    chordVoices.clear();
    drumBus = null; sequenceBus = null; sequence = null; settings = null;
    if (!silent) emit({ type: "sequenceState", running: false, runId });
    if (!silent) emit({ type: "metronomeState", running: false, deviceId: null });
  }

  function scheduleSource(buffer: AudioBuffer, destination: AudioNode, when: number, duration?: number) {
    const source = ctx!.createBufferSource(); source.buffer = buffer; source.connect(destination);
    scheduled.add(source);
    source.onended = () => { source.disconnect(); scheduled.delete(source); };
    source.start(Math.max(when, ctx!.currentTime));
    if (duration) source.stop(Math.max(when, ctx!.currentTime) + duration);
    return source;
  }

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

  function buildDrums() {
    if (!ctx || drumBanks.size) return;
    DRUM_INSTRUMENTS.forEach((instrument, i) => {
      const data = synthesizeDrum(instrument, ctx!.sampleRate);
      const buffer = ctx!.createBuffer(1, data.length, ctx!.sampleRate);
      buffer.copyToChannel(data as Float32Array<ArrayBuffer>, 0); drumBanks.set(i, buffer);
    });
  }
  function scheduleDrums() {
    if (!ctx || !sequence || !drumBus) return;
    while (drumQueue.length && drumQueue[0]!.when <= ctx.currentTime + LOOKAHEAD_S) {
      const point = drumQueue.shift()!;
      if (point.step === 0) sequence.drumPattern = [...sequence.drums.pattern];
      if (drumEnabled !== sequence.drums.enabled) {
        drumEnabled = sequence.drums.enabled;
        drumBus.gain.setTargetAtTime(drumEnabled ? sequence.drums.volume : 0, Math.max(ctx.currentTime, point.when), 0.003);
      }
      if (!drumEnabled) continue;
      const mask = sequence.drumPattern[point.step]!;
      const release = (instrument: number) => {
        const old = drumVoices.get(instrument);
        if (old && old.end > point.when) {
          old.gain.gain.cancelScheduledValues(point.when); old.gain.gain.setValueAtTime(1, point.when);
          old.gain.gain.linearRampToValueAtTime(0, point.when + .002); old.source.stop(point.when + .002); old.end = point.when + .002;
        }
      };
      if (mask & 4) release(3);
      for (let i = 0; i < 5; i++) if (mask & (1 << i)) {
        release(i);
        const bus = drumBus, gain = ctx.createGain(); gain.connect(bus);
        const voice = scheduleSource(drumBanks.get(i)!, gain, point.when);
        const entry = { source: voice, gain, end: point.when + drumBanks.get(i)!.duration }; drumVoices.set(i, entry);
        const ended = voice.onended;
        voice.onended = (event) => { if (drumVoices.get(i) === entry) drumVoices.delete(i); gain.disconnect(); ended?.call(voice, event); if (bus !== drumBus) bus.disconnect(); };
      }
    }
  }

  const per = (s: MetronomeSettings) => 60 / (s.bpm * s.subdivision);

  function schedule() {
    if (!ctx || !settings || !master) return;
    const s = settings;
    if (sequence && anchorTime + (nextIndex - anchorIndex) * per(s) < ctx.currentTime - 0.5) {
      emit({ type: "error", code: "streamFailed", direction: "output", message: "O navegador pausou o áudio. Inicie o loop de novo." });
      stopTransport(); return;
    }
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
      scheduleSource(banks.get(kind)!, master, when);
      if (sequence && sub === 0) {
        const quarter = sequence.beat++;
        for (let j = 0; j < 4; j++) drumQueue.push({ when: when + j * 60 / s.bpm / 4, step: (quarter % 4) * 4 + j });
        const state = sequenceAtBeat(sequence.steps, quarter) ?? { step: 0, beatsLeft: 4 - quarter % 4 };
        const step = sequence.steps[state.step];
        if (step && state.beatsLeft === step.beats) {
          for (const old of chordVoices) {
            if (old.end > when) {
              old.gain.gain.cancelScheduledValues(when);
              old.gain.gain.setValueAtTime(1, when);
              old.gain.gain.linearRampToValueAtTime(0, when + 0.01);
              old.source.stop(when + 0.012); old.end = when + 0.012;
            }
          }
          // Uma voz por bloco. A cauda termina antes do ataque seguinte.
          const duration = Math.min(1.4, step.beats * 60 / s.bpm);
          const bus = sequenceBus!;
          const gain = ctx.createGain(); gain.connect(bus);
          gain.gain.setValueAtTime(1, when);
          gain.gain.setValueAtTime(1, when + Math.max(0, duration - 0.012));
          gain.gain.linearRampToValueAtTime(0, when + duration);
          const voice = scheduleSource(sequence.buffers[state.step]!, gain, when, duration);
          const entry = { source: voice, gain, end: when + duration }; chordVoices.add(entry);
          const ended = voice.onended;
          voice.onended = (event) => { chordVoices.delete(entry); ended?.call(voice, event); gain.disconnect(); if (bus !== sequenceBus) bus.disconnect(); };
        }
        emit({ type: "sequenceBeat", runId: sequence.runId, ...state, audibleInMs: Math.max(0, (when - ctx.currentTime) * 1000 + latency) });
      }
      emit({
        type: "tick",
        tick: { index: i, bar: Math.floor(beatTotal / s.beatsPerBar), beat, sub, accent, frame: 0, offsetInBlock: 0 },
        audibleInMs: Math.max(0, (when - ctx.currentTime) * 1000 + latency),
      });
      lastTickTime = when;
      nextIndex++;
    }
    scheduleDrums();
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
    stopSequence: stopTransport,
    async startSequence(deviceId: string | null, s: MetronomeSettings, steps: AudioSequenceStep[], volume: number, click: boolean, runId: number, drums: AudioDrums = compileDrums(defaultDrums)) {
      if (!validAudioDrums(drums) || !validAudioSequence(steps, volume, drums.enabled)) throw new Error("Sequência inválida.");
      if (!Number.isFinite(s.bpm) || s.bpm < 20 || s.bpm > 400 || !Number.isInteger(s.subdivision) || s.subdivision < 1 || s.subdivision > 4 || !Number.isInteger(s.beatsPerBar) || s.beatsPerBar < 1 || s.beatsPerBar > 16 || !Number.isFinite(s.volume) || s.volume < 0 || s.volume > 1) throw new Error("Configuração do transporte inválida.");
      if (drums.enabled && s.beatsPerBar !== 4) throw new Error("A bateria precisa de compasso 4/4.");
      stopTransport(true); stopPreview();
      const generation = transportGeneration;
      const c = await ensureCtx(rawId(deviceId));
      if (generation !== transportGeneration) return;
      const buffers = steps.map((step) => {
        const data = synthesizeChordPreview(step.frequencies, c.sampleRate, 1);
        const buffer = c.createBuffer(1, data.length, c.sampleRate);
        buffer.copyToChannel(data as Float32Array<ArrayBuffer>, 0); return buffer;
      });
      buildBanks(s.sound); buildDrums(); settings = s;
      sequenceBus = c.createGain(); sequenceBus.gain.setValueAtTime(volume, c.currentTime); sequenceBus.connect(output!);
      drumBus = c.createGain(); drumBus.gain.setValueAtTime(0, c.currentTime); drumBus.connect(output!);
      sequence = { steps, buffers, beat: 0, click, runId, drums, drumPattern: [...drums.pattern] };
      master!.gain.setValueAtTime(click ? s.volume : 0, c.currentTime);
      anchorTime = c.currentTime + 0.05; anchorIndex = 0; nextIndex = 0;
      timer = window.setInterval(schedule, TICK_MS);
      emit({ type: "metronomeState", running: true, deviceId });
      emit({ type: "sequenceState", running: true, runId }); schedule();
    },
    updateSequenceMixer(runId: number, mixer: SequenceMixer) {
      if (!validSequenceMixer(mixer)) throw new Error("Volumes ou bateria inválidos.");
      if (!ctx || !sequence || sequence.runId !== runId) return;
      if (mixer.drums.enabled && settings?.beatsPerBar !== 4) throw new Error("A bateria precisa de compasso 4/4.");
      sequence.click = mixer.click; sequence.drums = mixer.drums;
      sequenceBus?.gain.setTargetAtTime(mixer.volume, ctx.currentTime, 0.01);
      master?.gain.setTargetAtTime(mixer.click ? settings!.volume : 0, ctx.currentTime, 0.01);
      if (!mixer.drums.enabled) { drumEnabled = false; drumBus?.gain.setTargetAtTime(0, ctx.currentTime, 0.003); }
      else if (drumEnabled) drumBus?.gain.setTargetAtTime(mixer.drums.volume, ctx.currentTime, 0.01);
    },
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
      stopTransport();
      const generation = transportGeneration;
      const c = await ensureCtx(rawId(deviceId));
      if (generation !== transportGeneration) return;
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
      if (sequence?.drums.enabled && s.beatsPerBar !== 4) { emit({ type: "error", code: "streamFailed", direction: "output", message: "A bateria precisa de compasso 4/4." }); stopTransport(); return; }
      const tempoChanged = s.bpm !== settings.bpm || s.subdivision !== settings.subdivision;
      if (tempoChanged) {
        // Reancora no último clique: o próximo vem no tempo novo.
        if (sequence && s.bpm !== settings.bpm) {
          const anchor = lastTickTime;
          drumQueue = drumQueue.map((point) => ({ ...point, when: anchor + (point.when - anchor) * settings!.bpm / s.bpm }));
        }
        anchorIndex = nextIndex;
        anchorTime = Math.max(lastTickTime + per(s), ctx.currentTime + 0.01);
      }
      buildBanks(s.sound);
      master?.gain.setTargetAtTime(sequence && !sequence.click ? 0 : s.volume, ctx.currentTime, 0.01);
      settings = s;
    },
    stopMetronome() {
      stopTransport();
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
