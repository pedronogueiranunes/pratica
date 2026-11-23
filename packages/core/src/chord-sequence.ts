import type { Diagram } from "./fretboard";
import { chordVoicing, validPreviewFrequencies } from "./chord-voicing";
import { BEAT_OPTIONS } from "./chord-trainer";
import { validAudioDrums, type AudioDrums } from "./drums";

export const MAX_SEQUENCE_STEPS = 16;
export interface ChordSequenceStep { id: string; diagram: Diagram; beats: number }
export interface AudioSequenceStep { frequencies: number[]; beats: number }

/** Captura a forma exata, sem depender da posição em listas geradas. */
export function compileChordSequence(steps: readonly ChordSequenceStep[], a4 = 440): AudioSequenceStep[] {
  if (!steps.length || steps.length > MAX_SEQUENCE_STEPS) throw new Error("Adicione entre 1 e 16 acordes.");
  const ids = new Set<string>();
  return steps.map((step) => {
    if (!step || typeof step.id !== "string" || !step.id || ids.has(step.id) || !BEAT_OPTIONS.includes(step.beats as 4)) throw new Error("Bloco de acorde inválido.");
    ids.add(step.id);
    const v = chordVoicing(step.diagram, a4);
    if (!v) throw new Error("A forma do acorde não é válida.");
    return { frequencies: v.frequencies, beats: step.beats };
  });
}
export interface SequenceMixer { volume: number; click: boolean; drums: AudioDrums }
export function validSequenceMixer(m: SequenceMixer): boolean { return !!m && typeof m.click === "boolean" && Number.isFinite(m.volume) && m.volume >= 0 && m.volume <= 1 && validAudioDrums(m.drums); }
export function validAudioSequence(steps: readonly AudioSequenceStep[], volume: number, allowEmpty = false): boolean {
  return Number.isFinite(volume) && volume >= 0 && volume <= 1 && (allowEmpty || steps.length > 0) && steps.length <= MAX_SEQUENCE_STEPS
    && steps.every((step) => BEAT_OPTIONS.includes(step.beats as 4) && validPreviewFrequencies(step.frequencies));
}
/** Estado visual e testes de fronteira; o motor avança pelo relógio de áudio. */
export function sequenceAtBeat(steps: readonly { beats: number }[], beat: number): { step: number; beatsLeft: number } | null {
  if (!steps.length || !Number.isSafeInteger(beat) || beat < 0 || steps.some((s) => !BEAT_OPTIONS.includes(s.beats as 4))) return null;
  let position = beat % steps.reduce((sum, s) => sum + s.beats, 0);
  for (let i = 0; i < steps.length; i++) {
    if (position < steps[i]!.beats) return { step: i, beatsLeft: steps[i]!.beats - position };
    position -= steps[i]!.beats;
  }
  return null;
}
