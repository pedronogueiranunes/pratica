import type { Catalog, Exercise } from "./types";
import type { BlockKind, RoutineBlock } from "./routine";
import type { SavedRoutine } from "./store";
import { validateRoutine } from "./events";

export const PERSONAL_ROUTINE_ID = "personal";
export const BLOCK_KINDS: BlockKind[] = ["aquecimento", "dexteridade", "teoria", "musica", "ouvido"];

export function blockForExercise(exercise: Exercise): RoutineBlock {
  const kind: BlockKind = exercise.tags.includes("aquecimento") ? "aquecimento"
    : exercise.tipo === "teoria" ? "teoria"
    : exercise.tipo === "ouvido" ? "ouvido"
    : exercise.tipo === "repertorio" || exercise.tipo === "composicao" ? "musica"
    : "dexteridade";
  return { kind, exerciseId: exercise.id, minutes: exercise.duracaoMin ?? 5 };
}

/** Operações puras: o rascunho nunca modifica a sugestão nem a rotina salva. */
export function updateRoutineBlock(blocks: RoutineBlock[], index: number, patch: Partial<RoutineBlock>): RoutineBlock[] {
  return blocks.map((block, i) => i === index ? { ...block, ...patch } : { ...block });
}
export function removeRoutineBlock(blocks: RoutineBlock[], index: number): RoutineBlock[] {
  return blocks.filter((_, i) => i !== index).map((block) => ({ ...block }));
}
export function moveRoutineBlock(blocks: RoutineBlock[], from: number, to: number): RoutineBlock[] {
  const result = blocks.map((block) => ({ ...block }));
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= blocks.length || to < 0 || to >= blocks.length) return result;
  const [block] = result.splice(from, 1);
  result.splice(to, 0, block!);
  return result;
}
export function validatePersonalRoutine(routine: SavedRoutine, catalog: Catalog): void {
  validateRoutine(routine);
  if (!routine.name.trim()) throw new Error("Dê um nome para a rotina.");
  const ids = new Set(catalog.exercicios.map((exercise) => exercise.id));
  for (const block of routine.blocks) {
    if (!block.exerciseId || !ids.has(block.exerciseId)) throw new Error("Escolha um exercício válido para cada bloco.");
  }
}
