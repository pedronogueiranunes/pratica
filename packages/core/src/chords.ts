// Acordes como texto: leitura, validação e transposição.
// Aceita a notação brasileira (C7M, Em7(9), F#m7(b5), D°) e a inglesa (Cmaj7, Bdim).

const NOTES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTES_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const SUFFIX = /^(?:maj|min|dim|aug|sus|add|m|M|°|º|ø|\+|-|#|b|\d|\(|\)|,|\/(?=\d))*$/;

export interface ParsedChord {
  root: string;
  suffix: string;
  bass?: string;
}

export function noteIndex(note: string): number | null {
  const i = NOTES_SHARP.indexOf(note);
  if (i >= 0) return i;
  const j = NOTES_FLAT.indexOf(note);
  if (j >= 0) return j;
  const special: Record<string, number> = { "E#": 5, "B#": 0, Fb: 4, Cb: 11 };
  return special[note] ?? null;
}

export function parseChord(token: string): ParsedChord | null {
  const m = /^([A-G][#b]?)(.*?)(?:\/([A-G][#b]?))?$/.exec(token);
  if (!m) return null;
  const [, root, suffix = "", bass] = m;
  if (!SUFFIX.test(suffix)) return null;
  if (suffix.split("(").length !== suffix.split(")").length) return null;
  return bass ? { root: root!, suffix, bass } : { root: root!, suffix };
}

export const isChord = (token: string) => parseChord(token) !== null;

export function transposeNote(note: string, semitones: number, flats = false): string {
  const i = noteIndex(note);
  if (i === null) return note;
  const n = (((i + semitones) % 12) + 12) % 12;
  return (flats ? NOTES_FLAT : NOTES_SHARP)[n]!;
}

/** Transpõe mantendo o sufixo exatamente como foi escrito. */
export function transposeChord(token: string, semitones: number, flats?: boolean): string {
  const c = parseChord(token);
  if (!c) return token;
  const useFlats = flats ?? c.root.endsWith("b");
  const root = transposeNote(c.root, semitones, useFlats);
  return c.bass ? `${root}${c.suffix}/${transposeNote(c.bass, semitones, useFlats)}` : `${root}${c.suffix}`;
}
