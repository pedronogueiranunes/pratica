// Reconhecimento de acorde a partir do cromagrama ao vivo. Estimativa, não verdade:
// devolve os candidatos mais prováveis com uma nota de confiança e o baixo detectado.
import { chordTones } from "./chord-shapes";
import { chordNoteName } from "./chord-voicing";
import { transposeNote } from "./chords";
import type { ChromaReading } from "./chromagram";

const SUFFIXES = ["", "m", "7", "7M", "m7", "6", "m6", "sus2", "sus4", "add9", "dim", "dim7", "aug", "m7(b5)", "9", "m9"];
const TEMPLATES = Array.from({ length: 12 }, (_, root) => SUFFIXES.flatMap((suffix) => {
  const tones = chordTones(transposeNote("C", root) + suffix);
  if (!tones) return [];
  const pcs = tones.intervals.map((i) => (root + i) % 12);
  const required = tones.required.map((i) => (root + i) % 12);
  return [{ root, suffix, intervals: tones.intervals, pcs, required }];
})).flat();

export interface RecognizedChord {
  /** Nome com baixo quando é inversão, por exemplo "C/E". */
  name: string;
  /** Nome sem o baixo, por exemplo "C". */
  base: string;
  root: number;
  bass: number | null;
  /** 0 a 1. Não é probabilidade: serve para ordenar e para recusar o fraco. */
  score: number;
  /** "Fundamental", "1ª inversão", "2ª inversão", "3ª inversão" ou null quando o baixo é desconhecido ou fora dessas. */
  inversion: string | null;
}

const INVERSION = ["Fundamental", "1ª inversão", "2ª inversão", "3ª inversão"];

export function recognizeChords(chroma: ChromaReading | null, bass: number | null, flats = false, limit = 4): RecognizedChord[] {
  if (!chroma || chroma.pcs.length < 3 || chroma.values.length !== 12) return [];
  const values = chroma.values, total = values.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return [];
  const scored = TEMPLATES.map((t) => {
    const inside = t.pcs.reduce((sum, pc) => sum + values[pc]!, 0);
    const missing = t.required.filter((pc) => values[pc]! < .2).length;
    const score = inside / total - .3 * missing - .012 * t.pcs.length + (bass !== null && bass === t.root ? .08 : 0);
    return { t, score, missing };
  }).filter((x) => x.missing <= (x.t.required.length >= 4 ? 1 : 0) && x.score >= .55)
    .sort((a, b) => b.score - a.score || a.t.suffix.length - b.t.suffix.length);
  const seen = new Set<string>();
  const out: RecognizedChord[] = [];
  for (const { t, score } of scored) {
    const base = transposeNote("C", t.root, flats) + t.suffix;
    // Inversão só vale se o baixo for tão presente quanto a fundamental; senão o baixo detectado é provavelmente ruído ou outra corda.
    const max = Math.max(...values);
    const bassOk = bass !== null && t.pcs.includes(bass) && (bass === t.root || (values[bass]! >= .75 * values[t.root]! && values[bass]! >= .4 * max));
    const inChord = bassOk;
    let name = base, inversion: string | null = null;
    if (inChord && bass !== t.root) {
      const spelled = chordNoteName(base, bass) ?? transposeNote("C", bass, flats);
      name = `${base}/${spelled}`;
    }
    if (inChord) { const idx = t.intervals.indexOf(((bass! - t.root) % 12 + 12) % 12); inversion = INVERSION[idx] ?? `Baixo em ${transposeNote("C", bass!, flats)}`; }
    if (seen.has(name)) continue;
    seen.add(name);
    out.push({ name, base, root: t.root, bass: inChord ? bass : null, score: Math.max(0, Math.min(1, score)), inversion });
    if (out.length >= limit) break;
  }
  return out;
}

/** Classe de altura do baixo: o pico mais grave que tenha força, conferindo se não é só um harmônico. */
export function lowestPitchClass(powers: ArrayLike<number>, sampleRate: number, fftSize: number, a4 = 440): number | null {
  if (!Number.isFinite(sampleRate) || !Number.isInteger(fftSize) || fftSize < 32 || sampleRate / fftSize > 4 || powers.length < 3) return null;
  const peaks: { frequency: number; amplitude: number }[] = [];
  let maximum = 0;
  for (let i = 1; i < powers.length - 1; i++) {
    const b = powers[i]!;
    if (!Number.isFinite(b) || b <= powers[i - 1]! || b < powers[i + 1]! || b < 1e-12) continue;
    const left = Math.log(Math.max(powers[i - 1]!, 1e-20)), center = Math.log(b), right = Math.log(Math.max(powers[i + 1]!, 1e-20));
    const denominator = left - 2 * center + right;
    const offset = denominator ? Math.max(-.5, Math.min(.5, .5 * (left - right) / denominator)) : 0;
    const frequency = (i + offset) * sampleRate / fftSize;
    if (frequency < 65 || frequency > 1400) continue;
    const amplitude = Math.sqrt(b);
    maximum = Math.max(maximum, amplitude);
    peaks.push({ frequency, amplitude });
  }
  if (!maximum) return null;
  const near = (target: number, minimum: number) => peaks.some((p) => p.amplitude >= minimum && Math.abs(1200 * Math.log2(p.frequency / target)) < 40);
  for (const p of peaks) {
    if (p.frequency > 500) break;
    if (p.amplitude < .3 * maximum) continue;
    // Se existe energia na metade ou num terço da frequência, este pico é harmônico de uma nota mais grave.
    if ((p.frequency / 2 >= 65 && near(p.frequency / 2, .12 * maximum)) || (p.frequency / 3 >= 65 && near(p.frequency / 3, .12 * maximum))) continue;
    const midi = 69 + 12 * Math.log2(p.frequency / a4), nearest = Math.round(midi);
    if (Math.abs(midi - nearest) > .4) continue;
    return ((nearest % 12) + 12) % 12;
  }
  return null;
}

/** Acorde estável: confirma só depois de várias leituras iguais seguidas e segura por um tempo sem sinal. */
export class ChordStabilizer {
  private candidate = "";
  private streak = 0;
  private confirmed: RecognizedChord | null = null;
  private lastSeen = 0;
  constructor(private readonly needed = 3, private readonly holdMs = 1800) {}
  push(top: RecognizedChord | null, now: number): { chord: RecognizedChord | null; changed: boolean } {
    if (top) {
      this.lastSeen = now;
      if (top.name === this.candidate) this.streak++; else { this.candidate = top.name; this.streak = 1; }
      if (this.streak >= this.needed && this.confirmed?.name !== top.name) { this.confirmed = top; return { chord: top, changed: true }; }
    } else if (this.confirmed && now - this.lastSeen > this.holdMs) {
      this.confirmed = null; this.candidate = ""; this.streak = 0;
      return { chord: null, changed: true };
    }
    return { chord: this.confirmed, changed: false };
  }
  reset() { this.candidate = ""; this.streak = 0; this.confirmed = null; this.lastSeen = 0; }
}

/** Média das últimas leituras: tira o pisca da palhetada e dos quadros ruins. */
export class ChromaSmoother {
  private history: { values: number[]; bass: number | null }[] = [];
  constructor(private readonly size = 4) {}
  push(values: number[], bass: number | null): { values: number[]; bass: number | null } {
    this.history.push({ values, bass });
    if (this.history.length > this.size) this.history.shift();
    const avg = Array.from({ length: 12 }, (_, i) => this.history.reduce((sum, h) => sum + (h.values[i] ?? 0), 0) / this.history.length);
    const votes = new Map<number, number>();
    for (const h of this.history) if (h.bass !== null) votes.set(h.bass, (votes.get(h.bass) ?? 0) + 1);
    let best: number | null = null, count = 0;
    for (const [pc, n] of votes) if (n > count) { best = pc; count = n; }
    return { values: avg, bass: count * 2 > this.history.length ? best : null };
  }
  reset() { this.history = []; }
}
