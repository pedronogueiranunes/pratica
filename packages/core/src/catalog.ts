import type { Catalog, Exercise, ExerciseType, MetricKind } from "./types";

const EXERCISE_TYPES: ExerciseType[] = [
  "dexteridade",
  "acordes",
  "escalas",
  "ritmo",
  "teoria",
  "repertorio",
  "ouvido",
  "composicao",
];
const METRIC_KINDS: MetricKind[] = ["bpm", "contagem", "tempo", "feito"];

export class CatalogError extends Error {
  override name = "CatalogError";
}

function fail(path: string, msg: string): never {
  throw new CatalogError(`${path}: ${msg}`);
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function numOrNull(v: unknown, path: string): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "number" || !Number.isFinite(v)) fail(path, "esperava número ou null");
  return v;
}

function str(v: unknown, path: string): string {
  if (typeof v !== "string") fail(path, "esperava texto");
  return v;
}

/** Valida o seed e devolve o catálogo tipado. Erros apontam o campo exato. */
export function parseCatalog(raw: unknown): Catalog {
  if (!isObj(raw)) fail("seed", "não é um objeto");
  const fases = raw.fases;
  if (!Array.isArray(fases)) fail("fases", "esperava lista");
  const exercicios = raw.exercicios;
  if (!Array.isArray(exercicios)) fail("exercicios", "esperava lista");

  const phaseIds = new Set<number>();
  const parsedPhases = fases.map((f, i) => {
    if (!isObj(f)) fail(`fases[${i}]`, "não é um objeto");
    const id = f.id;
    if (typeof id !== "number") fail(`fases[${i}].id`, "esperava número");
    phaseIds.add(id);
    return { id, nome: str(f.nome, `fases[${i}].nome`), periodo: str(f.periodo, `fases[${i}].periodo`) };
  });

  const ids = new Set<string>();
  const parsed: Exercise[] = exercicios.map((e, i) => {
    const p = `exercicios[${i}]`;
    if (!isObj(e)) fail(p, "não é um objeto");
    const id = str(e.id, `${p}.id`);
    if (ids.has(id)) fail(`${p}.id`, `id repetido "${id}"`);
    ids.add(id);
    const fase = e.fase;
    if (typeof fase !== "number" || !phaseIds.has(fase)) fail(`${p}.fase`, `fase desconhecida (${String(fase)})`);
    const tipo = e.tipo as ExerciseType;
    if (!EXERCISE_TYPES.includes(tipo)) fail(`${p}.tipo`, `tipo desconhecido (${String(e.tipo)})`);
    const m = e.metrica;
    if (!isObj(m) || !METRIC_KINDS.includes(m.tipo as MetricKind)) {
      fail(`${p}.metrica`, "falta a métrica (rode scripts/add-metrics.mjs)");
    }
    const bpmInicial = numOrNull(e.bpmInicial, `${p}.bpmInicial`);
    const bpmAlvo = numOrNull(e.bpmAlvo, `${p}.bpmAlvo`);
    if (m.tipo === "bpm" && bpmAlvo === null) fail(`${p}.metrica`, "métrica bpm sem bpmAlvo");
    const videos = Array.isArray(e.videos) ? e.videos.map((v, j) => str(v, `${p}.videos[${j}]`)) : [];
    const tags = Array.isArray(e.tags) ? e.tags.map((t, j) => str(t, `${p}.tags[${j}]`)) : [];
    return {
      id,
      fase,
      tipo,
      nome: str(e.nome, `${p}.nome`),
      descricao: str(e.descricao, `${p}.descricao`),
      bpmInicial,
      bpmAlvo,
      duracaoMin: numOrNull(e.duracaoMin, `${p}.duracaoMin`),
      criterioSucesso: str(e.criterioSucesso, `${p}.criterioSucesso`),
      videos,
      tags,
      metrica: {
        tipo: m.tipo as MetricKind,
        ...(typeof m.unidade === "string" ? { unidade: m.unidade } : {}),
        ...(typeof m.alvo === "number" ? { alvo: m.alvo } : {}),
      },
    };
  });

  return {
    versao: typeof raw.versao === "number" ? raw.versao : 1,
    fases: parsedPhases,
    tipos: EXERCISE_TYPES,
    regraMetronomo: typeof raw.regraMetronomo === "string" ? raw.regraMetronomo : "",
    exercicios: parsed,
  };
}

export function exercisesByPhase(catalog: Catalog): Map<number, Exercise[]> {
  const map = new Map<number, Exercise[]>();
  for (const f of catalog.fases) map.set(f.id, []);
  for (const e of catalog.exercicios) map.get(e.fase)?.push(e);
  return map;
}

/** Extrai o ID de um link do YouTube (watch, youtu.be, embed ou shorts). */
export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    if (!u.hostname.endsWith("youtube.com")) return null;
    const v = u.searchParams.get("v");
    if (v) return v;
    const m = u.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{6,})/);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}
