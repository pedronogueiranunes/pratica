// Ponte entre a interface e o motor de áudio em Rust.
// Fora do Tauri (webapp) usa o motor em Web Audio de web-engine.ts.

import { compileDrums, defaultDrums, type AudioDrums, type SequenceMixer, rankDevices, type AudioSequenceStep, type DeviceInfo, type EngineEvent, type MetronomeSettings, type Recommendation } from "@gx/core";
import { createWebEngine } from "./web-engine";

export const isNative = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

type Listener = (e: EngineEvent) => void;
const listeners = new Set<Listener>();
let nativeHook: Promise<void> | null = null;
let sequenceRequest = 0;
let spectrumRequest = 0;

async function hookNative() {
  if (!isNative) return;
  nativeHook ??= (async () => {
    const { listen } = await import("@tauri-apps/api/event");
    await listen<EngineEvent>("engine", (ev) => {
      for (const l of listeners) l(ev.payload);
    });
  })().catch((error) => { nativeHook = null; throw error; });
  await nativeHook;
}

function emit(e: EngineEvent) {
  for (const l of listeners) l(e);
}

export function onEngine(fn: Listener): () => void {
  listeners.add(fn);
  void hookNative().catch(() => {});
  return () => listeners.delete(fn);
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

// ---------- Motor web (fora do Tauri) ----------
let webEngine: ReturnType<typeof createWebEngine> | null = null;
const web = () => (webEngine ??= createWebEngine(emit));

// ---------- API pública ----------
export const engine = {
  async startSequence(deviceId: string | null, settings: MetronomeSettings, steps: AudioSequenceStep[], volume: number, click: boolean, runId: number, drums: AudioDrums = compileDrums(defaultDrums)) {
    const request = ++sequenceRequest;
    if (isNative) { await hookNative(); if (request !== sequenceRequest) return; return invoke("sequence_start", { deviceId, settings, steps, volume, click, runId, drums }); }
    return web().startSequence(deviceId, settings, steps, volume, click, runId, drums);
  },
  async updateSequenceMixer(runId: number, mixer: SequenceMixer) {
    if (isNative) return invoke("sequence_mixer", { runId, mixer });
    return web().updateSequenceMixer(runId, mixer);
  },
  async stopSequence() {
    sequenceRequest++;
    if (isNative) return invoke("metronome_stop");
    web().stopSequence();
  },
  async previewChord(deviceId: string | null, frequencies: number[], volume = 0.5) {
    if (isNative) { await hookNative(); return invoke("chord_preview", { deviceId, frequencies, volume }); }
    return web().previewChord(deviceId, frequencies, volume);
  },
  async stopPreview() {
    if (isNative) return invoke("chord_preview_stop");
    web().stopPreview();
  },
  async devices(): Promise<DeviceInfo[]> {
    if (!isNative) return web().devices();
    return invoke<DeviceInfo[]>("audio_devices");
  },
  async rank(devices: DeviceInfo[], purpose: "instrument" | "playback"): Promise<Recommendation[]> {
    if (!isNative) return rankDevices(devices, purpose);
    return invoke<Recommendation[]>("audio_rank", { devices, purpose });
  },
  /** Só no Mac: abre cada dispositivo por um instante para medir o atraso real. */
  async measureLatency() {
    if (!isNative) throw new Error("A medição de todos os dispositivos só existe no app do Mac.");
    await hookNative();
    await invoke("audio_measure");
  },
  async refresh() {
    if (isNative) await invoke("audio_refresh");
    else emit({ type: "devices", devices: await web().devices() });
  },
  async startMetronome(deviceId: string | null, settings: MetronomeSettings) {
    if (isNative) return invoke("metronome_start", { deviceId, settings });
    return web().startMetronome(deviceId, settings);
  },
  async updateMetronome(settings: MetronomeSettings) {
    if (isNative) return invoke("metronome_update", { settings });
    web().updateMetronome(settings);
  },
  async stopMetronome() {
    sequenceRequest++;
    if (isNative) return invoke("metronome_stop");
    web().stopMetronome();
  },
  async startTuner(deviceId: string | null, channel: number, a4: number, bufferFrames: number | null = null) {
    if (isNative) { await hookNative(); return invoke("tuner_start", { deviceId, channel, a4, bufferFrames }); }
    return web().startTuner(deviceId, channel, a4);
  },
  async setA4(a4: number) {
    if (isNative) return invoke("tuner_set_a4", { a4 });
    web().setA4(a4);
  },
  async setSpectrum(enabled: boolean) {
    const request = ++spectrumRequest;
    if (isNative) { await hookNative(); if (request !== spectrumRequest) return; return invoke("tuner_set_spectrum", { enabled }); }
    web().setSpectrum(enabled);
  },
  async stopTuner() {
    if (isNative) return invoke("tuner_stop");
    web().stopTuner();
  },
};

export const spotify = {
  login: (clientId: string) =>
    invoke<{ scope: string; expiresIn: number; redirectUri: string }>("spotify_login", { clientId }),
  request: (method: string, path: string, body?: unknown) =>
    invoke<{ status: number; body: unknown }>("spotify_request", { method, path, body: body ?? null }),
  logout: () => invoke("spotify_logout"),
};
