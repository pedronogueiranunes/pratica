// Braço da guitarra e tabs dos exercícios técnicos.
// Cordas numeradas como na tab: 1 = Mi agudo, 6 = Mi grave.
// Só há tab onde a descrição do exercício define as notas (casas, dedos,
// formas). Formas de acorde e escala são padrões de teoria, não dados de música.

export type StringNo = 1 | 2 | 3 | 4 | 5 | 6;
export type Finger = 0 | 1 | 2 | 3 | 4;

export interface FretNote {
  string: StringNo;
  fret: number;
  finger?: Finger;
  /** Nota fundamental (raiz) da forma, desenhada em destaque. */
  root?: boolean;
}

export interface Diagram {
  name: string;
  notes: FretNote[];
  /** Cordas abafadas (x). */
  muted?: StringNo[];
  barre?: { fret: number; from: StringNo; to: StringNo; finger: Finger };
}

/** Um passo da tab: notas tocadas juntas, com técnica opcional. */
export interface TabStep {
  notes: { string: StringNo; fret: number }[];
  technique?: "h" | "p" | "b" | "/" | "~";
  label?: string;
}

export interface ExerciseVisual {
  diagrams: Diagram[];
  tab: TabStep[];
  /** Quantos passos da tab cabem num clique do metrônomo. */
  stepsPerClick: number;
}

const STRINGS: StringNo[] = [6, 5, 4, 3, 2, 1];
const OPEN_MIDI: Record<StringNo, number> = { 6: 40, 5: 45, 4: 50, 3: 55, 2: 59, 1: 64 };
/** Altura que soa na afinação padrão, sem aplicar a oitava de escrita da guitarra. */
export function fretMidi(string: StringNo, fret: number): number | null {
  return OPEN_MIDI[string] !== undefined && Number.isInteger(fret) && fret >= 0 && fret <= 24 ? OPEN_MIDI[string] + fret : null;
}
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function noteName(string: StringNo, fret: number): string {
  return NAMES[(OPEN_MIDI[string] + fret) % 12]!;
}

/** Acorde a partir da notação "x32010" (corda 6 até a 1) e dedos "x32010". */
export function chord(name: string, frets: string, fingers: string, rootString?: StringNo): Diagram {
  const notes: FretNote[] = [];
  const muted: StringNo[] = [];
  [...frets].forEach((c, i) => {
    const string = STRINGS[i]!;
    if (c === "x") muted.push(string);
    else {
      const fret = parseInt(c, 36);
      const f = fingers[i];
      notes.push({
        string,
        fret,
        finger: f && f !== "x" ? (Number(f) as Finger) : 0,
        root: string === rootString,
      });
    }
  });
  return { name, notes, muted };
}

function withBarre(d: Diagram, fret: number, from: StringNo, to: StringNo): Diagram {
  return { ...d, barre: { fret, from, to, finger: 1 } };
}

const strum = (d: Diagram, label?: string): TabStep => ({
  notes: d.notes.map((n) => ({ string: n.string, fret: n.fret })),
  label: label ?? d.name,
});

// ---------- Formas ----------
export const CHORDS = {
  G: chord("G", "320003", "210003", 6),
  C: chord("C", "x32010", "x32010", 5),
  Am: chord("Am", "x02210", "x02310", 5),
  E: chord("E", "022100", "023100", 6),
  D: chord("D", "xx0232", "xx0132", 4),
  A: chord("A", "x02220", "x01230", 5),
  Em: chord("Em", "022000", "023000", 6),
  Dm: chord("Dm", "xx0231", "xx0231", 4),
  F: withBarre(chord("F", "133211", "134211", 6), 1, 6, 1),
  Bm: withBarre(chord("Bm", "x24432", "x13421", 5), 2, 5, 1),
  G_E: withBarre(chord("G (forma de E)", "355433", "134211", 6), 3, 6, 1),
  C_A: withBarre(chord("C (forma de A)", "x35553", "x12341", 5), 3, 5, 1),
  G5: chord("G5", "35xxxx", "13xxxx", 6),
  C5: chord("C5", "x35xxx", "x13xxx", 5),
  Am7: chord("Am7", "x02010", "x02010", 5),
  Cmaj7: chord("Cmaj7", "x32000", "x32000", 5),
  G7: chord("G7", "320001", "320001", 6),
  Dm7: chord("Dm7", "xx0211", "xx0211", 4),
  Fmaj7: chord("Fmaj7", "xx3210", "xx3210", 4),
} satisfies Record<string, Diagram>;

/** Escala desenhada a partir de casas por corda (da 6 para a 1). */
function scale(name: string, perString: number[][], rootMidiClass: number, fingerBase: number): Diagram {
  const notes: FretNote[] = [];
  perString.forEach((frets, i) => {
    const string = STRINGS[i]!;
    for (const fret of frets) {
      const finger = Math.min(4, Math.max(fret === 0 ? 0 : 1, fret - fingerBase + 1)) as Finger;
      notes.push({ string, fret, finger, root: (OPEN_MIDI[string] + fret) % 12 === rootMidiClass });
    }
  });
  return { name, notes };
}

const A = 9; // classe de altura de Lá
const C_ = 0;

// Pentatônica de Lá menor nas 5 posições.
const PENTA_AM = [
  scale("Posição 1 (casa 5)", [[5, 8], [5, 7], [5, 7], [5, 7], [5, 8], [5, 8]], A, 5),
  scale("Posição 2 (casa 7)", [[8, 10], [7, 10], [7, 10], [7, 9], [8, 10], [8, 10]], A, 7),
  scale("Posição 3 (casa 10)", [[10, 12], [10, 12], [10, 12], [9, 12], [10, 13], [10, 12]], A, 9),
  scale("Posição 4 (casa 12)", [[12, 15], [12, 15], [12, 14], [12, 14], [13, 15], [12, 15]], A, 12),
  scale("Posição 5 (casa 15)", [[15, 17], [15, 17], [14, 17], [14, 17], [15, 17], [15, 17]], A, 14),
];
const C_MAJOR_OPEN = scale("Dó maior, posição aberta", [[], [3], [0, 2, 3], [0, 2], [0, 1, 3], [0, 1]], C_, 1);
const A_DORIAN = scale(
  "Lá dórico, casa 5",
  [[5, 7, 8], [5, 7], [4, 5, 7], [4, 5, 7], [5, 7, 8], [5, 7, 8]],
  A,
  4,
);

// ---------- Sequências ----------
/** Um dedo por casa, corda a corda, da 6 para a 1 e de volta. */
function fingerPerFret(startFret: number): TabStep[] {
  const up: TabStep[] = [];
  for (const s of STRINGS) for (let i = 0; i < 4; i++) up.push({ notes: [{ string: s, fret: startFret + i }] });
  const down: TabStep[] = [];
  for (const s of [...STRINGS].reverse()) for (let i = 3; i >= 0; i--) down.push({ notes: [{ string: s, fret: startFret + i }] });
  return [...up, ...down];
}

function fingerPerFretDiagram(name: string, startFret: number): Diagram {
  return {
    name,
    notes: STRINGS.flatMap((s) =>
      [0, 1, 2, 3].map((i) => ({ string: s, fret: startFret + i, finger: (i + 1) as Finger })),
    ),
  };
}

/** Sobe e desce a escala na ordem das cordas. */
function scaleRun(d: Diagram): TabStep[] {
  const order = [...d.notes].sort((a, b) => b.string - a.string || a.fret - b.fret);
  const up = order.map((n) => ({ notes: [{ string: n.string, fret: n.fret }] }));
  return [...up, ...up.slice(0, -1).reverse()];
}

function trills(): TabStep[] {
  const out: TabStep[] = [];
  for (const top of [6, 7, 8]) {
    for (let r = 0; r < 2; r++) {
      out.push({ notes: [{ string: 3, fret: 5 }] });
      out.push({ notes: [{ string: 3, fret: top }], technique: "h" });
      out.push({ notes: [{ string: 3, fret: 5 }], technique: "p" });
    }
  }
  return out;
}

function alternate(a: Diagram, b: Diagram, times = 4): TabStep[] {
  const out: TabStep[] = [];
  for (let i = 0; i < times; i++) out.push(strum(a), strum(b));
  return out;
}

const VISUALS: Record<string, () => ExerciseVisual> = {
  "rotina-aquecimento": () => ({ diagrams: [fingerPerFretDiagram("Spider, casas 5 a 8", 5)], tab: fingerPerFret(5), stepsPerClick: 1 }),
  "f1-spider": () => ({ diagrams: [fingerPerFretDiagram("Spider, casas 5 a 8", 5)], tab: fingerPerFret(5), stepsPerClick: 1 }),
  "f1-cromatico": () => ({ diagrams: [fingerPerFretDiagram("Cromático, casas 1 a 4", 1)], tab: fingerPerFret(1), stepsPerClick: 1 }),
  "f1-troca-acordes": () => ({
    diagrams: [CHORDS.G, CHORDS.C, CHORDS.Am, CHORDS.E, CHORDS.D, CHORDS.A],
    tab: [...alternate(CHORDS.G, CHORDS.C), ...alternate(CHORDS.Am, CHORDS.E), ...alternate(CHORDS.D, CHORDS.A)],
    stepsPerClick: 1,
  }),
  "f1-dedo-guia": () => ({ diagrams: [CHORDS.G, CHORDS.C], tab: alternate(CHORDS.G, CHORDS.C), stepsPerClick: 1 }),
  "f1-acordes-limpos": () => {
    const all = [CHORDS.G, CHORDS.C, CHORDS.D, CHORDS.A, CHORDS.E, CHORDS.Am, CHORDS.Em, CHORDS.Dm];
    return { diagrams: all, tab: all.map((d) => strum(d)), stepsPerClick: 1 };
  },
  "f1-escala-maior": () => ({ diagrams: [C_MAJOR_OPEN], tab: scaleRun(C_MAJOR_OPEN), stepsPerClick: 1 }),
  "f2-pestana": () => ({ diagrams: [CHORDS.F, CHORDS.Bm], tab: alternate(CHORDS.F, CHORDS.Bm, 2), stepsPerClick: 1 }),
  "f2-formas-pestana": () => ({ diagrams: [CHORDS.G_E, CHORDS.C_A], tab: alternate(CHORDS.G_E, CHORDS.C_A), stepsPerClick: 1 }),
  "f2-power-chords": () => ({ diagrams: [CHORDS.G5, CHORDS.C5], tab: alternate(CHORDS.G5, CHORDS.C5), stepsPerClick: 1 }),
  "f2-pentatonica-pos1": () => ({ diagrams: [PENTA_AM[0]!], tab: scaleRun(PENTA_AM[0]!), stepsPerClick: 1 }),
  "f3-pentatonica-5-posicoes": () => ({ diagrams: PENTA_AM, tab: PENTA_AM.flatMap(scaleRun), stepsPerClick: 1 }),
  "f3-hammer-pull": () => ({
    diagrams: [{ name: "Trinados na corda 3", notes: [5, 6, 7, 8].map((f, i) => ({ string: 3 as StringNo, fret: f, finger: (i + 1) as Finger })) }],
    tab: trills(),
    stepsPerClick: 1,
  }),
  "f4-caged": () => {
    const shapes = [CHORDS.C, CHORDS.A, CHORDS.G, CHORDS.E, CHORDS.D];
    return { diagrams: shapes, tab: shapes.map((d) => strum(d)), stepsPerClick: 1 };
  },
  "f4-acordes-7-9": () => {
    const all = [CHORDS.Am7, CHORDS.Dm7, CHORDS.G7, CHORDS.Cmaj7, CHORDS.Fmaj7];
    return { diagrams: all, tab: all.map((d) => strum(d)), stepsPerClick: 1 };
  },
  "f4-dorico": () => ({ diagrams: [A_DORIAN], tab: scaleRun(A_DORIAN), stepsPerClick: 1 }),
};

export function exerciseVisual(exerciseId: string): ExerciseVisual | null {
  return VISUALS[exerciseId]?.() ?? null;
}

export function hasVisual(exerciseId: string): boolean {
  return exerciseId in VISUALS;
}

/** Faixa de casas para desenhar um conjunto de notas (mínimo de 5 casas). */
export function fretWindow(notes: { fret: number }[], min = 5): { from: number; to: number } {
  const fretted = notes.map((n) => n.fret).filter((f) => f > 0);
  if (fretted.length === 0) return { from: 1, to: min };
  let from = Math.min(...fretted);
  let to = Math.max(...fretted);
  if (to <= min) from = 1;
  if (to - from + 1 < min) to = from + min - 1;
  return { from, to };
}
