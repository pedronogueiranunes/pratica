import { defaultSettings, type PracticeRecord, type Settings } from "./types";
import { validInputProfiles } from "./tuner";
import type { PracticeEvent, SavedRoutine, SettingChange, SettingsPatch } from "./store";

const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string" && v.length > 0;
export function validDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(v) || !Number.isFinite(Date.parse(v))) return false;
  const [year, month, day] = v.slice(0, 10).split("-").map(Number);
  const days = new Date(Date.UTC(year!, month!, 0)).getUTCDate();
  return month! >= 1 && month! <= 12 && day! >= 1 && day! <= days;
}
export function validateLog(v: unknown): asserts v is PracticeRecord {
  if (!obj(v) || !text(v.id) || !text(v.exerciseId) || !validDate(v.at)) throw new Error("Registro inválido.");
  for (const key of ["bpm", "count", "seconds", "durationSeconds", "durationMin"]) {
    const n = v[key];
    if (n !== undefined && (typeof n !== "number" || !Number.isFinite(n) || n < 0 || (key === "bpm" && (n < 20 || n > 400)))) throw new Error("Métrica inválida.");
  }
  if (v.count !== undefined && !Number.isInteger(v.count)) throw new Error("Contagem inválida.");
  if (v.note !== undefined && typeof v.note !== "string") throw new Error("Nota inválida.");
  if (v.metric !== undefined && (!obj(v.metric) || !["bpm", "contagem", "tempo", "feito"].includes(String(v.metric.tipo)))) throw new Error("Métrica inválida.");
}
export function validateRoutine(v: unknown): asserts v is SavedRoutine {
  if (!obj(v) || !text(v.id) || !text(v.name) || !Array.isArray(v.blocks) || v.blocks.length === 0) throw new Error("Rotina inválida.");
  for (const b of v.blocks) {
    if (!obj(b) || !["aquecimento", "dexteridade", "teoria", "musica", "ouvido"].includes(String(b.kind)) || typeof b.minutes !== "number" || !Number.isFinite(b.minutes) || b.minutes <= 0 || !(b.exerciseId === null || text(b.exerciseId))) throw new Error("Bloco inválido.");
  }
}
/** Dispositivos de áudio e canal são locais: IDs não são portáveis entre Macs/navegadores. */
export function flattenSettings(patch: SettingsPatch, deviceId: string): SettingChange[] {
  const changes: SettingChange[] = [];
  for (const [key, value] of Object.entries(patch)) {
    if (obj(value)) {
      for (const [sub, item] of Object.entries(value)) {
        const path = `${key}.${sub}`;
        const local = ["metronome.outputDeviceId", "tuner.inputDeviceId", "tuner.inputChannel", "tuner.inputProfiles"].includes(path);
        changes.push({ key: local ? `device:${deviceId}:${path}` : path, value: item ?? null });
      }
    } else changes.push({ key, value });
  }
  return changes;
}
export function validateSetting(v: unknown): asserts v is SettingChange {
  if (!obj(v) || !text(v.key)) throw new Error("Ajuste inválido.");
  const key = v.key.replace(/^device:[^:]+:/, "");
  const x = v.value;
  const num = (a: number, b: number) => typeof x === "number" && Number.isFinite(x) && x >= a && x <= b;
  const choices: Record<string, unknown[]> = {
    routineSource: ["suggested", "custom"],
    theme: ["sistema", "claro", "escuro"], locale: ["pt-BR", "en"], dedication: ["baixa", "media", "alta"],
    "metronome.sound": ["madeira", "bip", "aro", "cowbell", "suave"], "metronome.progression": ["auto", "manual"],
    "metronome.subdivision": [1, 2, 3, 4],
  };
  const valid = choices[key] ? choices[key]!.includes(x)
    : key === "currentPhase" ? num(1, 4) && Number.isInteger(x)
    : key === "metronome.volume" ? num(0, 1)
    : key === "metronome.beatsPerBar" ? num(1, 7) && Number.isInteger(x)
    : key === "metronome.accentFirstBeat" ? typeof x === "boolean"
    : key === "tuner.a4" ? num(430, 450)
    : key === "tuner.inputChannel" ? num(0, 255) && Number.isInteger(x)
    : key === "tuner.inputProfiles" ? v.key.startsWith("device:") && validInputProfiles(x)
    : ["metronome.outputDeviceId", "tuner.inputDeviceId"].includes(key) ? x === null || typeof x === "string" : false;
  if (!valid) throw new Error("Ajuste inválido.");
}
export function validateEvent(v: unknown): asserts v is PracticeEvent {
  if (!obj(v) || v.version !== 1 || !text(v.id) || !text(v.deviceId) || !validDate(v.at)) throw new Error("Evento inválido ou versão incompatível.");
  if (v.type === "practice.added") validateLog(v.data);
  else if (v.type === "routine.saved") validateRoutine(v.data);
  else if (v.type === "settings.changed") {
    if (!Array.isArray(v.data) || !v.data.length) throw new Error("Ajustes inválidos.");
    v.data.forEach(validateSetting);
  } else throw new Error("Tipo de evento desconhecido.");
}
export function settingsFromRows(rows: SettingChange[], deviceId: string): Settings {
  const result = structuredClone(defaultSettings);
  for (const row of rows) {
    if (row.key.startsWith("device:") && !row.key.startsWith(`device:${deviceId}:`)) continue;
    const key = row.key.replace(/^device:[^:]+:/, "");
    const [parent, child] = key.split(".");
    if (child) (result[parent as "metronome" | "tuner"] as unknown as Record<string, unknown>)[child] = row.value ?? undefined;
    else (result as unknown as Record<string, unknown>)[key] = row.value;
  }
  return result;
}
