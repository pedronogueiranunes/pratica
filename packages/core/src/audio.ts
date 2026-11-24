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
