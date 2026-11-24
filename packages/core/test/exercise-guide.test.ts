import { describe, expect, it } from "vitest";
import seed from "../../../data/exercises.seed.json";
import { EXERCISE_GUIDES, exerciseGuide, exerciseVisual, parseCatalog, studyTempo } from "../src";

const catalog = parseCatalog(seed);

describe("guia dos exercícios sem tab", () => {
  it("todo exercício sem tab tem guia com passos e pontos de atenção", () => {
    for (const e of catalog.exercicios.filter((x) => !exerciseVisual(x.id))) {
      const guide = exerciseGuide(e.id);
      expect(guide, e.id).not.toBeNull();
      expect(guide!.steps.length).toBeGreaterThanOrEqual(3);
      expect(guide!.watch.length).toBeGreaterThanOrEqual(1);
      expect(guide!.intro.length).toBeGreaterThan(20);
    }
  });
  it("não há guia para exercício inexistente nem para exercício que já tem tab", () => {
    const ids = new Set(catalog.exercicios.map((e) => e.id));
    for (const id of Object.keys(EXERCISE_GUIDES)) {
      expect(ids.has(id), id).toBe(true);
      expect(exerciseVisual(id), id).toBeNull();
    }
  });
  it("texto sem travessão e grades de colcheias com 8 células", () => {
    for (const [id, g] of Object.entries(EXERCISE_GUIDES)) {
      const text = JSON.stringify(g);
      expect(text.includes("—"), id).toBe(false);
      if (g.rhythm) expect(g.rhythm.cells).toHaveLength(8);
    }
  });
  it("calcula o andamento de estudo", () => {
    expect(studyTempo(120, 70)).toBe(84);
    expect(studyTempo(40, 50)).toBe(30);
    expect(studyTempo(0, 70)).toBe(0);
    expect(studyTempo(NaN, 70)).toBe(0);
  });
});
