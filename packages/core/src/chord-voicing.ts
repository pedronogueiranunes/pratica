import { chordTones, diagramMatches } from "./chord-shapes";
import { noteIndex, parseChord } from "./chords";
import { fretMidi, type Diagram, type StringNo } from "./fretboard";

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"] as const;
const NATURAL = [0, 2, 4, 5, 7, 9, 11];
export interface VoicedNote {
  string: StringNo;
  midi: number;
  frequency: number;
  letter: string;
  alteration: number;
  octave: number;
  label: string;
  /** Passos diatônicos acima da linha inferior (Mi4), já com oitava escrita +12. */
  staffStep: number;
}
export interface ChordVoicing { notes: VoicedNote[]; frequencies: number[] }

/** Grafia pelo grau, em vez de escolher todos os sustenidos ou todos os bemóis. */
function spelling(name: string, pc: number): { letter: string; alteration: number } | null {
  const chord = parseChord(name), tones = chordTones(name);
  if (!chord || !tones) return null;
  if (chord.bass && pc === noteIndex(chord.bass)) {
    return { letter: chord.bass[0]!, alteration: chord.bass.endsWith("#") ? 1 : chord.bass.endsWith("b") ? -1 : 0 };
  }
  const interval = (pc - tones.root + 12) % 12;
  const s = chord.suffix;
  let degree = [0, 1, 1, 2, 2, 3, 4, 4, 4, 5, 6, 6][interval]!;
  if (interval === 3 && /#9/.test(s) && !/^(m(?!aj)|min|-)/.test(s)) degree = 1;
  if (interval === 6 && /#11/.test(s)) degree = 3;
  if (interval === 8 && /b13/.test(s)) degree = 5;
  if (interval === 9 && /^(dim|°|º)7/.test(s)) degree = 6;
  const index = (LETTERS.indexOf(chord.root[0] as typeof LETTERS[number]) + degree) % 7;
  const alteration = ((pc - NATURAL[index]! + 18) % 12) - 6;
  return Math.abs(alteration) <= 2 ? { letter: LETTERS[index]!, alteration } : null;
}

/** Uma forma validada é a fonte única da altura reproduzida e da nota escrita. */
export function chordVoicing(diagram: Diagram, a4 = 440): ChordVoicing | null {
  const tones = chordTones(diagram.name);
  if (!tones || !Number.isFinite(a4) || a4 < 400 || a4 > 480 || !diagramMatches(diagram, tones)) return null;
  const notes: VoicedNote[] = [];
  const seen = new Set<number>();
  for (const n of diagram.notes) {
    if (seen.has(n.string) || diagram.muted?.includes(n.string)) return null;
    seen.add(n.string);
    const midi = fretMidi(n.string, n.fret);
    if (midi === null) return null;
    const spell = spelling(diagram.name, midi % 12);
    if (!spell) return null;
    const letterIndex = LETTERS.indexOf(spell.letter as typeof LETTERS[number]);
    const octave = (midi - NATURAL[letterIndex]! - spell.alteration) / 12 - 1;
    if (!Number.isInteger(octave)) return null;
    const accidental = spell.alteration > 0 ? "#".repeat(spell.alteration) : "b".repeat(-spell.alteration);
    notes.push({ string: n.string, midi, frequency: a4 * 2 ** ((midi - 69) / 12), ...spell,
      octave, label: `${spell.letter}${accidental}${octave}`, staffStep: (octave + 1) * 7 + letterIndex - (4 * 7 + 2) });
  }
  notes.sort((a, b) => a.midi - b.midi || b.string - a.string);
  if (notes.length && notes[0]!.midi % 12 !== tones.bass) return null;
  return notes.length ? { notes, frequencies: notes.map((n) => n.frequency) } : null;
}

export const PREVIEW_SECONDS = 1.4;
export const PREVIEW_ATTACK = 0.008;
export const PREVIEW_RELEASE = 0.12;
export const PREVIEW_PEAK = 0.18;
export function validPreviewFrequencies(frequencies: readonly number[]): boolean {
  return frequencies.length > 0 && frequencies.length <= 6 && frequencies.every((f) => Number.isFinite(f) && f >= 30 && f <= 3000);
}
/** Som de referência original: parciais senoidais, sem amostras de terceiros. */
export function synthesizeChordPreview(frequencies: readonly number[], sampleRate: number, volume = 0.5): Float32Array {
  if (!validPreviewFrequencies(frequencies) || !Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000 || !Number.isFinite(volume)) throw new Error("Prévia de acorde inválida.");
  const data = new Float32Array(Math.ceil(sampleRate * PREVIEW_SECONDS));
  const gain = PREVIEW_PEAK * Math.max(0, Math.min(1, volume)) / frequencies.length;
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    const envelope = Math.min(1, t / PREVIEW_ATTACK) * Math.min(1, (PREVIEW_SECONDS - t) / PREVIEW_RELEASE) * Math.exp(-t * 2);
    let sum = 0;
    for (const f of frequencies) {
      const phase = 2 * Math.PI * f * t;
      sum += (Math.sin(phase) + (f * 2 < sampleRate / 2 ? 0.35 * Math.sin(phase * 2) : 0) + (f * 3 < sampleRate / 2 ? 0.15 * Math.sin(phase * 3) : 0)) / 1.5;
    }
    data[i] = sum * gain * envelope;
  }
  return data;
}
