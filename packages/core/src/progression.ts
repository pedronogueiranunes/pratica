// Regra do metrônomo do roadmap: começar lento e subir 4 bpm só depois de
// 5 execuções seguidas sem erro. No modo automático o app sobe sozinho;
// no manual ele só conta e quem decide é o Pedro.

export interface ProgressionRule {
  cleanRunsNeeded: number;
  stepBpm: number;
}

export const DEFAULT_RULE: ProgressionRule = { cleanRunsNeeded: 5, stepBpm: 4 };

export interface ProgressionState {
  bpm: number;
  streak: number;
}

export type ProgressionOutcome =
  | { kind: "continua"; state: ProgressionState }
  | { kind: "subiu"; state: ProgressionState; from: number }
  | { kind: "pronto-para-subir"; state: ProgressionState }
  | { kind: "errou"; state: ProgressionState }
  | { kind: "meta-atingida"; state: ProgressionState };

export function registerRun(
  state: ProgressionState,
  clean: boolean,
  opts: { mode: "auto" | "manual"; targetBpm?: number | null; rule?: ProgressionRule },
): ProgressionOutcome {
  const rule = opts.rule ?? DEFAULT_RULE;
  if (!clean) return { kind: "errou", state: { ...state, streak: 0 } };

  const streak = state.streak + 1;
  if (streak < rule.cleanRunsNeeded) return { kind: "continua", state: { ...state, streak } };

  const target = opts.targetBpm ?? null;
  if (target !== null && state.bpm >= target) {
    return { kind: "meta-atingida", state: { bpm: state.bpm, streak: 0 } };
  }
  if (opts.mode === "manual") return { kind: "pronto-para-subir", state: { ...state, streak } };

  const next = target !== null ? Math.min(state.bpm + rule.stepBpm, target) : state.bpm + rule.stepBpm;
  return { kind: "subiu", state: { bpm: next, streak: 0 }, from: state.bpm };
}

/**
 * Tap tempo: calcula o BPM pela mediana dos intervalos entre toques
 * (resiste a um toque fora do tempo). Toques com mais de 2 s de pausa
 * recomeçam a contagem.
 */
export function tapTempo(tapsMs: number[], maxGapMs = 2000): number | null {
  let start = 0;
  for (let i = 1; i < tapsMs.length; i++) {
    if ((tapsMs[i] ?? 0) - (tapsMs[i - 1] ?? 0) > maxGapMs) start = i;
  }
  const recent = tapsMs.slice(start).slice(-8);
  if (recent.length < 3) return null;
  const gaps = recent.slice(1).map((t, i) => t - (recent[i] ?? t)).sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  const median = gaps.length % 2 ? (gaps[mid] ?? 0) : ((gaps[mid - 1] ?? 0) + (gaps[mid] ?? 0)) / 2;
  if (median <= 0) return null;
  return Math.round((60_000 / median) * 10) / 10;
}
