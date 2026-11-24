// Espelho em TypeScript dos tipos que o motor de áudio (Rust) envia.
// Fonte da verdade: crates/audio-engine/src/{engine,metronome,pitch,latency}.rs

export type ClickSound = "madeira" | "bip" | "aro" | "cowbell" | "suave";

export interface MetronomeSettings {
  bpm: number;
  beatsPerBar: number;
  subdivision: number;
  accentFirstBeat: boolean;
  volume: number;
  sound: ClickSound;
}

export interface Tick {
  index: number;
  bar: number;
  beat: number;
  sub: number;
  accent: boolean;
  frame: number;
  offsetInBlock: number;
}

export interface NoteReading {
  name: string;
  octave: number;
  midi: number;
  cents: number;
  frequency: number;
  targetFrequency: number;
}

export type Connection =
  | "builtIn" | "usb" | "bluetooth" | "thunderbolt" | "pci" | "fireWire" | "hdmi"
  | "displayPort" | "line" | "spdif" | "network" | "virtual" | "aggregate" | "unknown";

export interface DeviceInfo {
  id: string;
  name: string;
  manufacturer: string | null;
  connection: Connection;
  isInput: boolean;
  isOutput: boolean;
  isDefaultInput: boolean;
  isDefaultOutput: boolean;
  inputChannels: number;
  outputChannels: number;
  sampleRate: number | null;
  bufferMin: number | null;
  bufferMax: number | null;
  measuredInputMs: number | null;
  measuredOutputMs: number | null;
}

export type RecommendationReason = "audioInterface" | "lowestLatency" | "onlyOption" | "bluetoothWarning";

export interface Recommendation {
  deviceId: string;
  score: number;
  estimatedMs: number;
  reason: RecommendationReason;
}

export type EngineErrorCode = "noDevice" | "deviceLost" | "streamFailed" | "unsupportedFormat";

export type EngineEvent =
  | { type: "sequenceState"; runId: number; running: boolean }
  | { type: "sequenceBeat"; runId: number; step: number; beatsLeft: number; audibleInMs: number }
  | { type: "tick"; tick: Tick; audibleInMs: number }
  | { type: "spectrum"; powers: number[]; sampleRate: number; fftSize: number; level: number; a4: number }
  | { type: "pitch"; reading: NoteReading | null; clarity: number; level: number }
  | { type: "latency"; direction: "input" | "output"; deviceId: string; ms: number }
  | { type: "devices"; devices: DeviceInfo[] }
  | { type: "metronomeState"; running: boolean; deviceId: string | null }
  | { type: "tunerState"; running: boolean; deviceId: string | null }
  | { type: "tunerStream"; deviceId: string; channel: number; channels: number; sampleRate: number; bufferFrames: number | null; source: "nativeTimestamp" | "browserReported" }
  | { type: "error"; code: EngineErrorCode; message: string; direction?: "input" | "output" }
  | { type: "measureState"; running: boolean; measured: number; failed: string[]; busy: boolean };

export const MAX_OUTPUT_CHANNEL = 128;
/** Mapa interface → canal de saída. 0 = todos os canais (padrão), n = só o canal n. */
export function validOutputChannels(v: unknown): v is Record<string, number> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const entries = Object.entries(v as Record<string, unknown>);
  return entries.length <= 128 && entries.every(([id, ch]) => id.length > 0 && id.length <= 512 && typeof ch === "number" && Number.isInteger(ch) && ch >= 0 && ch <= MAX_OUTPUT_CHANNEL);
}
/** Opções de canal de saída para uma interface com `count` canais. */
export function outputChannelOptions(count: number): { value: number; label: string }[] {
  const n = Number.isInteger(count) && count > 0 ? Math.min(count, MAX_OUTPUT_CHANNEL) : 0;
  if (n <= 1) return [];
  return [{ value: 0, label: n === 2 ? "1 e 2 (estéreo)" : "Todos" }, ...Array.from({ length: n }, (_, i) => ({ value: i + 1, label: `Só ${i + 1}` }))];
}
/** Opções de canal de entrada (índice 0-based, como o afinador já usa). */
export function inputChannelOptions(count: number): { value: number; label: string }[] {
  const n = Number.isInteger(count) && count > 0 ? Math.min(count, 255) : 0;
  return n <= 1 ? [] : Array.from({ length: n }, (_, i) => ({ value: i, label: `Entrada ${i + 1}` }));
}
