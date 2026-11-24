// Pedais do Amp: definição única usada pela tela e pelo motor em Rust.
// A ordem e a quantidade de parâmetros espelham `crates/audio-engine/src/fx.rs` (idx e DEFAULTS).

export interface FxParam {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  def: number;
  unit?: "dB" | "ms" | "Hz" | "pct";
  /** Parâmetro de escolha: o valor é o índice da opção. */
  options?: string[];
}

export interface FxPedal {
  id: string;
  name: string;
  /** "pre" roda antes do amp, "post" depois. */
  place: "pre" | "post";
  params: FxParam[];
}

const knob = (id: string, label: string, min: number, max: number, step: number, def: number, unit?: FxParam["unit"]): FxParam => ({ id, label, min, max, step, def, unit });
const choice = (id: string, label: string, options: string[], def: number): FxParam => ({ id, label, min: 0, max: options.length - 1, step: 1, def, options });

export const FX_PEDALS: FxPedal[] = [
  { id: "gate", name: "Noise gate", place: "pre", params: [knob("thr", "Limiar", -90, -20, 1, -60, "dB"), knob("rel", "Soltura", 10, 1000, 10, 120, "ms")] },
  { id: "drive", name: "Overdrive", place: "pre", params: [knob("drive", "Drive", 0, 1, 0.01, 0.4, "pct"), knob("tone", "Tom", 0, 1, 0.01, 0.5, "pct"), knob("level", "Nível", -24, 12, 1, 0, "dB")] },
  { id: "eq", name: "EQ 3 bandas", place: "post", params: [knob("low", "Graves", -12, 12, 0.5, 0, "dB"), knob("mid", "Médios", -12, 12, 0.5, 0, "dB"), knob("high", "Agudos", -12, 12, 0.5, 0, "dB")] },
  { id: "phaser", name: "Phaser", place: "post", params: [knob("rate", "Velocidade", 0.02, 8, 0.01, 0.4, "Hz"), knob("depth", "Profundidade", 0, 1, 0.01, 0.6, "pct"), knob("fb", "Feedback", 0, 0.9, 0.01, 0.3, "pct"), knob("mix", "Mix", 0, 1, 0.01, 0.5, "pct")] },
  { id: "flanger", name: "Flanger", place: "post", params: [knob("rate", "Velocidade", 0.02, 5, 0.01, 0.25, "Hz"), knob("depth", "Profundidade", 0, 1, 0.01, 0.6, "pct"), knob("fb", "Feedback", 0, 0.9, 0.01, 0.4, "pct"), knob("mix", "Mix", 0, 1, 0.01, 0.5, "pct")] },
  { id: "chorus", name: "Chorus", place: "post", params: [knob("rate", "Velocidade", 0.05, 6, 0.01, 0.8, "Hz"), knob("depth", "Profundidade", 0, 1, 0.01, 0.5, "pct"), knob("mix", "Mix", 0, 1, 0.01, 0.5, "pct")] },
  { id: "tremolo", name: "Tremolo", place: "post", params: [knob("rate", "Velocidade", 0.2, 16, 0.1, 4, "Hz"), knob("depth", "Profundidade", 0, 1, 0.01, 0.5, "pct")] },
  { id: "delay", name: "Delay", place: "post", params: [choice("type", "Tipo", ["Digital", "Analógico", "Slapback"], 0), knob("time", "Tempo", 40, 1000, 5, 380, "ms"), knob("fb", "Feedback", 0, 0.92, 0.01, 0.35, "pct"), knob("tone", "Tom", 0, 1, 0.01, 0.7, "pct"), knob("mix", "Mix", 0, 1, 0.01, 0.3, "pct")] },
  { id: "reverb", name: "Reverb", place: "post", params: [choice("type", "Tipo", ["Sala", "Hall", "Plate"], 1), knob("size", "Tamanho", 0, 1, 0.01, 0.5, "pct"), knob("damp", "Abafar", 0, 1, 0.01, 0.4, "pct"), knob("pre", "Pré-delay", 0, 100, 1, 20, "ms"), knob("mix", "Mix", 0, 1, 0.01, 0.25, "pct")] },
];

/** Total de valores enviados ao motor: 1 (ligado) + parâmetros de cada pedal. */
export const FX_PARAM_COUNT = FX_PEDALS.reduce((n, p) => n + 1 + p.params.length, 0);

export type FxState = Record<string, { on: boolean; values: number[] }>;

export function fxDefaults(): FxState {
  return Object.fromEntries(FX_PEDALS.map((p) => [p.id, { on: false, values: p.params.map((x) => x.def) }]));
}

const clamp = (p: FxParam, v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.min(p.max, Math.max(p.min, v)) : p.def);

/** Aceita qualquer coisa vinda do armazenamento e devolve um estado válido. */
export function fxSanitize(raw: unknown): FxState {
  const base = fxDefaults();
  if (!raw || typeof raw !== "object") return base;
  const src = raw as Record<string, { on?: unknown; values?: unknown }>;
  for (const pedal of FX_PEDALS) {
    const item = src[pedal.id];
    if (!item || typeof item !== "object") continue;
    const values = Array.isArray(item.values) ? item.values : [];
    base[pedal.id] = { on: item.on === true, values: pedal.params.map((p, i) => clamp(p, values[i])) };
  }
  return base;
}

/** Lista plana na ordem do motor: [ligado, ...parâmetros] por pedal. */
export function fxFlatten(state: FxState): number[] {
  return FX_PEDALS.flatMap((p) => {
    const item = state[p.id] ?? { on: false, values: p.params.map((x) => x.def) };
    return [item.on ? 1 : 0, ...p.params.map((x, i) => clamp(x, item.values[i]))];
  });
}

export function fxFormat(p: FxParam, v: number): string {
  if (p.options) return p.options[Math.round(v)] ?? "";
  switch (p.unit) {
    case "dB": return `${v > 0 ? "+" : ""}${Number.isInteger(v) ? v : v.toFixed(1)} dB`;
    case "ms": return `${Math.round(v)} ms`;
    case "Hz": return `${v.toFixed(v < 1 ? 2 : 1)} Hz`;
    case "pct": return `${Math.round(v * 100)}%`;
    default: return String(v);
  }
}
