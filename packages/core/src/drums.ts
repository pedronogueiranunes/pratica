// Padrões e sons originais para estudo, inspirados nos estilos. Sem samples.
export type DrumInstrument = "kick" | "snare" | "hat" | "openHat" | "rim";
export const DRUM_INSTRUMENTS: DrumInstrument[] = ["kick", "snare", "hat", "openHat", "rim"];
export const DRUM_PATTERNS = [
  { id: "rock", name: "Rock", steps: [5,0,4,0,6,0,5,0,5,0,4,0,6,0,4,0] },
  { id: "reggae", name: "Reggae", steps: [4,0,4,0,4,0,4,0,21,0,4,0,4,0,4,0] },
  { id: "indie", name: "Indie rock", steps: [5,0,4,0,6,0,4,0,5,0,4,1,6,0,8,0] },
  { id: "metal", name: "Metal", steps: [5,0,5,1,6,0,5,0,5,0,5,1,6,0,5,1] },
  { id: "ska", name: "Ska", steps: [5,0,4,0,6,0,4,1,5,0,5,0,6,0,5,0] },
  { id: "afrobeat", name: "Afrobeat", steps: [5,0,4,16,6,1,4,16,5,0,6,1,6,0,4,16] },
  { id: "simple4", name: "Simples · bumbo", steps: [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0] },
  { id: "simple8", name: "Simples · bumbo e chimbal", steps: [5,0,4,0,5,0,4,0,5,0,4,0,5,0,4,0] },
] as const;
export type DrumPatternId = typeof DRUM_PATTERNS[number]["id"];
export interface DrumSettings { enabled: boolean; pattern: DrumPatternId; volume: number }
export interface AudioDrums { enabled: boolean; pattern: number[]; volume: number }
export const defaultDrums: DrumSettings = { enabled: false, pattern: "rock", volume: .5 };
export function compileDrums(settings: DrumSettings): AudioDrums {
  const pattern = DRUM_PATTERNS.find((p) => p.id === settings.pattern);
  if (!pattern || typeof settings.enabled !== "boolean" || !Number.isFinite(settings.volume) || settings.volume < 0 || settings.volume > 1) throw new Error("Bateria inválida.");
  return { enabled: settings.enabled, pattern: [...pattern.steps], volume: settings.volume };
}
export function validAudioDrums(v: AudioDrums): boolean {
  return !!v && typeof v.enabled === "boolean" && Number.isFinite(v.volume) && v.volume >= 0 && v.volume <= 1 && Array.isArray(v.pattern) && v.pattern.length === 16 && v.pattern.every((n) => Number.isInteger(n) && n >= 0 && n <= 31);
}
export const drumDuration = (instrument: DrumInstrument) => ({ kick: .28, snare: .18, hat: .06, openHat: .22, rim: .08 })[instrument];
/** PCM preparado fora do áudio. Ruído determinístico e osciladores com envelope. */
export function synthesizeDrum(instrument: DrumInstrument, sampleRate: number): Float32Array {
  if (!DRUM_INSTRUMENTS.includes(instrument) || !Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000) throw new Error("Som de bateria inválido.");
  const duration = drumDuration(instrument), data = new Float32Array(Math.round(duration * sampleRate));
  let seed = 0x12345678, previous = 0;
  for (let i = 0; i < data.length; i++) {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    const noise = (seed >>> 0) / 4294967295 * 2 - 1;
    const bright = (noise - previous * .85) / 1.85; previous = noise;
    const t = i / sampleRate, attack = Math.min(1, t / .001), release = Math.min(1, (duration - t) / .01);
    let value: number;
    if (instrument === "kick") value = .4 * Math.sin(2 * Math.PI * (48 * t + 52 * .028 * (1 - Math.exp(-t / .028)))) * Math.exp(-18 * t);
    else if (instrument === "snare") value = .22 * (.75 * bright + .25 * Math.sin(2 * Math.PI * 185 * t)) * Math.exp(-22 * t);
    else if (instrument === "rim") value = .15 * (.8 * Math.sin(2 * Math.PI * 920 * t) + .2 * bright) * Math.exp(-65 * t);
    else value = (instrument === "hat" ? .08 : .1) * bright * Math.exp(-(instrument === "hat" ? 70 : 18) * t);
    data[i] = value * attack * release;
  }
  return data;
}
