// Formas de acorde para desenhar: notas de cada acorde a partir do nome e
// digitações para o braço. São padrões de teoria e de técnica de violão,
// não dados de uma música. Toda forma é conferida contra as notas do acorde.
import { noteIndex, parseChord } from "./chords";
import type { Diagram, Finger, FretNote, StringNo } from "./fretboard";

const OPEN_PC: Record<StringNo, number> = { 6: 4, 5: 9, 4: 2, 3: 7, 2: 11, 1: 4 };
const LOW_TO_HIGH: StringNo[] = [6, 5, 4, 3, 2, 1];

export interface ChordTones {
  root: number;
  bass: number;
  /** Intervalos em semitons a partir da fundamental (0 incluído). */
  intervals: number[];
  /** Intervalos que precisam soar para o acorde ser reconhecido. */
  required: number[];
}

/**
 * Intervalos de um sufixo de acorde, nas notações brasileira e inglesa.
 * Devolve null quando o sufixo não é entendido, em vez de chutar.
 */
export function chordIntervals(suffix: string): { intervals: number[]; required: number[] } | null {
  let s = suffix.replace(/\s/g, "").replace(/add(b|#)?(\d+)/g, "($1$2)");
  let third: number | null = 4, fifth: number | null = 7, seventh: number | null = null;
  const ext = new Set<number>();
  const take = (re: RegExp) => { const m = re.exec(s); if (m) s = s.slice(0, m.index) + s.slice(m.index + m[0].length); return !!m; };

  if (take(/^(ø|m7\(?b5\)?)/)) { third = 3; fifth = 6; seventh = 10; }
  else if (take(/^(dim|°|º)/)) { third = 3; fifth = 6; if (take(/^7/)) seventh = 9; }
  else if (take(/^(aug|\+)/)) { fifth = 8; }
  else if (take(/^(min|m(?!aj)|-)/)) { third = 3; }
  if (s === "5") return { intervals: [0, 7], required: [0, 7] };

  // Sétimas: 7M, maj7, M7, Δ, (7M) = sétima maior; 7 = menor.
  if (take(/\(?(7M|maj7|M7|Δ7?|maj)\)?/)) seventh = 11;
  if (take(/^6(?!\/?9)|^6$/)) ext.add(9);
  if (take(/^6\/?9/)) { ext.add(9); ext.add(2); }
  if (take(/^7/)) seventh = 10;
  // Nona, 11ª e 13ª "soltas" logo após a tríade implicam sétima menor (C9, Am11).
  const tall = /^(9|11|13)(?![0-9])/.exec(s);
  if (tall && seventh === null) { seventh = 10; s = s.slice(tall[0].length); ext.add(({ 9: 2, 11: 5, 13: 9 } as Record<string, number>)[tall[1]!]!); if (tall[1] !== "9") ext.add(2); }
  if (take(/^sus2/)) third = null, ext.add(2);
  if (take(/^sus4?|^4(?![0-9])/)) { third = null; ext.add(5); }

  // Extensões entre parênteses ou soltas: (9), (4/9), (b5), #11, b13...
  const rest = s.replace(/[()]/g, " ").replace(/[/,]/g, " ").trim();
  if (rest) {
    for (const token of rest.split(/\s+/)) {
      const m = /^(b|#|\+|-)?(2|4|5|9|11|13)$/.exec(token);
      if (!m) return null;
      const acc = m[1] === "b" || m[1] === "-" ? -1 : m[1] === "#" || m[1] === "+" ? 1 : 0;
      const n = m[2];
      if (n === "5") { fifth = 7 + acc; continue; }
      // Na cifra brasileira, 4 sem alteração substitui a terça: A7(4/9) = A7sus4 com nona.
      if (n === "4" && acc === 0) { third = null; ext.add(5); continue; }
      const base = ({ 2: 2, 9: 2, 4: 5, 11: 5, 13: 9 } as Record<string, number>)[n!]!;
      ext.add((base + acc + 12) % 12);
    }
  }
  const intervals = new Set<number>([0]);
  if (third !== null) intervals.add(third);
  if (fifth !== null) intervals.add(fifth);
  if (seventh !== null) intervals.add(seventh);
  ext.forEach((e) => intervals.add(e));
  // A quinta justa pode faltar numa digitação; o resto precisa soar.
  const required = [...intervals].filter((i) => !(i === 7 && fifth === 7));
  return { intervals: [...intervals].sort((a, b) => a - b), required: required.sort((a, b) => a - b) };
}

export function chordTones(name: string): ChordTones | null {
  const c = parseChord(name);
  if (!c) return null;
  const root = noteIndex(c.root);
  const iv = chordIntervals(c.suffix);
  if (root === null || !iv) return null;
  const bass = c.bass ? noteIndex(c.bass) : root;
  if (bass === null) return null;
  return { root, bass, ...iv };
}

/** Confere uma forma: só notas do acorde, todas as obrigatórias, baixo certo. */
export function diagramMatches(d: Diagram, tones: ChordTones): boolean {
  const pcs = new Set(tones.intervals.map((i) => (tones.root + i) % 12));
  const sounding = d.notes.map((n) => (OPEN_PC[n.string] + n.fret) % 12);
  if (!sounding.length || !sounding.every((p) => pcs.has(p) || p === tones.bass)) return false;
  const have = new Set(sounding);
  if (!tones.required.every((i) => have.has((tones.root + i) % 12))) return false;
  const lowest = [...d.notes].sort((a, b) => b.string - a.string)[0]!;
  return (OPEN_PC[lowest.string] + lowest.fret) % 12 === tones.bass;
}

function shape(name: string, frets: string, fingers: string, barre?: { fret: number; from: StringNo; to: StringNo }): Diagram {
  const notes: FretNote[] = [];
  const muted: StringNo[] = [];
  const tones = chordTones(name);
  [...frets].forEach((c, i) => {
    const string = LOW_TO_HIGH[i]!;
    if (c === "x") { muted.push(string); return; }
    const fret = parseInt(c, 36);
    const f = fingers[i];
    notes.push({ string, fret, finger: (f && f !== "x" ? Number(f) : 0) as Finger, root: tones ? (OPEN_PC[string] + fret) % 12 === tones.root : false });
  });
  return { name, notes, muted, ...(barre ? { barre: { ...barre, finger: 1 as Finger } } : {}) };
}

/**
 * Formas consagradas, da 6ª corda para a 1ª. A chave é o acorde normalizado
 * (ver normalizeChordName). Testes conferem cada uma contra chordTones.
 */
const COMMON: Record<string, [string, string, { fret: number; from: StringNo; to: StringNo }?][]> = {
  C: [["x32010", "x32010"], ["x35553", "x12341", { fret: 3, from: 5, to: 1 }]],
  D: [["xx0232", "xx0132"], ["x57775", "x12341", { fret: 5, from: 5, to: 1 }]],
  E: [["022100", "023100"]],
  F: [["133211", "134211", { fret: 1, from: 6, to: 1 }], ["xx3211", "xx3211"]],
  G: [["320003", "210003"], ["320033", "210034"], ["355433", "134211", { fret: 3, from: 6, to: 1 }]],
  A: [["x02220", "x01230"], ["577655", "134211", { fret: 5, from: 6, to: 1 }]],
  B: [["x24442", "x13331", { fret: 2, from: 5, to: 1 }]],
  Bb: [["x13331", "x12341", { fret: 1, from: 5, to: 1 }]],
  Cm: [["x35543", "x13421", { fret: 3, from: 5, to: 1 }]],
  Dm: [["xx0231", "xx0231"]],
  Em: [["022000", "023000"]],
  Fm: [["133111", "134111", { fret: 1, from: 6, to: 1 }]],
  Gm: [["355333", "134111", { fret: 3, from: 6, to: 1 }]],
  Am: [["x02210", "x02310"], ["577555", "134111", { fret: 5, from: 6, to: 1 }]],
  Bm: [["x24432", "x13421", { fret: 2, from: 5, to: 1 }]],
  "F#m": [["244222", "134111", { fret: 2, from: 6, to: 1 }]],
  "C#m": [["x46654", "x13421", { fret: 4, from: 5, to: 1 }]],
  C7: [["x32310", "x32410"]],
  D7: [["xx0212", "xx0213"]],
  E7: [["020100", "020100"], ["022130", "023140"]],
  G7: [["320001", "320001"]],
  A7: [["x02020", "x02030"]],
  B7: [["x21202", "x21304"]],
  Am7: [["x02010", "x02010"]],
  Bm7: [["x24232", "x13141", { fret: 2, from: 5, to: 1 }]],
  Dm7: [["xx0211", "xx0211"]],
  Em7: [["022030", "012040"], ["020000", "020000"]],
  "F#m7": [["242222", "131111", { fret: 2, from: 6, to: 1 }]],
  "C7M": [["x32000", "x32000"]],
  "D7M": [["xx0222", "xx0111"]],
  "F7M": [["xx3210", "xx3210"]],
  "G7M": [["3x0002", "2x0001"]],
  "A7M": [["x02120", "x02130"]],
  "E7M": [["021100", "031200"]],
  "Em7(9)": [["022032", "012043"]],
  "Am7(9)": [["x05557", "x01114"]],
  "Cadd9": [["x32033", "x21034"]],
  "Asus2": [["x02200", "x01200"]],
  "Asus4": [["x02230", "x01230"]],
  "Dsus2": [["xx0230", "xx0130"]],
  "Dsus4": [["xx0233", "xx0134"]],
  "Esus4": [["022200", "023400"]],
  E5: [["022xxx", "011xxx"]],
  A5: [["x022xx", "x011xx"]],
  G5: [["355xxx", "134xxx"]],
  C5: [["x355xx", "x134xx"]],
};

/** Grafia canônica para a busca: maj7 e M7 viram 7M, bemol/sustenido equivalentes. */
export function normalizeChordName(name: string): string {
  return name.replace(/maj7|M7(?![0-9])/g, "7M").replace(/\(7M\)/g, "7M").replace(/ /g, "");
}
const ENHARMONIC: Record<string, string> = { "C#": "Db", Db: "C#", "D#": "Eb", Eb: "D#", "F#": "Gb", Gb: "F#", "G#": "Ab", Ab: "G#", "A#": "Bb", Bb: "A#" };

/** Gera digitações tocáveis (até 4 dedos, abertura de 4 casas) quando não há forma consagrada. */
export function generateShapes(name: string, limit = 3): Diagram[] {
  const tones = chordTones(name);
  if (!tones) return [];
  const pcs = new Set(tones.intervals.map((i) => (tones.root + i) % 12));
  pcs.add(tones.bass);
  const found: { d: Diagram; score: number }[] = [];
  for (let base = 0; base <= 10; base++) {
    // Para cada corda: abafada ou uma casa dentro da janela [base, base+3] (ou solta).
    const options = LOW_TO_HIGH.map((string) => {
      const opts: (number | null)[] = [null];
      for (let f = base === 0 ? 0 : base; f <= base + 3; f++) if (pcs.has((OPEN_PC[string] + f) % 12)) opts.push(f);
      if (base > 0 && pcs.has(OPEN_PC[string]) && base <= 3) opts.push(0);
      return opts;
    });
    const walk = (i: number, acc: (number | null)[]) => {
      if (i === 6) { const d = build(name, acc, tones); if (d) found.push(d); return; }
      for (const o of options[i]!) walk(i + 1, [...acc, o]);
    };
    walk(0, []);
  }
  const seen = new Set<string>();
  return found.sort((a, b) => a.score - b.score).filter(({ d }) => {
    const key = LOW_TO_HIGH.map((s) => d.notes.find((n) => n.string === s)?.fret ?? "x").join(",");
    if (seen.has(key)) return false; seen.add(key); return true;
  }).slice(0, limit).map(({ d }) => d);
}

function build(name: string, frets: (number | null)[], tones: ChordTones): { d: Diagram; score: number } | null {
  const first = frets.findIndex((f) => f !== null);
  if (first < 0 || first > 2) return null;
  // Abafadas só do lado grave: nada de corda morta no meio.
  if (frets.slice(first).some((f) => f === null)) return null;
  const sounding = 6 - first;
  if (sounding < 4) return null;
  const fretted = frets.map((f, i) => ({ f, string: LOW_TO_HIGH[i]! })).filter((x): x is { f: number; string: StringNo } => x.f !== null && x.f > 0);
  const min = fretted.length ? Math.min(...fretted.map((x) => x.f)) : 0;
  const max = fretted.length ? Math.max(...fretted.map((x) => x.f)) : 0;
  if (max - min > 3) return null;
  // Pestana: o dedo 1 cobre todas as notas na menor casa se houver mais de uma.
  const atMin = fretted.filter((x) => x.f === min);
  const barre = atMin.length >= 2 && min > 0 && frets.slice(first).every((f) => f === null || f === 0 ? f !== 0 : f >= min);
  const others = fretted.filter((x) => !(barre && x.f === min)).sort((a, b) => a.f - b.f || b.string - a.string);
  const fingersNeeded = (barre ? 1 : 0) + others.length;
  if (fingersNeeded > 4) return null;
  const notes: FretNote[] = [];
  let next = barre ? 2 : 1;
  const fingerOf = new Map<StringNo, Finger>();
  for (const o of others) fingerOf.set(o.string, Math.min(4, Math.max(next++, o.f - min + 1)) as Finger);
  frets.forEach((f, i) => {
    if (f === null) return;
    const string = LOW_TO_HIGH[i]!;
    const finger = (f === 0 ? 0 : barre && f === min ? 1 : fingerOf.get(string) ?? 1) as Finger;
    notes.push({ string, fret: f, finger, root: (OPEN_PC[string] + f) % 12 === tones.root });
  });
  const muted = frets.map((f, i) => (f === null ? LOW_TO_HIGH[i]! : null)).filter((s): s is StringNo => s !== null);
  const strings = frets.map((f, i) => (f !== null ? LOW_TO_HIGH[i]! : null)).filter((s): s is StringNo => s !== null);
  const d: Diagram = { name, notes, muted, ...(barre ? { barre: { fret: min, from: strings[0]!, to: 1 as StringNo, finger: 1 as Finger } } : {}) };
  if (!diagramMatches(d, tones)) return null;
  // Menos dedos, mais baixo no braço, mais cordas soando, cordas soltas são bem-vindas.
  const score = fingersNeeded * 3 + min * 1.2 + (max - min) * 2 - sounding - notes.filter((n) => n.fret === 0).length * 0.5;
  return { d, score };
}

export interface ChordShapes {
  name: string;
  shapes: Diagram[];
  /** "tabela" = forma consagrada; "gerada" = calculada pelo app a partir das notas. */
  source: "tabela" | "gerada" | "nenhuma";
}

/** Formas para um nome de acorde qualquer. Nunca devolve uma forma que não confira com as notas. */
export function shapesFor(name: string): ChordShapes {
  const tones = chordTones(name);
  if (!tones) return { name, shapes: [], source: "nenhuma" };
  const c = parseChord(normalizeChordName(name))!;
  const keys = [`${c.root}${c.suffix}`, `${ENHARMONIC[c.root] ?? c.root}${c.suffix}`];
  if (!c.bass) {
    for (const key of keys) {
      const table = COMMON[key];
      if (table) {
        const shapes = table.map(([f, fi, b]) => shape(name, f, fi, b)).filter((d) => diagramMatches(d, tones));
        if (shapes.length) return { name, shapes, source: "tabela" };
      }
    }
  }
  const generated = generateShapes(name);
  return generated.length ? { name, shapes: generated, source: "gerada" } : { name, shapes: [], source: "nenhuma" };
}

/** Lista para a biblioteca: as formas consagradas, na ordem musical. */
export function commonChordNames(): string[] {
  return Object.keys(COMMON);
}
export function chordFamily(name: string): "maior" | "menor" | "sétima" | "outros" {
  const c = parseChord(name);
  if (!c) return "outros";
  if (c.suffix === "") return "maior";
  if (c.suffix === "m") return "menor";
  if (/7/.test(c.suffix)) return "sétima";
  return "outros";
}
