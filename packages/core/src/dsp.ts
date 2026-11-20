// DSP para o webapp: os mesmos algoritmos do motor em Rust
// (crates/audio-engine), portados para rodar no navegador.

export const MIN_FREQ = 55;
export const MAX_FREQ = 1400;

/** YIN (de Cheveigné e Kawahara, 2002). Devolve frequência e confiança. */
export function detectPitch(
  samples: Float32Array,
  sampleRate: number,
  threshold = 0.12,
): { frequency: number; clarity: number } | null {
  const w = Math.floor(samples.length / 2);
  const maxTau = Math.min(Math.ceil(sampleRate / MIN_FREQ), w);
  const minTau = Math.max(2, Math.floor(sampleRate / MAX_FREQ));
  if (maxTau <= minTau + 2) return null;
  const d = new Float32Array(maxTau + 1);
  for (let tau = 1; tau <= maxTau; tau++) {
    let sum = 0;
    for (let i = 0; i < w; i++) {
      const x = samples[i]! - samples[i + tau]!;
      sum += x * x;
    }
    d[tau] = sum;
  }
  d[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= maxTau; tau++) {
    running += d[tau]!;
    d[tau] = running > 0 ? (d[tau]! * tau) / running : 1;
  }
  let tau = minTau;
  let found = -1;
  while (tau < maxTau) {
    if (d[tau]! < threshold) {
      while (tau + 1 < maxTau && d[tau + 1]! < d[tau]!) tau++;
      found = tau;
      break;
    }
    tau++;
  }
  if (found < 0) return null;
  const a = d[found - 1]!;
  const b = d[found]!;
  const c = d[found + 1] ?? b;
  const denom = a + c - 2 * b;
  const better = Math.abs(denom) > 1e-9 ? found + (0.5 * (a - c)) / denom : found;
  const frequency = sampleRate / better;
  if (frequency < MIN_FREQ || frequency > MAX_FREQ) return null;
  return { frequency, clarity: Math.min(1, Math.max(0, 1 - b)) };
}

export function rms(samples: Float32Array): number {
  let s = 0;
  for (let i = 0; i < samples.length; i++) s += samples[i]! * samples[i]!;
  return samples.length ? Math.sqrt(s / samples.length) : 0;
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function noteFromFrequency(frequency: number, a4 = 440) {
  if (!(frequency > 0 && a4 > 0)) return null;
  const semis = 12 * Math.log2(frequency / a4);
  const nearest = Math.round(semis);
  const midi = 69 + nearest;
  return {
    name: NOTE_NAMES[((midi % 12) + 12) % 12]!,
    octave: Math.floor(midi / 12) - 1,
    midi,
    cents: (semis - nearest) * 100,
    frequency,
    targetFrequency: a4 * 2 ** (nearest / 12),
  };
}

export type ClickSoundName = "madeira" | "bip" | "aro" | "cowbell" | "suave";
export type ClickKind = "accent" | "beat" | "subdivision";

/** Mesmos sons do motor em Rust (click.rs). */
export function synthesizeClick(sound: ClickSoundName, kind: ClickKind, sampleRate: number): Float32Array {
  const [pitchMul, gain] = kind === "accent" ? [1.5, 1] : kind === "beat" ? [1, 0.8] : [0.8, 0.45];
  const dur = sound === "suave" ? 0.12 : sound === "cowbell" ? 0.09 : 0.05;
  const len = Math.floor(dur * sampleRate);
  const out = new Float32Array(len);
  let x = 0x9e3779b9 >>> 0;
  const noise = () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    return (x / 0xffffffff) * 2 - 1;
  };
  let lp = 0;
  const TAU = Math.PI * 2;
  for (let i = 0; i < len; i++) {
    const t = i / sampleRate;
    let s = 0;
    if (sound === "madeira") {
      const f = 1800 * pitchMul;
      s = (Math.sin(TAU * f * t) * 0.7 + Math.sin(TAU * f * 2.7 * t) * 0.3 + noise() * Math.exp(-t * 900) * 0.6) * Math.exp(-t * 90);
    } else if (sound === "bip") {
      s = Math.sin(TAU * 1000 * pitchMul * t) * Math.min(1, t / 0.002) * Math.max(0, 1 - t / dur);
    } else if (sound === "aro") {
      lp += 0.35 * (noise() - lp);
      s = (lp * 0.9 + Math.sin(TAU * 330 * pitchMul * t) * Math.exp(-t * 40) * 0.5) * Math.exp(-t * 70);
    } else if (sound === "cowbell") {
      const sq = (f: number) => ((f * t) % 1 < 0.5 ? 1 : -1);
      lp += 0.25 * ((sq(540 * pitchMul) + sq(800 * pitchMul)) * 0.5 - lp);
      s = lp * Math.exp(-t * 35);
    } else {
      s = Math.sin(TAU * 440 * pitchMul * t) * Math.min(1, t / 0.008) * Math.exp(-t * 28);
    }
    out[i] = s;
  }
  let peak = 1e-6;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  const norm = (gain * 0.9) / peak;
  const fade = Math.floor(0.003 * sampleRate);
  for (let i = 0; i < len; i++) {
    out[i] = out[i]! * norm;
    const fromEnd = len - 1 - i;
    if (fromEnd < fade) out[i] = out[i]! * (fromEnd / fade);
  }
  return out;
}
