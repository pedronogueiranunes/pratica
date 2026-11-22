import { describe, expect, it } from "vitest";
import seed from "../../../data/exercises.seed.json";
import { blockForExercise, filterRoadmap, moveRoutineBlock, parseCatalog, practicedExerciseCount,
  removeRoutineBlock, routineMinutes, suggestRoutine, updateRoutineBlock, validatePersonalRoutine } from "../src";

const catalog = parseCatalog(seed);
describe("organização do roadmap", () => {
  it("combina filtros sem perder a fase zero nem alterar a ordem do seed", () => {
    expect(filterRoadmap(catalog, { phase: "all", type: "all" })).toEqual(catalog.exercicios);
    const zero = filterRoadmap(catalog, { phase: 0, type: "all" });
    expect(zero.length).toBeGreaterThan(0); expect(zero.every((e) => e.fase === 0)).toBe(true);
    const filtered = filterRoadmap(catalog, { phase: 1, type: "dexteridade" });
    expect(filtered).toEqual(catalog.exercicios.filter((e) => e.fase === 1 && e.tipo === "dexteridade"));
    expect(filterRoadmap(catalog, { phase: 5, type: "teoria" })).toEqual([]);
  });
  it("conta exercícios com prática sem usar repetições como conclusão", () => {
    const exercises = catalog.exercicios.slice(0, 3);
    expect(practicedExerciseCount(exercises, { [exercises[0]!.id]: 20, [exercises[1]!.id]: 0 })).toBe(1);
  });
});
describe("rotina própria", () => {
  it("edita, reordena e remove sem mutar a sugestão original", () => {
    const original = suggestRoutine({ catalog, phase: 1, level: "media", history: [] });
    const before = structuredClone(original);
    const edited = updateRoutineBlock(original, 1, { exerciseId: "f1-cromatico", minutes: 12 });
    const moved = moveRoutineBlock(edited, 1, 0);
    const removed = removeRoutineBlock(moved, 2);
    expect(moved[0]?.exerciseId).toBe("f1-cromatico");
    expect(removed).toHaveLength(4);
    expect(routineMinutes(edited)).toBe(42);
    expect(original).toEqual(before);
    expect(moveRoutineBlock(original, 0, -1)).toEqual(original);
    expect(moveRoutineBlock(original, 0, original.length)).toEqual(original);
    expect(moveRoutineBlock(original, 0.5, 1)).toEqual(original);
  });
  it("adiciona blocos coerentes com exercício e valida referências e duração", () => {
    const exercise = catalog.exercicios.find((e) => e.tipo === "repertorio")!;
    const block = blockForExercise(exercise);
    expect(block.kind).toBe("musica"); expect(block.exerciseId).toBe(exercise.id);
    const routine = { id: "personal", name: "Minha rotina", blocks: [block] };
    expect(() => validatePersonalRoutine(routine, catalog)).not.toThrow();
    expect(() => validatePersonalRoutine({ ...routine, blocks: [] }, catalog)).toThrow();
    expect(() => validatePersonalRoutine({ ...routine, name: " " }, catalog)).toThrow();
    expect(() => validatePersonalRoutine({ ...routine, blocks: [{ ...block, exerciseId: "não-existe" }] }, catalog)).toThrow();
    expect(() => validatePersonalRoutine({ ...routine, blocks: [{ ...block, minutes: NaN }] }, catalog)).toThrow();
    expect(() => validatePersonalRoutine({ ...routine, blocks: [{ ...block, minutes: 0 }] }, catalog)).toThrow();
  });
});
