import { describe, expect, it } from "vitest";
import seed from "../../../data/exercises.seed.json";
import {
  CatalogError,
  MESSAGE_KEYS,
  createTranslator,
  exercisesByPhase,
  parseCatalog,
  registerRun,
  routineMinutes,
  suggestRoutine,
  tapTempo,
  youtubeId,
  type PracticeRecord,
} from "../src";

const catalog = parseCatalog(seed);

describe("catálogo", () => {
  it("lê o seed inteiro com métrica em todos os exercícios", () => {
    expect(catalog.exercicios).toHaveLength(45);
    expect(catalog.fases.map((f) => f.id)).toEqual([0, 1, 2, 3, 4, 5]);
    for (const e of catalog.exercicios) {
      expect(["bpm", "contagem", "tempo", "feito"]).toContain(e.metrica.tipo);
      if (e.metrica.tipo === "bpm") expect(e.bpmAlvo).not.toBeNull();
    }
    const troca = catalog.exercicios.find((e) => e.id === "f1-troca-acordes");
    expect(troca?.metrica).toEqual({ tipo: "contagem", unidade: "trocas/min", alvo: 30 });
  });

  it("aponta o campo exato quando o seed está errado", () => {
    const broken = structuredClone(seed) as { exercicios: { fase: unknown }[] };
    broken.exercicios[3]!.fase = 99;
    expect(() => parseCatalog(broken)).toThrow(CatalogError);
    expect(() => parseCatalog(broken)).toThrow("exercicios[3].fase");
  });

  it("agrupa por fase e extrai IDs do YouTube", () => {
    const byPhase = exercisesByPhase(catalog);
    expect(byPhase.get(0)?.length).toBe(4);
    expect(youtubeId("https://www.youtube.com/watch?v=DBNNf4Ri3yc")).toBe("DBNNf4Ri3yc");
    expect(youtubeId("https://youtu.be/Se__aa_k-ms")).toBe("Se__aa_k-ms");
    expect(youtubeId("https://example.com/watch?v=x")).toBeNull();
    const all = catalog.exercicios.flatMap((e) => e.videos);
    expect(all.length).toBe(17);
    expect(all.every((u) => youtubeId(u) !== null)).toBe(true);
  });
});

describe("rotina sugerida", () => {
  it("nível normal soma 40 minutos com os 5 blocos do roadmap", () => {
    const r = suggestRoutine({ catalog, phase: 1, level: "media", history: [] });
    expect(r.map((b) => b.kind)).toEqual(["aquecimento", "dexteridade", "teoria", "musica", "ouvido"]);
    expect(routineMinutes(r)).toBe(40);
    expect(r[0]?.exerciseId).toBe("rotina-aquecimento");
    expect(r.every((b) => b.exerciseId !== null)).toBe(true);
  });

  it("leve e puxado mudam o tempo total", () => {
    expect(routineMinutes(suggestRoutine({ catalog, phase: 1, level: "baixa", history: [] }))).toBe(20);
    expect(routineMinutes(suggestRoutine({ catalog, phase: 1, level: "alta", history: [] }))).toBe(60);
  });

  it("prioriza o que está há mais tempo sem prática e não repete no dia", () => {
    const history: PracticeRecord[] = [
      { id: "1", exerciseId: "f1-spider", at: "2026-11-17T10:00:00-03:00" },
    ];
    const r = suggestRoutine({ catalog, phase: 1, level: "alta", history });
    const dex = r.filter((b) => b.kind === "dexteridade").map((b) => b.exerciseId);
    expect(dex).not.toContain("f1-spider");
    expect(new Set(dex).size).toBe(2);
  });

  it("fase sem exercício de um tipo cai na rotina diária", () => {
    const r = suggestRoutine({ catalog, phase: 4, level: "media", history: [] });
    expect(r.find((b) => b.kind === "teoria")?.exerciseId).toBe("rotina-teoria-aplicada");
  });
});

describe("regra do metrônomo", () => {
  it("sobe 4 bpm depois de 5 execuções limpas no modo automático", () => {
    let state = { bpm: 60, streak: 0 };
    for (let i = 0; i < 4; i++) {
      const out = registerRun(state, true, { mode: "auto", targetBpm: 80 });
      expect(out.kind).toBe("continua");
      state = out.state;
    }
    const out = registerRun(state, true, { mode: "auto", targetBpm: 80 });
    expect(out).toEqual({ kind: "subiu", state: { bpm: 64, streak: 0 }, from: 60 });
  });

  it("erro zera a sequência, manual só avisa e a meta limita", () => {
    expect(registerRun({ bpm: 60, streak: 4 }, false, { mode: "auto" }).state.streak).toBe(0);
    expect(registerRun({ bpm: 60, streak: 4 }, true, { mode: "manual" }).kind).toBe("pronto-para-subir");
    expect(registerRun({ bpm: 78, streak: 4 }, true, { mode: "auto", targetBpm: 80 }).state.bpm).toBe(80);
    expect(registerRun({ bpm: 80, streak: 4 }, true, { mode: "auto", targetBpm: 80 }).kind).toBe("meta-atingida");
  });

  it("tap tempo usa a mediana e recomeça depois de uma pausa", () => {
    expect(tapTempo([0, 500, 1000, 1500])).toBe(120);
    expect(tapTempo([0, 500, 1000, 1700, 2000])).toBe(120);
    expect(tapTempo([0, 500, 5000, 5600])).toBeNull();
    expect(tapTempo([0, 500, 5000, 5600, 6200])).toBe(100);
  });
});

describe("i18n", () => {
  it("interpola e formata números por idioma", () => {
    const pt = createTranslator("pt-BR");
    const en = createTranslator("en");
    expect(pt("tuner.reference", { hz: 440 })).toBe("Lá = 440 Hz");
    expect(pt("devices.latency", { ms: 12.5 })).toBe("12,5 ms");
    expect(en("devices.latency", { ms: 12.5 })).toBe("12.5 ms");
    expect(en("nav.hoje")).toBe("Today");
  });

  it("nenhum texto usa travessão longo, em nenhum idioma", () => {
    for (const t of [createTranslator("pt-BR"), createTranslator("en")]) {
      for (const key of MESSAGE_KEYS) expect(t(key), key).not.toMatch(/[—–]/);
    }
  });
});
