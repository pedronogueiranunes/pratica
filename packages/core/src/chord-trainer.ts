// Troca de acordes no tempo do metrônomo. Só regras; a interface só lê o estado.

export interface TrainerConfig {
  chords: string[];
  /** Tempos em cada acorde antes de trocar (1, 2, 4 ou 8). */
  beatsPerChord: number;
}
export interface TrainerState {
  /** Tempos contados desde o início (semínimas, sem subdivisão). */
  beats: number;
  current: string | null;
  next: string | null;
  /** Tempos que faltam para a próxima troca, contando o atual (beatsPerChord..1). */
  beatsLeft: number;
  /** Trocas já pedidas pelo metrônomo. Não diz se saíram limpas. */
  changes: number;
}

export const BEAT_OPTIONS = [1, 2, 4, 8] as const;
/** Pares do exercício "Troca de acordes em 1 minuto", na ordem da descrição. */
export const PRESET_PAIRS: string[][] = [["G", "C"], ["Am", "E"], ["D", "A"]];

export function trainerState(config: TrainerConfig, beats: number): TrainerState {
  const n = config.chords.length;
  const per = Math.max(1, Math.floor(config.beatsPerChord));
  if (!n) return { beats, current: null, next: null, beatsLeft: per, changes: 0 };
  const slot = Math.floor(beats / per);
  return {
    beats,
    current: config.chords[slot % n]!,
    next: config.chords[(slot + 1) % n]!,
    beatsLeft: per - (beats % per),
    changes: n > 1 ? slot : 0,
  };
}

/** Trocas por minuto, arredondadas para baixo. Null antes de 10 s para não exagerar o número. */
export function changesPerMinute(changes: number, elapsedMs: number): number | null {
  if (elapsedMs < 10_000) return null;
  return Math.floor((changes * 60_000) / elapsedMs);
}
/** BPM em que o metrônomo pede um número de trocas por minuto. */
export function bpmForChangesPerMinute(perMinute: number, beatsPerChord: number): number {
  return perMinute * beatsPerChord;
}
