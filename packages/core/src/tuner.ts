import type { NoteReading } from "./audio";

/** Configuração e último diagnóstico desta entrada, restritos ao aparelho. */
export interface InputProfile {
  deviceId: string;
  channel: number;
  bufferFrames: number | null;
  sampleRate: number;
  inputMs: number | null;
  source: "nativeTimestamp" | "browserReported";
  measuredAt: string;
}

function profileDate(value: unknown): boolean {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(value) || !Number.isFinite(Date.parse(value))) return false;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return month! >= 1 && month! <= 12 && day! >= 1 && day! <= new Date(Date.UTC(year!, month!, 0)).getUTCDate();
}

export function validInputProfiles(value: unknown): value is InputProfile[] {
  if (!Array.isArray(value) || value.length > 128) return false;
  const ids = new Set<string>();
  return value.every((p) => {
    if (!p || typeof p !== "object" || typeof p.deviceId !== "string" || !p.deviceId || ids.has(p.deviceId)) return false;
    ids.add(p.deviceId);
    return Number.isInteger(p.channel) && p.channel >= 0 && p.channel <= 255
      && (p.bufferFrames === null || Number.isInteger(p.bufferFrames) && p.bufferFrames >= 32 && p.bufferFrames <= 8192)
      && Number.isInteger(p.sampleRate) && p.sampleRate >= 8000 && p.sampleRate <= 768000
      && (p.inputMs === null || typeof p.inputMs === "number" && Number.isFinite(p.inputMs) && p.inputMs >= 0 && p.inputMs <= 10000)
      && ["nativeTimestamp", "browserReported"].includes(p.source)
      && profileDate(p.measuredAt);
  });
}

export type TuningStatus = "stopped" | "listening" | "weak" | "unstable" | "flat" | "sharp" | "inTune";
export function tuningStatus(running: boolean, reading: NoteReading | null, clarity: number, level: number): TuningStatus {
  if (!running) return "stopped";
  if (level < 0.004) return level > 0.0002 ? "weak" : "listening";
  if (!reading || clarity < 0.85) return "unstable";
  return Math.abs(reading.cents) <= 3 ? "inTune" : reading.cents < 0 ? "flat" : "sharp";
}

/** Impede que uma leitura fora da escala desenhe a agulha fora do visor. */
export const displayedCents = (cents: number) => Number.isFinite(cents) ? Math.max(-50, Math.min(50, cents)) : 0;
