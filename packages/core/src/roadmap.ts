import type { Catalog, Exercise, ExerciseType } from "./types";

export interface RoadmapFilter {
  phase: number | "all";
  type: ExerciseType | "all";
}

/** Mantém a ordem editorial do seed em todas as visões. */
export function filterRoadmap(catalog: Catalog, filter: RoadmapFilter): Exercise[] {
  return catalog.exercicios.filter((exercise) =>
    (filter.phase === "all" || exercise.fase === filter.phase) &&
    (filter.type === "all" || exercise.tipo === filter.type),
  );
}

/** Praticado não significa concluído: avançar de fase é decisão do Pedro. */
export function practicedExerciseCount(exercises: Exercise[], counts: Record<string, number>): number {
  return exercises.filter((exercise) => (counts[exercise.id] ?? 0) > 0).length;
}
