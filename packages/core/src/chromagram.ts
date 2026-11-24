import { chordTones } from './chord-shapes';
import { transposeNote } from './chords';

/** FFT de janela Hann, sem PCM persistido. Executar fora da callback de áudio. */
export function powerSpectrum(samples: Float32Array): Float32Array {
  const n = samples.length;
  if (n < 32 || n > 65536 || (n & (n - 1))) throw new Error('Janela espectral inválida.');
  const re = new Float64Array(n), im = new Float64Array(n);
  let mean = 0;
  for (const x of samples) { if (!Number.isFinite(x)) throw new Error('Sinal inválido.'); mean += x / n; }
  for (let i = 0; i < n; i++) re[i] = (samples[i]! - mean) * (.5 - .5 * Math.cos(2 * Math.PI * i / (n - 1)));
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    while (j & bit) { j ^= bit; bit >>= 1; } j ^= bit;
    if (i < j) [re[i], re[j]] = [re[j]!, re[i]!];
  }
  for (let size = 2; size <= n; size *= 2) {
    const angle = -2 * Math.PI / size, wr = Math.cos(angle), wi = Math.sin(angle);
    for (let base = 0; base < n; base += size) {
      let ar = 1, ai = 0;
      for (let k = 0; k < size / 2; k++) {
        const a = base + k, b = a + size / 2;
        const br = ar * re[b]! - ai * im[b]!, bi = ar * im[b]! + ai * re[b]!;
        re[b] = re[a]! - br; im[b] = im[a]! - bi; re[a] = re[a]! + br; im[a] = im[a]! + bi;
        [ar, ai] = [ar * wr - ai * wi, ar * wi + ai * wr];
      }
    }
  }
  return Float32Array.from(re.subarray(0, n / 2 + 1), (r, i) => (r * r + im[i]! ** 2) / n ** 2);
}

export interface ChromaReading { values: number[]; pcs: number[]; candidates: string[] }
const SUFFIXES = ['', 'm', 'dim', 'aug', 'sus2', 'sus4', '6', 'm6', '7', '7M', 'm7', 'm7(b5)', 'dim7', 'add9', '9', 'm9', '6/9'];
const TEMPLATES = Array.from({ length: 12 }, (_, root) => SUFFIXES.flatMap((suffix) => {
  const name = transposeNote('C', root) + suffix, tones = chordTones(name);
  return tones ? [{ root, suffix, pcs: tones.intervals.map((i) => (root + i) % 12) }] : [];
})).flat();
/** Classes, sem oitava ou baixo inferido. Correspondência exata; pode não haver acorde. */
export function chromaFromSpectrum(powers: ArrayLike<number>, sampleRate: number, fftSize: number, level: number, a4 = 440, flats = false): ChromaReading | null {
  if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 384000 || !Number.isInteger(fftSize) || fftSize < 32 || fftSize > 65536 || (fftSize & (fftSize - 1)) || sampleRate / fftSize > 4
    || !Number.isFinite(level) || level < .004 || !Number.isFinite(a4) || a4 < 400 || a4 > 480 || powers.length < 3 || powers.length > fftSize / 2 + 1) return null;
  for (let i = 0; i < powers.length; i++) if (!Number.isFinite(powers[i]) || powers[i]! < 0) return null;
  const peaks: { frequency: number; amplitude: number; pc: number }[] = [];
  let maximum = 0;
  for (let i = 1; i < powers.length - 1; i++) {
    const b = powers[i]!;
    if (b <= powers[i - 1]! || b < powers[i + 1]! || b < 1e-12) continue;
    const left = Math.log(Math.max(powers[i - 1]!, 1e-20)), center = Math.log(b), right = Math.log(Math.max(powers[i + 1]!, 1e-20));
    const denominator = left - 2 * center + right;
    const offset = denominator ? Math.max(-.5, Math.min(.5, .5 * (left - right) / denominator)) : 0;
    const frequency = (i + offset) * sampleRate / fftSize;
    if (frequency < 65 || frequency > 1400) continue;
    const midi = 69 + 12 * Math.log2(frequency / a4), nearest = Math.round(midi);
    if (Math.abs(midi - nearest) > .35) continue;
    const amplitude = Math.sqrt(b); maximum = Math.max(maximum, amplitude);
    peaks.push({ frequency, amplitude, pc: ((nearest % 12) + 12) % 12 });
  }
  if (!maximum) return null;
  const values = Array<number>(12).fill(0);
  for (let i = 0; i < peaks.length; i++) {
    const p = peaks[i]!;
    if (p.amplitude < maximum * .12) continue;
    // Atenua parciais inteiros de picos graves fortes; não é separação de fontes.
    const harmonic = peaks.slice(0, i).some((low) => {
      const ratio = p.frequency / low.frequency, n = Math.round(ratio);
      return low.amplitude >= maximum * .15 && n >= 2 && n <= 6 && Math.abs(1200 * Math.log2(ratio / n)) < 25;
    });
    values[p.pc] = Math.max(values[p.pc]!, p.amplitude * (harmonic ? .18 : 1));
  }
  const max = Math.max(...values);
  if (!max) return null;
  const normalized = values.map((v) => v / max), pcs = normalized.flatMap((v, pc) => v >= .25 ? [pc] : []);
  const candidates = pcs.length >= 3 && pcs.length <= 5 ? TEMPLATES.filter((t) => t.pcs.length === pcs.length && t.pcs.every((pc) => pcs.includes(pc))).map((t) => transposeNote('C', t.root, flats) + t.suffix) : [];
  return { values: normalized, pcs, candidates };
}
