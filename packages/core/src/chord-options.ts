import { chordTones, generateShapes, shapesFor } from "./chord-shapes";
import { chordNoteName, chordVoicing } from "./chord-voicing";
import { noteIndex, parseChord } from "./chords";
import type { Diagram } from "./fretboard";

export interface ChordOption { name: string; label: string }

/** Variações harmônicas são acordes diferentes, não inversões da mesma tríade. */
export function chordVariations(name: string): ChordOption[] {
  const chord = parseChord(name);
  if (!chord || !chordTones(name)) return [];
  const base = chord.root + chord.suffix;
  const choices = ["", "m", "7", "7M", "m7", "6", "m6", "sus2", "sus4", "add9", "9", "dim", "dim7", "aug", "5"].map((s) => chord.root + s);
  return [...new Set([base, ...choices])].map((n) => ({ name: n, label: n }));
}

/** Baixos pertencentes ao acorde; preserva também o baixo explícito informado. */
export function chordInversions(name: string): ChordOption[] {
  const chord = parseChord(name);
  if (!chord || !chordTones(name)) return [];
  const base = chord.root + chord.suffix;
  const tones = chordTones(base)!;
  const result: ChordOption[] = [{ name: base, label: `Fundamental (${chord.root})` }];
  for (const interval of tones.intervals.filter((i) => i !== 0)) {
    const pc = (tones.root + interval) % 12;
    const bass = chordNoteName(base, pc);
    // O parser de cifras atual aceita acidentes simples. Não trocar uma grafia
    // teórica dupla por uma nota de outro grau só para preencher o seletor.
    if (bass && noteIndex(bass) === pc) result.push({ name: `${base}/${bass}`, label: `Baixo em ${bass}` });
  }
  if (chord.bass && !result.some((o) => o.name === name)) result.push({ name, label: `Baixo em ${chord.bass}` });
  return result;
}

/** Formas consagradas primeiro, depois alternativas calculadas sem duplicatas. */
export function alternativeChordShapes(name: string): Diagram[] {
  if (!chordTones(name)) return [];
  const seen = new Set<string>();
  return [...shapesFor(name).shapes, ...generateShapes(name, 12)].filter((diagram) => {
    const key = [6, 5, 4, 3, 2, 1].map((s) => diagram.notes.find((n) => n.string === s)?.fret ?? "x").join(",");
    if (seen.has(key) || !chordVoicing(diagram)) return false;
    seen.add(key); return true;
  }).slice(0, 6);
}
