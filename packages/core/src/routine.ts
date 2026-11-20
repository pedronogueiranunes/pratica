import type { Catalog, DedicationLevel, Exercise, ExerciseType, PracticeRecord } from "./types";

export type BlockKind = "aquecimento" | "dexteridade" | "teoria" | "musica" | "ouvido";

export interface RoutineBlock {
  kind: BlockKind;
  minutes: number;
  exerciseId: string | null;
}

/** Blocos de cada nível. O nível médio é a rotina de 40 minutos do roadmap. */
export const ROUTINE_TEMPLATES: Record<DedicationLevel, { kind: BlockKind; minutes: number }[]> = {
  baixa: [
    { kind: "aquecimento", minutes: 5 },
    { kind: "dexteridade", minutes: 10 },
    { kind: "musica", minutes: 5 },
  ],
  media: [
    { kind: "aquecimento", minutes: 5 },
    { kind: "dexteridade", minutes: 10 },
    { kind: "teoria", minutes: 5 },
    { kind: "musica", minutes: 15 },
    { kind: "ouvido", minutes: 5 },
  ],
  alta: [
    { kind: "aquecimento", minutes: 5 },
    { kind: "dexteridade", minutes: 10 },
    { kind: "dexteridade", minutes: 10 },
    { kind: "teoria", minutes: 5 },
    { kind: "musica", minutes: 20 },
    { kind: "ouvido", minutes: 10 },
  ],
};

const POOL_TYPES: Record<BlockKind, ExerciseType[]> = {
  aquecimento: [],
  dexteridade: ["dexteridade", "acordes", "escalas", "ritmo"],
  teoria: ["teoria"],
  musica: ["repertorio", "composicao"],
  ouvido: ["ouvido"],
};

/** Fase 0 guarda os exercícios fixos da rotina diária. */
const DAILY_PHASE = 0;

function isWarmup(e: Exercise) {
  return e.tags.includes("aquecimento");
}

function pool(catalog: Catalog, kind: BlockKind, phase: number): Exercise[] {
  if (kind === "aquecimento") {
    return catalog.exercicios.filter((e) => e.fase === DAILY_PHASE && isWarmup(e));
  }
  const types = POOL_TYPES[kind];
  const inPhase = catalog.exercicios.filter((e) => e.fase === phase && types.includes(e.tipo) && !isWarmup(e));
  if (inPhase.length > 0) return inPhase;
  return catalog.exercicios.filter((e) => e.fase === DAILY_PHASE && types.includes(e.tipo) && !isWarmup(e));
}

export function lastPracticed(history: PracticeRecord[]): Map<string, number> {
  const last = new Map<string, number>();
  for (const r of history) {
    const t = Date.parse(r.at);
    if (!Number.isFinite(t)) continue;
    if (t > (last.get(r.exerciseId) ?? -Infinity)) last.set(r.exerciseId, t);
  }
  return last;
}

/**
 * Sugere a rotina do dia: para cada bloco, o exercício da fase que está há
 * mais tempo sem prática (os nunca feitos vêm primeiro, na ordem do catálogo).
 * Não repete exercício dentro do mesmo dia quando há alternativa.
 */
export function suggestRoutine(args: {
  catalog: Catalog;
  phase: number;
  level: DedicationLevel;
  history: PracticeRecord[];
}): RoutineBlock[] {
  const { catalog, phase, level, history } = args;
  const last = lastPracticed(history);
  const order = new Map(catalog.exercicios.map((e, i) => [e.id, i]));
  const used = new Set<string>();

  return ROUTINE_TEMPLATES[level].map(({ kind, minutes }) => {
    const candidates = pool(catalog, kind, phase).sort((a, b) => {
      const la = last.get(a.id) ?? -Infinity;
      const lb = last.get(b.id) ?? -Infinity;
      if (la !== lb) return la - lb;
      return (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
    });
    const pick = candidates.find((e) => !used.has(e.id)) ?? candidates[0] ?? null;
    if (pick) used.add(pick.id);
    return { kind, minutes, exerciseId: pick?.id ?? null };
  });
}

export function routineMinutes(blocks: RoutineBlock[]): number {
  return blocks.reduce((s, b) => s + b.minutes, 0);
}
