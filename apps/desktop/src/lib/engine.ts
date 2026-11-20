// Ponte entre a interface e o motor de áudio em Rust.
// Fora do Tauri (webapp) usa o motor em Web Audio de web-engine.ts.

import { rankDevices, type DeviceInfo, type EngineEvent, type MetronomeSettings, type Recommendation } from "@gx/core";
import { createWebEngine } from "./web-engine";

export const isNative = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

type Listener = (e: EngineEvent) => void;
const listeners = new Set<Listener>();
let nativeHooked = false;

async function hookNative() {
  if (nativeHooked || !isNative) return;
  nativeHooked = true;
  const { listen } = await import("@tauri-apps/api/event");
  await listen<EngineEvent>("engine", (ev) => {
    for (const l of listeners) l(ev.payload);
  });
}

function emit(e: EngineEvent) {
  for (const l of listeners) l(e);
}

export function onEngine(fn: Listener): () => void {
  listeners.add(fn);
  void hookNative();
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
  async devices(): Promise<DeviceInfo[]> {
    if (!isNative) return web().devices();
    return invoke<DeviceInfo[]>("audio_devices");
  },
  async rank(devices: DeviceInfo[], purpose: "instrument" | "playback"): Promise<Recommendation[]> {
    if (!isNative) return rankDevices(devices, purpose);
    return invoke<Recommendation[]>("audio_rank", { devices, purpose });
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
    if (isNative) return invoke("metronome_stop");
    web().stopMetronome();
  },
  async startTuner(deviceId: string | null, channel: number, a4: number) {
    if (isNative) return invoke("tuner_start", { deviceId, channel, a4 });
    return web().startTuner(deviceId, channel, a4);
  },
  async setA4(a4: number) {
    if (isNative) return invoke("tuner_set_a4", { a4 });
    web().setA4(a4);
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
