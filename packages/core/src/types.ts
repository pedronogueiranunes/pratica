// Modelos de dados do app. Os nomes de campo do catálogo seguem o seed
// (data/exercises.seed.json), em português.

export type ExerciseType =
  | "dexteridade"
  | "acordes"
  | "escalas"
  | "ritmo"
  | "teoria"
  | "repertorio"
  | "ouvido"
  | "composicao";

export type MetricKind = "bpm" | "contagem" | "tempo" | "feito";

export interface Metric {
  tipo: MetricKind;
  /** Unidade para contagem e tempo, por exemplo "trocas/min", "s", "min". */
  unidade?: string;
  /** Meta para contagem e tempo. Para BPM, a meta é `bpmAlvo`. */
  alvo?: number;
}

export interface Exercise {
  id: string;
  fase: number;
  tipo: ExerciseType;
  nome: string;
  descricao: string;
  bpmInicial: number | null;
  bpmAlvo: number | null;
  duracaoMin: number | null;
  criterioSucesso: string;
  /** URLs do YouTube (formato https://www.youtube.com/watch?v=ID). */
  videos: string[];
  tags: string[];
  metrica: Metric;
}

export interface Phase {
  id: number;
  nome: string;
  periodo: string;
}

export interface Catalog {
  versao: number;
  fases: Phase[];
  tipos: ExerciseType[];
  regraMetronomo: string;
  exercicios: Exercise[];
}

/** Um registro de prática. Só cresce: nunca é editado no lugar, o que
 * deixa a sincronização entre dispositivos simples. */
export interface PracticeRecord {
  id: string;
  exerciseId: string;
  /** ISO 8601 com fuso. */
  at: string;
  durationMin?: number;
  bpm?: number;
  count?: number;
  seconds?: number;
  note?: string;
  /** Dispositivo que criou o registro (para a fusão via iCloud). */
  origin?: string;
}

export type DedicationLevel = "baixa" | "media" | "alta";

export type Theme = "sistema" | "claro" | "escuro";

export interface Settings {
  theme: Theme;
  locale: "pt-BR" | "en";
  /** Fase em que o Pedro está trabalhando agora (sem prazo). */
  currentPhase: number;
  dedication: DedicationLevel;
  metronome: {
    sound: "madeira" | "bip" | "aro" | "cowbell" | "suave";
    volume: number;
    beatsPerBar: number;
    subdivision: number;
    accentFirstBeat: boolean;
    progression: "auto" | "manual";
    outputDeviceId?: string;
  };
  tuner: {
    a4: number;
    inputDeviceId?: string;
    inputChannel: number;
  };
}

export const defaultSettings: Settings = {
  theme: "sistema",
  locale: "pt-BR",
  currentPhase: 1,
  dedication: "media",
  metronome: {
    sound: "madeira",
    volume: 0.8,
    beatsPerBar: 4,
    subdivision: 1,
    accentFirstBeat: true,
    progression: "auto",
  },
  tuner: { a4: 440, inputChannel: 0 },
};
