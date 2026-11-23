import { IndexedDbBackend } from "../src/lib/storage/indexeddb";
const req = <T>(r: IDBRequest<T>) => new Promise<T>((ok, fail) => { r.onsuccess = () => ok(r.result); r.onerror = () => fail(r.error); });
const commit = (tx: IDBTransaction) => new Promise<void>((ok, fail) => { tx.oncomplete = () => ok(); tx.onabort = () => fail(tx.error); });
export async function indexedDbMigration() {
  const name = `pratica-migration-${crypto.randomUUID()}`;
  let backend: IndexedDbBackend | undefined;
  try {
    const opening = indexedDB.open(name, 2);
    opening.onupgradeneeded = () => {
      const db = opening.result;
      const logs = db.createObjectStore("practice_logs", { keyPath: "id" });
      logs.createIndex("at_ms", "atMs"); logs.createIndex("exercise_at", ["exerciseId", "atMs"]);
      for (const table of ["events", "routines", "songs", "playlists"]) db.createObjectStore(table, { keyPath: "id" });
      for (const table of ["settings", "local_meta"]) db.createObjectStore(table, { keyPath: "key" });
      db.createObjectStore("sync_outbox", { keyPath: "eventId" });
      db.createObjectStore("chart_revisions", { keyPath: "revision" }).createIndex("chart", "chartId");
    };
    let db = await req(opening);
    let tx = db.transaction("practice_logs", "readwrite"); let done = commit(tx);
    tx.objectStore("practice_logs").put({ id: "old", exerciseId: "spider", atMs: 1, value: { id: "old", exerciseId: "spider", at: "2026-01-01T00:00:00Z" } });
    await done; db.close();
    backend = new IndexedDbBackend(name);
    const before = await backend.request("listLogs") as unknown[];
    if (before.length !== 1) throw new Error("Migração perdeu prática v2.");
    await backend.close(); backend = undefined;
    db = await req(indexedDB.open(name, 4));
    tx = db.transaction(["events", "deferred_events"], "readwrite"); done = commit(tx);
    const event = { version: 1, id: "replay", deviceId: "older-device", at: "2026-01-02T00:00:00Z", type: "playlist.saved", data: { id: "replayed", name: "Treino", songIds: [] } };
    tx.objectStore("events").put({ ...event, atMs: Date.parse(event.at) });
    tx.objectStore("deferred_events").put({ eventId: event.id });
    const sequence = { version: 1, id: "sequence-replay", deviceId: "older-device", at: event.at, type: "sequence.saved", data: { id: "seq-replayed", name: "Bateria recuperada", steps: [], bpm: 90, volume: .5, click: false, clickVolume: .4, drums: { enabled: true, pattern: "rock", volume: .3 }, updatedAt: event.at } };
    tx.objectStore("events").put({ ...sequence, atMs: Date.parse(sequence.at) });
    tx.objectStore("deferred_events").put({ eventId: sequence.id });
    await done; db.close();
    backend = new IndexedDbBackend(name);
    const lists = await backend.request("listPlaylists") as { id: string }[];
    if (lists[0]?.id !== "replayed") throw new Error("Evento conhecido não foi reprojetado ao abrir.");
    const sequences = await backend.request("listSequences") as { id: string }[];
    if (sequences[0]?.id !== "seq-replayed") throw new Error("Sequência pendente não foi reprojetada.");
    await backend.close(); backend = undefined;
    db = await req(indexedDB.open(name, 4));
    const count = await req(db.transaction("deferred_events").objectStore("deferred_events").count());
    db.close();
    if (count !== 0) throw new Error("Evento projetado continuou pendente.");
    return "migração IndexedDB v2→v4 e reprojeção ao abrir";
  } finally { await backend?.close(); await req(indexedDB.deleteDatabase(name)); }
}
