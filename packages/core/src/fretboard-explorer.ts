import { fretMidi, type Diagram, type StringNo } from "./fretboard";
import { chordTones } from "./chord-shapes";
import { chordNoteName } from "./chord-voicing";
import { noteIndex, transposeNote } from "./chords";
import type { NoteReading } from "./audio";
import { tuningStatus } from "./tuner";

export interface FretPosition { string: StringNo; fret: number }
export interface FretPitch extends FretPosition { midi: number; pc: number; label: string }
export const FRETBOARD_STRINGS: StringNo[] = [1, 2, 3, 4, 5, 6];
export const SCALE_PATTERNS = [
  { id: "major", name: "Maior", intervals: [0, 2, 4, 5, 7, 9, 11] },
  { id: "minor", name: "Menor natural", intervals: [0, 2, 3, 5, 7, 8, 10] },
  { id: "minor-pentatonic", name: "Pentatônica menor", intervals: [0, 3, 5, 7, 10] },
  { id: "major-pentatonic", name: "Pentatônica maior", intervals: [0, 2, 4, 7, 9] },
  { id: "dorian", name: "Dórica", intervals: [0, 2, 3, 5, 7, 9, 10] },
] as const;
export type ScalePatternId = typeof SCALE_PATTERNS[number]["id"];
/** Altura real e grafia opcional pelo acorde, incluindo B# e acidentes duplos. */
export function fretPitch(position: FretPosition, flats = false, chord?: string): FretPitch {
  const midi = fretMidi(position.string, position.fret);
  if (midi === null) throw new Error("Posição do braço inválida.");
  const pc = midi % 12;
  const spelled = chord ? chordNoteName(chord, pc) : null;
  const note = spelled ?? transposeNote("C", pc, flats);
  const alteration = [...note.slice(1)].reduce((n, c) => n + (c === "#" ? 1 : c === "b" ? -1 : 0), 0);
  const octave = (midi - noteIndex(note[0]!)! - alteration) / 12 - 1;
  return { ...position, midi, pc, label: `${note}${octave}` };
}
export function fretboardPitches(flats = false): FretPitch[] {
  return FRETBOARD_STRINGS.flatMap((string) => Array.from({ length: 25 }, (_, fret) => fretPitch({ string, fret }, flats)));
}
/** Altura exata, sem inferir a corda. Rejeita silêncio e leituras sem confiança. */
export function detectedFretPositions(running: boolean, reading: NoteReading | null, clarity: number, level: number): FretPosition[] {
  const status = tuningStatus(running, reading, clarity, level);
  if (!reading || !["flat", "sharp", "inTune"].includes(status)
    || !Number.isFinite(clarity) || !Number.isFinite(level)
    || !Number.isInteger(reading.midi) || !Number.isFinite(reading.cents)
    || !Number.isFinite(reading.frequency) || reading.frequency <= 0) return [];
  return FRETBOARD_STRINGS.flatMap((string) => {
    const fret = reading.midi - fretPitch({ string, fret: 0 }).midi;
    return fret >= 0 && fret <= 24 ? [{ string, fret }] : [];
  });
}
export function scaleTones(root: string, pattern: ScalePatternId): { root: number; pcs: number[] } | null {
  const pc = noteIndex(root), scale = SCALE_PATTERNS.find((s) => s.id === pattern);
  return pc === null || !scale ? null : { root: pc, pcs: scale.intervals.map((i) => (pc + i) % 12) };
}
/** Uma posição por corda: trocar a casa substitui a nota; repetir desmarca. */
export function selectFret(current: readonly FretPosition[], position: FretPosition): FretPosition[] {
  fretPitch(position);
  if (current.length > 6 || new Set(current.map((p) => p.string)).size !== current.length) throw new Error("Seleção de cordas inválida.");
  current.forEach((p) => fretPitch(p));
  const same = current.some((p) => p.string === position.string && p.fret === position.fret);
  return [...current.filter((p) => p.string !== position.string), ...(!same ? [{ ...position }] : [])].sort((a, b) => b.string - a.string);
}
export function fretFrequencies(positions: readonly FretPosition[], a4 = 440): number[] {
  if (positions.length > 6 || new Set(positions.map((p) => p.string)).size !== positions.length || !Number.isFinite(a4) || a4 < 400 || a4 > 480) throw new Error("Seleção ou afinação inválida.");
  return positions.map((p) => a4 * 2 ** ((fretPitch(p).midi - 69) / 12));
}

const ROOTS = Array.from({ length: 12 }, (_, i) => transposeNote("C", i));
const SUFFIXES = ["", "m", "5", "dim", "aug", "sus2", "sus4", "6", "m6", "7", "7M", "m7", "m7(b5)", "dim7", "add9", "9", "m9", "6/9"];
const TEMPLATES = ROOTS.flatMap((root) => SUFFIXES.flatMap((suffix) => {
  const name = root + suffix, tones = chordTones(name);
  return tones ? [{ name, root: tones.root, suffix, pcs: tones.intervals.map((i) => (tones.root + i) % 12) }] : [];
}));
export interface IdentifiedChord { name: string; root: number; bass: number; diagram: Diagram }
/** Correspondência exata de classes de notas. Retorna ambiguidades, sem adivinhar notas ausentes. */
export function identifyFretChord(positions: readonly FretPosition[], flats = false): IdentifiedChord[] {
  if (!positions.length || positions.length > 6 || new Set(positions.map((p) => p.string)).size !== positions.length) return [];
  let notes: FretPitch[];
  try { notes = positions.map((p) => fretPitch(p)).sort((a, b) => a.midi - b.midi); } catch { return []; }
  const pcs = new Set(notes.map((n) => n.pc)), bass = notes[0]!.pc;
  if (pcs.size < 2) return [];
  return TEMPLATES.filter((t) => pcs.size === t.pcs.length && t.pcs.every((pc) => pcs.has(pc)))
    .sort((a, b) => Number(b.root === bass) - Number(a.root === bass) || a.suffix.length - b.suffix.length || a.name.localeCompare(b.name))
    .map((t) => {
      const base = transposeNote("C", t.root, flats) + t.suffix;
      const spelling = chordNoteName(base, bass);
      const bassName = spelling && noteIndex(spelling) === bass ? spelling : transposeNote("C", bass, flats);
      const name = bass === t.root ? base : `${base}/${bassName}`;
      return { name, root: t.root, bass, diagram: { name, notes: positions.map((p) => ({ ...p, root: fretPitch(p).pc === t.root })), muted: FRETBOARD_STRINGS.filter((s) => !positions.some((p) => p.string === s)) } };
    });
}
