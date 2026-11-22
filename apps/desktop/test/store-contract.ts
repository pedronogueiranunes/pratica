import type { PracticeEvent, StoreBackend } from "@gx/core";
import { PracticeRepository } from "../src/lib/storage/repository";

type Open = () => Promise<StoreBackend>;
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
const canonical = (value: unknown) => JSON.stringify(value, (_, v) => v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);
function equal(a: unknown, b: unknown, message: string) { assert(canonical(a) === canonical(b), `${message}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); }
async function rejects(action: () => Promise<unknown>, message: string) {
  let rejected = false; try { await action(); } catch { rejected = true; } assert(rejected, message);
}
const event = (id: string, at: string, type: PracticeEvent["type"], data: unknown, deviceId = "device-a"): PracticeEvent => ({ version: 1, id, deviceId, at, type, data });

/** A mesma bateria roda no IndexedDB real e no SQLite real, sem mocks de SQL. */
export async function storeContract(open: Open) {
  let backend = await open();
  let repo = new PracticeRepository(backend, "device-a");
  const checks: string[] = [];
  equal((await repo.getSettings()).theme, "sistema", "ajustes padrão");
  equal(await repo.getRoutine("missing"), null, "rotina inexistente");
  const first = { id: "log-1", exerciseId: "f1-spider", at: "2026-11-20T00:00:00-03:00", bpm: 60, durationSeconds: 120, note: "Sem tensão" };
  await repo.addLog(first); await repo.addLog(first);
  await repo.addLog({ id: "log-2", exerciseId: "f1-spider", at: "2026-11-21T00:00:00-03:00", bpm: 64 });
  await repo.addLog({ id: "log-3", exerciseId: "f1-troca-acordes", at: "2026-11-20T13:00:00Z", count: 25 });
  await repo.addLog({ id: "log-4", exerciseId: "f2-skank", at: "2026-11-20T14:00:00Z", seconds: 90 });
  await repo.addLog({ id: "log-5", exerciseId: "f1-notas", at: "2026-11-20T15:00:00Z" });
  equal(await repo.countByExercise(), { "f1-notas": 1, "f1-spider": 2, "f1-troca-acordes": 1, "f2-skank": 1 }, "contagem e idempotência");
  checks.push("métricas e IDs idempotentes");
  const range = await repo.listLogs({ from: first.at, to: "2026-11-21T00:00:00-03:00", exerciseId: "f1-spider" });
  equal(range.length, 1, "intervalo semiaberto com fuso");
  equal(range[0]?.note, "Sem tensão", "nota livre"); checks.push("intervalos e fuso");
  const exported = await repo.events();
  await repo.mergeEvents(exported);
  equal((await repo.listLogs()).length, 5, "reimportação"); checks.push("reimportação sem duplicação");
  await rejects(() => repo.addLog({ ...first, bpm: 80 }), "não sobrescreve prática imutável");
  equal((await repo.listLogs({ exerciseId: "f1-spider" }))[0]?.bpm, 60, "preserva original");
  await rejects(() => repo.addLog({ ...first, id: "negative", count: -1 }), "rejeita contagem negativa");
  await rejects(() => repo.addLog({ ...first, id: "bad-date", at: "ontem" }), "rejeita data inválida");
  await rejects(() => repo.saveSettings({ metronome: { volume: 3 } }), "valida ajustes");
  checks.push("validação e imutabilidade");
  // Testa o backend diretamente para provar rollback, sem depender da validação TS.
  const eventsBefore = (await repo.events()).length;
  await rejects(() => backend.request("apply", { events: [
    event("atomic-new", "2026-11-22T12:00:00Z", "practice.added", { ...first, id: "atomic" }),
    event("atomic-conflict", "2026-11-22T12:00:00Z", "practice.added", { ...first, bpm: 80 }),
  ] }), "transação deve falhar inteira");
  equal((await repo.events()).length, eventsBefore, "rollback do evento");
  equal((await repo.listLogs()).length, 5, "rollback do estado"); checks.push("estado e eventos atômicos");
  const changes = [
    event("theme-z", "2027-01-01T12:00:00Z", "settings.changed", [{ key: "theme", value: "escuro" }]),
    event("theme-a", "2027-01-01T12:00:00Z", "settings.changed", [{ key: "theme", value: "claro" }]),
    event("theme-old", "2026-12-31T12:00:00Z", "settings.changed", [{ key: "theme", value: "sistema" }]),
  ];
  await repo.mergeEvents(changes); await repo.mergeEvents([...changes].reverse());
  equal((await repo.getSettings()).theme, "escuro", "desempate determinístico");
  await repo.saveSettings({ metronome: { volume: 0.4 } });
  equal((await repo.getSettings()).metronome.sound, "madeira", "patch preserva outros campos");
  checks.push("última gravação por chave e desempate");
  // Importação nativa pode acontecer fora da instância TS e deve avançar o relógio.
  await backend.request("apply", { events: [event("future-native", "2090-01-01T12:00:00Z", "settings.changed", [{ key: "dedication", value: "alta" }])] });
  const fresh = new PracticeRepository(backend, "device-a");
  await fresh.saveSettings({ dedication: "baixa" });
  equal((await fresh.getSettings()).dedication, "baixa", "gravação local posterior vence relógio remoto adiantado");
  checks.push("relógio persistente após importação nativa");
  await repo.saveSettings({ tuner: { inputDeviceId: "usb-a", inputChannel: 1 } });
  const other = new PracticeRepository(backend, "device-b");
  equal((await other.getSettings()).tuner.inputDeviceId, undefined, "dispositivo não vaza entre aparelhos");
  equal((await repo.getSettings()).tuner.inputDeviceId, "usb-a", "seleção local preservada"); checks.push("ajustes de áudio locais");
  await repo.saveSettings({ routineSource: "custom" });
  equal((await repo.getSettings()).routineSource, "custom", "escolha da rotina própria");
  const routine = { id: "my-routine", name: "Minha rotina", blocks: [{ kind: "aquecimento" as const, minutes: 5, exerciseId: "f1-spider" }] };
  await repo.saveRoutine(routine); equal(await repo.getRoutine(routine.id), routine, "salva rotina");
  const routines = [event("routine-z", "2190-01-01T12:00:00Z", "routine.saved", { ...routine, name: "Nova" }),event("routine-a", "2189-01-01T12:00:00Z", "routine.saved", routine)];
  await repo.mergeEvents(routines); equal((await repo.getRoutine(routine.id))?.name, "Nova", "rotina usa última gravação"); checks.push("persistência e fusão de rotina");
  const close = (backend as StoreBackend & { close?: () => Promise<void> }).close;
  if (close) await close.call(backend);
  backend = await open(); repo = new PracticeRepository(backend, "device-a");
  equal((await repo.listLogs()).length, 5, "registros após reabrir");
  equal((await repo.getSettings()).theme, "escuro", "ajustes após reabrir");
  equal((await repo.getSettings()).routineSource, "custom", "rotina escolhida após reabrir");
  equal((await repo.getRoutine(routine.id))?.name, "Nova", "rotina após reabrir"); checks.push("reabertura persistente");
  const closeAgain = (backend as StoreBackend & { close?: () => Promise<void> }).close;
  if (closeAgain) await closeAgain.call(backend);
  return checks;
}
