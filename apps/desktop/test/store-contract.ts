import { shapesFor, defaultDrums, type PracticeEvent, type StoreBackend } from "@gx/core";
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
  const profile = { deviceId: "usb-a", channel: 1, bufferFrames: 128, sampleRate: 48000, inputMs: 5.4, source: "nativeTimestamp" as const, measuredAt: "2026-11-21T22:00:00Z" };
  await repo.saveSettings({ tuner: { inputProfiles: [profile] } });
  equal((await repo.getSettings()).tuner.inputProfiles, [profile], "perfil preservado");
  equal((await other.getSettings()).tuner.inputProfiles, [], "perfil restrito ao aparelho");
  await rejects(() => backend.request("apply", { events: [event("bad-profile", "2190-01-01T00:00:00Z", "settings.changed", [{ key: "device:device-a:tuner.inputProfiles", value: [{ ...profile, inputMs: -1 }] }])] }), "backend rejeita perfil inválido");
  await rejects(() => backend.request("apply", { events: [event("shared-profile", "2190-01-01T00:00:00Z", "settings.changed", [{ key: "tuner.inputProfiles", value: [profile] }])] }), "perfil não pode ser global");
  checks.push("perfis de entrada locais e validados");
  await repo.saveSettings({ routineSource: "custom" });
  equal((await repo.getSettings()).routineSource, "custom", "escolha da rotina própria");
  const routine = { id: "my-routine", name: "Minha rotina", blocks: [{ kind: "aquecimento" as const, minutes: 5, exerciseId: "f1-spider" }] };
  await repo.saveRoutine(routine); equal(await repo.getRoutine(routine.id), routine, "salva rotina");
  const routines = [event("routine-z", "2190-01-01T12:00:00Z", "routine.saved", { ...routine, name: "Nova" }),event("routine-a", "2189-01-01T12:00:00Z", "routine.saved", routine)];
  await repo.mergeEvents(routines); equal((await repo.getRoutine(routine.id))?.name, "Nova", "rotina usa última gravação"); checks.push("persistência e fusão de rotina");
  const song = { id: "song-1", title: "Música de teste", artist: "Artista", links: [], tracks: [], tags: ["reggae"], phase: 1 as const, bpm: { value: 90, origin: { kind: "usuario" as const } } };
  await repo.saveSong(song);
  await repo.mergeEvents([event("song-old", "2000-01-01T00:00:00Z", "song.saved", { ...song, title: "Antiga" }, "device-b")]);
  equal((await repo.listSongs()).map((s) => s.title), ["Música de teste"], "música usa última gravação");
  await rejects(() => repo.saveSong({ ...song, bpm: { value: 90 } } as never), "BPM sem origem é recusado");
  await rejects(() => backend.request("apply", { events: [event("bad-song", "2190-01-01T00:00:00Z", "song.saved", { ...song, key: { value: "Em7", origin: { kind: "usuario" } } })] }), "backend valida tom");
  await repo.savePlaylist({ id: "pl-1", name: "Treino", songIds: ["song-1"] });
  equal((await repo.listPlaylists())[0]?.songIds, ["song-1"], "playlist salva");
  checks.push("músicas e playlists");
  const r1 = await repo.reviseChart({ songId: "song-1", chordpro: "{title: Teste}\n[Em]linha\n", importedFrom: "colado" });
  const ra = await repo.reviseChart({ chartId: r1.chartId, songId: "song-1", chordpro: "[Em]a\n", importedFrom: "manual", parentRevision: r1.revision });
  await repo.mergeEvents([event("rev-b", "2190-01-02T00:00:00Z", "chart.revised", { ...ra, revision: "rev-b", chordpro: "[Em]b\n", createdAt: "2190-01-02T00:00:00Z" }, "device-b")]);
  equal((await repo.chartRevisions(r1.chartId)).map((r) => r.revision), [r1.revision, ra.revision, "rev-b"], "revisões guardadas em ordem");
  await rejects(() => backend.request("apply", { events: [event("rev-dup", "2190-01-03T00:00:00Z", "chart.revised", { ...ra, chordpro: "[Am]x\n" })] }), "revisão é imutável");
  checks.push("revisões de cifra imutáveis");
  const future = { version: 1 as const, id: "future-type", deviceId: "device-b", at: "2191-01-01T00:00:00Z", type: "future.saved", data: { opaque: [1, 2, 3] } };
  await repo.mergeEvents([event("known-before", "2190-01-01T00:00:00Z", "settings.changed", [{ key: "theme", value: "claro" }]), future, event("known-after", "2191-01-01T00:00:01Z", "settings.changed", [{ key: "theme", value: "escuro" }])]);
  await repo.mergeEvents([future]);
  equal((await repo.events()).filter((e) => e.id === future.id), [future], "evento futuro preservado sem duplicar");
  await rejects(() => repo.mergeEvents([{ ...future, data: { changed: true } }]), "ID futuro continua imutável");
  await rejects(() => repo.mergeEvents([{ ...future, id: "future-envelope", version: 2 } as never]), "versão incompatível rejeitada");
  const beforeInvalid = (await repo.events()).length;
  await rejects(() => backend.request("apply", { events: [{ ...future, id: "rollback-future" }, event("invalid-known", "2191-01-01T00:00:00Z", "playlist.saved", { id: "bad", name: "", songIds: [] })] }), "dados conhecidos inválidos rejeitam lote");
  equal((await repo.events()).length, beforeInvalid, "lote inválido não grava evento futuro");
  checks.push("eventos futuros preservados e conhecidos validados");
  const sequence = await repo.saveSequence({ id: "sequence-one", name: "Estudo", steps: [{ id: "step-one", diagram: shapesFor("C/E").shapes[0]!, beats: 2 }], bpm: 80, volume: .5, click: true, clickVolume: .4, drums: { ...defaultDrums, enabled: true } });
  equal((await repo.listSequences())[0]?.steps, sequence.steps, "forma exata persistida");
  await repo.mergeEvents([event("zz-sequence-new", sequence.updatedAt, "sequence.saved", { ...sequence, name: "Nova ordem" }), event("00-sequence-old", sequence.updatedAt, "sequence.saved", sequence)]);
  equal((await repo.listSequences())[0]?.name, "Nova ordem", "LWW com desempate estável");
  checks.push("sequência, mixer e fusão estável");
  const malformed = { ...sequence, steps: [{ ...sequence.steps[0], diagram: { name: "C", notes: [{ string: 1, fret: 25 }] } }] };
  await rejects(() => backend.request("apply", { events: [event("bad-sequence", sequence.updatedAt, "sequence.saved", malformed)] }), "backend recusa forma inválida");
  const temporary = await repo.saveSequence({ ...sequence, id: "sequence-temporary" });
  await repo.saveSequence({ ...temporary, deleted: true });
  equal((await repo.listSequences()).length, 1, "tombstone oculta sequência"); checks.push("validação e exclusão por evento de sequência");
  const close = (backend as StoreBackend & { close?: () => Promise<void> }).close;
  if (close) await close.call(backend);
  backend = await open(); repo = new PracticeRepository(backend, "device-a");
  equal((await repo.listLogs()).length, 5, "registros após reabrir");
  equal((await repo.getSettings()).theme, "escuro", "ajustes após reabrir");
  equal((await repo.getSettings()).tuner.inputProfiles, [profile], "perfil após reabrir");
  equal((await repo.getSettings()).routineSource, "custom", "rotina escolhida após reabrir");
  equal((await repo.getRoutine(routine.id))?.name, "Nova", "rotina após reabrir");
  equal((await repo.listSongs()).length, 1, "música após reabrir");
  equal((await repo.listSequences())[0]?.name, "Nova ordem", "sequência após reabrir");
  equal((await repo.events()).find((e) => e.id === future.id), future, "evento futuro após reabrir");
  equal((await repo.chartRevisions(r1.chartId)).length, 3, "cifra após reabrir"); checks.push("reabertura persistente");
  const pack = await repo.exportMusic();
  assert(pack.events.some((e) => e.type === "sequence.saved"), "pacote leva sequências");
  equal(pack.events.some((e) => e.type === "practice.added" || e.type === "settings.changed"), false, "exporta somente repertório");
  const beforeImport = (await repo.events()).length;
  await repo.importMusic(pack); await repo.importMusic(pack);
  equal((await repo.events()).length, beforeImport, "reimportar pacote não duplica eventos");
  equal((await repo.chartRevisions(r1.chartId)).length, 3, "reimportação preserva pontas concorrentes");
  const newSongEvent = event("package-new", "2199-01-01T00:00:00Z", "song.saved", { ...song, id: "package-rollback" });
  const conflictingRevision = event("package-conflict", "2199-01-01T00:00:00Z", "chart.revised", { ...ra, chordpro: "[D]Outra revisão\n" });
  await rejects(() => repo.importMusic({ ...pack, events: [newSongEvent, conflictingRevision] }), "importação em conflito rejeita lote inteiro");
  equal((await repo.listSongs()).length, 1, "importação não deixa música parcial");
  checks.push("pacote de repertório idempotente e atômico");
  const closeAgain = (backend as StoreBackend & { close?: () => Promise<void> }).close;
  if (closeAgain) await closeAgain.call(backend);
  return checks;
}
