// Padrões e sons originais para estudo, inspirados nos estilos. Sem samples.
// Oito instrumentos, um por bit: bumbo 1, caixa 2, chimbal 4, chimbal aberto 8,
// aro 16, caixa fantasma 32, prato de condução 64, sino 128.
export type DrumInstrument = "kick" | "snare" | "hat" | "openHat" | "rim" | "ghost" | "ride" | "bell";
export const DRUM_INSTRUMENTS: DrumInstrument[] = ["kick", "snare", "hat", "openHat", "rim", "ghost", "ride", "bell"];

const K = 1, S = 2, H = 4, O = 8, R = 16, G = 32, B = 128;

// Cada padrão é um compasso 4/4 em 16 semicolcheias. Os índices 0, 4, 8 e 12 são os tempos.
export const DRUM_PATTERNS = [
  // Rock: bumbo no 1 e no 3 (com um bumbo extra antes do 4), caixa no 2 e no 4, chimbal em colcheias.
  { id: "rock", name: "Rock", steps: [K|H,0,H,0, S|H,0,H,0, K|H,0,K|H,0, S|H,0,H,0] },
  // Reggae one drop: o 1 fica vazio e bumbo com aro caem juntos no 3. Chimbal em colcheias.
  { id: "reggae", name: "Reggae (one drop)", steps: [H,0,H,0, H,0,H,0, K|R|H,0,H,0, H,0,H,O] },
  // Indie rock: colcheias com bumbo sincopado, caixa no 2 e 4 e chimbal aberto no fim do compasso.
  { id: "indie", name: "Indie rock", steps: [K|H,0,H,0, S|H,0,H,K, K|H,0,H,0, S|H,0,O,G] },
  // Metal: bumbo duplo em semicolcheias, caixa no 2 e 4, chimbal em colcheias.
  { id: "metal", name: "Metal", steps: [K|H,K,K|H,K, K|S|H,K,K|H,K, K|H,K,K|H,K, K|S|H,K,K|H,K] },
  // Ska: bumbo em todos os tempos pares, caixa no 2 e 4 e chimbal aberto no contratempo, fechado nos tempos.
  { id: "ska", name: "Ska", steps: [K|H,0,O,0, S|H,0,O,0, K|H,0,O,0, S|H,0,O,0] },
  // Afrobeat: chimbal contínuo, bumbo sincopado, aro no 2, caixa no 4, notas fantasma e sino em 3-3-4-2-4.
  { id: "afrobeat", name: "Afrobeat", steps: [K|H|B,H,H,H|B, R|H,H,K|H|B,H|G, H,H|G,K|H|B,H, S|H|B,H,H,H|G] },
  { id: "simple4", name: "Simples · bumbo", steps: [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0] },
  { id: "simple8", name: "Simples · bumbo e chimbal", steps: [5,0,4,0,5,0,4,0,5,0,4,0,5,0,4,0] },
  // Funk: chimbal em semicolcheias, caixas fantasma antes e depois da caixa principal, bumbo sincopado.
  { id: "funk", name: "Funk", steps: [K|H,H,H|G,H, S|H,H|G,H,K|H, H|G,K|H,H,H|G, S|H,H|G,K|H,H] },
  // Disco: bumbo em quatro, caixa no 2 e 4, chimbal aberto no contratempo.
  { id: "disco", name: "Disco", steps: [K|H,0,O,0, K|S|H,0,O,0, K|H,0,O,0, K|S|H,0,O,H] },
  // Bossa nova: bumbo nos tempos 1 e 3, chimbal em colcheias e aro na clave 3-2 (0, 3, 6, 10, 13).
  { id: "bossa", name: "Bossa nova", steps: [K|H|R,0,H,R, H,0,H|R,0, K|H,0,H|R,0, H,R,H,0] },
  // Drum n bass a meio tempo: bumbo no 1 e sincopado, caixa no 3, chimbal em colcheias.
  { id: "dnb", name: "Drum n bass (meio tempo)", steps: [K|H,0,H,0, H,0,H,K, S|H,0,K|H,0, H,0,H|G,G] },
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
  return !!v && typeof v.enabled === "boolean" && Number.isFinite(v.volume) && v.volume >= 0 && v.volume <= 1 && Array.isArray(v.pattern) && v.pattern.length === 16 && v.pattern.every((n) => Number.isInteger(n) && n >= 0 && n <= 255);
}
export const drumDuration = (instrument: DrumInstrument) => ({ kick: .3, snare: .2, hat: .07, openHat: .35, rim: .06, ghost: .12, ride: .55, bell: .22 })[instrument];
const TAU = Math.PI * 2;
/** PCM preparado fora do áudio. Ruído determinístico e osciladores com envelope. */
export function synthesizeDrum(instrument: DrumInstrument, sampleRate: number): Float32Array {
  if (!DRUM_INSTRUMENTS.includes(instrument) || !Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000) throw new Error("Som de bateria inválido.");
  const duration = drumDuration(instrument), data = new Float32Array(Math.round(duration * sampleRate));
  let seed = 0x12345678, previous = 0;
  const metal = (t: number, freqs: number[]) => freqs.reduce((sum, f) => sum + Math.sin(TAU * f * t), 0) / freqs.length;
  for (let i = 0; i < data.length; i++) {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    const noise = (seed >>> 0) / 4294967295 * 2 - 1;
    const bright = (noise - previous * .85) / 1.85; previous = noise;
    const t = i / sampleRate, attack = Math.min(1, t / .001), release = Math.min(1, (duration - t) / .01);
    let value: number;
    if (instrument === "kick") value = .36 * Math.sin(TAU * (42 * t + 110 * .018 * (1 - Math.exp(-t / .018)))) * Math.exp(-9 * t) + .1 * bright * Math.exp(-350 * t);
    else if (instrument === "snare") value = .17 * (.6 * Math.sin(TAU * 190 * t) + .4 * Math.sin(TAU * 330 * t)) * Math.exp(-28 * t) + .2 * bright * Math.exp(-16 * t);
    else if (instrument === "ghost") value = .06 * (.6 * Math.sin(TAU * 190 * t) + .4 * Math.sin(TAU * 330 * t)) * Math.exp(-40 * t) + .08 * bright * Math.exp(-30 * t);
    else if (instrument === "rim") value = .2 * (.6 * Math.sin(TAU * 1750 * t) + .4 * Math.sin(TAU * 520 * t)) * Math.exp(-110 * t) + .08 * bright * Math.exp(-400 * t);
    else if (instrument === "hat") value = .1 * (.55 * metal(t, [3520, 4410, 5280, 6050, 7210, 8530]) + bright) * Math.exp(-90 * t);
    else if (instrument === "openHat") value = .1 * (.55 * metal(t, [3520, 4410, 5280, 6050, 7210, 8530]) + bright) * Math.exp(-9 * t);
    else if (instrument === "ride") value = .1 * (metal(t, [3400, 4100, 5200, 6700, 8300]) + .3 * bright * Math.exp(-20 * t)) * Math.exp(-5 * t);
    else value = .14 * ((Math.sin(TAU * 540 * t) + .5 * Math.sin(TAU * 1620 * t) + Math.sin(TAU * 800 * t) + .5 * Math.sin(TAU * 2400 * t)) / 3) * Math.exp(-16 * t);
    data[i] = value * attack * release;
  }
  return data;
}
