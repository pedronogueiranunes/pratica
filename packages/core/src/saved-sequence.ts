import { validDate } from "./events";
import { compileDrums, type DrumSettings } from "./drums";
import { compileChordSequence, type ChordSequenceStep } from "./chord-sequence";
export interface SequenceDraft {
  id: string; name: string; steps: ChordSequenceStep[]; bpm: number;
  volume: number; click: boolean; clickVolume: number; drums: DrumSettings; deleted?: boolean;
}
export interface SavedSequence extends SequenceDraft { updatedAt: string }
export interface SequenceStore {
  saveSequence(draft: SequenceDraft): Promise<SavedSequence>;
  listSequences(): Promise<SavedSequence[]>;
}
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const level = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;
export function validateSavedSequence(value: unknown): asserts value is SavedSequence {
  if (!obj(value) || typeof value.id !== "string" || !value.id.trim() || value.id.length > 128 || typeof value.name !== "string" || !value.name.trim() || value.name.length > 80 || !validDate(value.updatedAt)) throw new Error("Sequência salva inválida.");
  if (typeof value.bpm !== "number" || !Number.isFinite(value.bpm) || value.bpm < 20 || value.bpm > 400 || !level(value.volume) || !level(value.clickVolume) || typeof value.click !== "boolean" || !obj(value.drums) || !Array.isArray(value.steps) || value.steps.length > 16 || (value.deleted !== undefined && typeof value.deleted !== "boolean")) throw new Error("Dados da sequência inválidos.");
  compileDrums(value.drums as unknown as DrumSettings);
  for (const step of value.steps) {
    if (!obj(step) || !obj(step.diagram) || typeof step.diagram.name !== "string" || step.diagram.name.length > 64 || !Array.isArray(step.diagram.notes) || !step.diagram.notes.length || step.diagram.notes.length > 6) throw new Error("Forma da sequência inválida.");
    for (const n of step.diagram.notes) {
      if (!obj(n) || !Number.isInteger(n.string) || Number(n.string) < 1 || Number(n.string) > 6 || !Number.isInteger(n.fret) || Number(n.fret) < 0 || Number(n.fret) > 24 || (n.finger !== undefined && (!Number.isInteger(n.finger) || Number(n.finger) < 0 || Number(n.finger) > 4)) || (n.root !== undefined && typeof n.root !== "boolean")) throw new Error("Nota da forma inválida.");
    }
    const muted = step.diagram.muted;
    if (muted !== undefined && (!Array.isArray(muted) || muted.length > 6 || muted.some((s) => !Number.isInteger(s) || s < 1 || s > 6))) throw new Error("Cordas abafadas inválidas.");
    const b = step.diagram.barre;
    if (b !== undefined && (!obj(b) || ![b.fret,b.from,b.to,b.finger].every(Number.isInteger) || Number(b.fret) < 1 || Number(b.fret) > 24 || Number(b.from) < 1 || Number(b.from) > 6 || Number(b.to) < 1 || Number(b.to) > Number(b.from) || Number(b.finger) < 1 || Number(b.finger) > 4)) throw new Error("Pestana inválida.");
  }
  if (value.steps.length) compileChordSequence(value.steps as ChordSequenceStep[]);
}
