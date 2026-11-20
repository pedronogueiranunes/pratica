// Acrescenta o campo `metrica` a cada exercício do seed, sem tocar no resto.
// Regra: quem tem bpmAlvo mede BPM. Os demais seguem a tabela abaixo, tirada
// dos critérios de sucesso de cada um. O que não estiver na tabela é "feito".
// Uso: node scripts/add-metrics.mjs  (pode rodar de novo: é idempotente)
import { readFileSync, writeFileSync } from "node:fs";

const path = new URL("../data/exercises.seed.json", import.meta.url);
const seed = JSON.parse(readFileSync(path, "utf8"));

const overrides = {
  "f1-troca-acordes": { tipo: "contagem", unidade: "trocas/min", alvo: 30 },
  "f1-duas-musicas": { tipo: "contagem", unidade: "músicas", alvo: 2 },
  "f2-quatro-musicas": { tipo: "contagem", unidade: "músicas", alvo: 4 },
  "f3-seis-musicas": { tipo: "contagem", unidade: "músicas", alvo: 6 },
  "f2-pestana": { tipo: "tempo", unidade: "s", alvo: 10 },
  "f3-improviso-pentatonica": { tipo: "tempo", unidade: "min", alvo: 1 },
  "dnb-skank-sobre-loop": { tipo: "tempo", unidade: "min", alvo: 2 },
};

let changed = 0;
for (const ex of seed.exercicios) {
  const metrica = overrides[ex.id] ?? (ex.bpmAlvo != null ? { tipo: "bpm" } : { tipo: "feito" });
  if (JSON.stringify(ex.metrica) !== JSON.stringify(metrica)) changed++;
  ex.metrica = metrica;
}
seed.tiposMetrica = ["bpm", "contagem", "tempo", "feito"];
writeFileSync(path, JSON.stringify(seed, null, 2) + "\n");
console.log(`metrica: ${changed} exercícios atualizados de ${seed.exercicios.length}`);
