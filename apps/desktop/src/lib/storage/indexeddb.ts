import { validateStoredEvent, isKnownEvent, type StoredEvent, type PracticeEvent, type StoreBackend, type LogRange, type SettingChange, type PracticeRecord, type SavedRoutine, type ChartRevision } from "@gx/core";

const canonical = (value: unknown): string => JSON.stringify(value, (_, v) => v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : v);

type Row = { id?: string; key?: string; atMs: number; eventId: string; value: unknown };
const result = <T>(req: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
});
const done = (tx: IDBTransaction) => new Promise<void>((resolve, reject) => {
  tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error ?? new Error("Gravação cancelada.")); tx.onerror = () => reject(tx.error);
});
const newer = (e: PracticeEvent, old?: Row) => !old || Date.parse(e.at) > old.atMs || (Date.parse(e.at) === old.atMs && e.id > old.eventId);
const TABLES = ["events", "practice_logs", "routines", "settings", "sync_outbox", "songs", "playlists", "chart_revisions", "deferred_events", "sequences"];
async function project(tx: IDBTransaction, e: StoredEvent): Promise<boolean> {
  if (!isKnownEvent(e)) return false;
  const atMs = Date.parse(e.at);
  if (e.type === "practice.added") {
    const log = e.data as PracticeRecord;
    const store = tx.objectStore("practice_logs");
    const old = await result(store.get(log.id)) as Row | undefined;
    if (old && canonical(old.value) !== canonical(log)) throw new Error("ID de registro em conflito.");
    if (!old) store.add({ id: log.id, exerciseId: log.exerciseId, atMs: Date.parse(log.at), value: log });
  } else if (e.type === "routine.saved") {
    const routine = e.data as SavedRoutine;
    const store = tx.objectStore("routines");
    const old = await result(store.get(routine.id)) as Row | undefined;
    if (newer(e, old)) store.put({ id: routine.id, value: routine, atMs, eventId: e.id });
  } else if (e.type === "song.saved" || e.type === "playlist.saved" || e.type === "sequence.saved") {
    const item = e.data as { id: string };
    const store = tx.objectStore(e.type === "song.saved" ? "songs" : e.type === "sequence.saved" ? "sequences" : "playlists");
    const old = await result(store.get(item.id)) as Row | undefined;
    if (newer(e, old)) store.put({ id: item.id, value: item, atMs, eventId: e.id });
  } else if (e.type === "chart.revised") {
    const rev = e.data as ChartRevision;
    const store = tx.objectStore("chart_revisions");
    const old = await result(store.get(rev.revision)) as { value: ChartRevision } | undefined;
    if (old && canonical(old.value) !== canonical(rev)) throw new Error("Revisão de cifra em conflito.");
    if (!old) store.add({ revision: rev.revision, chartId: rev.chartId, createdAtMs: Date.parse(rev.createdAt), value: rev });
  } else if (e.type === "settings.changed") {
    const store = tx.objectStore("settings");
    for (const change of e.data as SettingChange[]) {
      const old = await result(store.get(change.key)) as Row | undefined;
      if (newer(e, old)) store.put({ ...change, atMs, eventId: e.id });
    }
  }
  return true;
}

export class IndexedDbBackend implements StoreBackend {
  private db: Promise<IDBDatabase>;
  constructor(name = "pratica.v1") {
    this.db = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(name, 4);
      req.onerror = () => reject(req.error);
      let blocked = false;
      req.onblocked = () => { blocked = true; reject(new Error("Feche as outras abas do Prática para atualizar os dados.")); };
      req.onupgradeneeded = (change) => {
        const db = req.result;
        if (change.oldVersion < 1) {
          const logs = db.createObjectStore("practice_logs", { keyPath: "id" });
          logs.createIndex("at_ms", "atMs"); logs.createIndex("exercise_at", ["exerciseId", "atMs"]);
          db.createObjectStore("routines", { keyPath: "id" });
          db.createObjectStore("settings", { keyPath: "key" });
          const events = db.createObjectStore("events", { keyPath: "id" });
          events.createIndex("device", "deviceId");
          db.createObjectStore("sync_outbox", { keyPath: "eventId" });
          db.createObjectStore("local_meta", { keyPath: "key" });
        }
        if (change.oldVersion < 2) {
          // v2: músicas, playlists e revisões de cifra. Só cria; nada é migrado.
          db.createObjectStore("songs", { keyPath: "id" });
          db.createObjectStore("playlists", { keyPath: "id" });
          db.createObjectStore("chart_revisions", { keyPath: "revision" }).createIndex("chart", "chartId");
        }
        if (change.oldVersion < 4) db.createObjectStore("sequences", { keyPath: "id" });
        if (change.oldVersion < 3) db.createObjectStore("deferred_events", { keyPath: "eventId" });
      };
      req.onsuccess = () => { if (blocked) { req.result.close(); return; } req.result.onversionchange = () => req.result.close(); resolve(req.result); };
    }).then(async (db) => {
      try {
        const tx = db.transaction(TABLES, "readwrite");
        const completion = done(tx);
        try {
          const rows = await result(tx.objectStore("deferred_events").getAll()) as { eventId: string }[];
          const events: StoredEvent[] = [];
          for (const row of rows) {
            const stored = await result(tx.objectStore("events").get(row.eventId));
            if (stored) { const { atMs: _, ...event } = stored; events.push(event); }
          }
          events.sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
          for (const e of events) {
            try { validateStoredEvent(e); } catch { continue; }
            if (await project(tx, e)) tx.objectStore("deferred_events").delete(e.id);
          }
        } catch (error) { tx.abort(); await completion.catch(() => {}); throw error; }
        await completion;
        return db;
      } catch (error) { db.close(); throw error; }
    });
  }
  async close() { (await this.db).close(); }
  async request(operation: string, data?: unknown): Promise<unknown> {
    const db = await this.db;
    const args = (data ?? {}) as Record<string, unknown>;
    if (operation === "apply") {
      const events = args.events as StoredEvent[];
      if (!Array.isArray(events)) throw new Error("Eventos inválidos.");
      events.forEach(validateStoredEvent);
      if (args.relayMusic === true && events.some((e) => !/^(song|playlist|chart|sequence)\./.test(e.type))) throw new Error("O pacote só pode conter eventos de repertório.");
      const tx = db.transaction(TABLES, "readwrite");
      const completion = done(tx);
      try {
        for (const e of events) {
          const previous = await result(tx.objectStore("events").get(e.id)) as StoredEvent | undefined;
          if (previous) {
            if (canonical(Object.fromEntries(Object.entries(previous).filter(([key]) => key !== "atMs"))) !== canonical(e)) throw new Error("ID de evento em conflito.");
            continue;
          }
          const atMs = Date.parse(e.at);
          if (!await project(tx, e)) tx.objectStore("deferred_events").add({ eventId: e.id });
          tx.objectStore("events").add({ ...e, atMs });
          tx.objectStore("sync_outbox").put({ eventId: e.id });
        }
      } catch (error) { try { tx.abort(); } catch {} await completion.catch(() => {}); throw error; }
      await completion; return null;
    }
    if (operation === "nextTimestamp") {
      const tx = db.transaction(["local_meta", "events"], "readwrite"); const completion = done(tx);
      const meta = tx.objectStore("local_meta");
      const reserved = await result(meta.get("eventClock")) as { value: number } | undefined;
      const events = await result(tx.objectStore("events").getAll()) as StoredEvent[];
      const latest = events.reduce((max, event) => Math.max(max, Date.parse(event.at)), 0);
      const time = Math.max(Date.now(), (reserved?.value ?? 0) + 1, latest + 1);
      meta.put({ key: "eventClock", value: time }); await completion; return time;
    }
    if (operation === "deviceId") {
      const tx = db.transaction("local_meta", "readwrite"); const completion = done(tx);
      const store = tx.objectStore("local_meta");
      const old = await result(store.get("deviceId")) as { value: string } | undefined;
      const id = old?.value ?? crypto.randomUUID();
      if (!old) store.put({ key: "deviceId", value: id });
      await completion; return id;
    }
    if (operation === "metaGet" || operation === "metaSet") {
      const tx = db.transaction("local_meta", operation === "metaSet" ? "readwrite" : "readonly"); const completion = done(tx);
      const store = tx.objectStore("local_meta");
      if (operation === "metaSet") { store.put(args); await completion; return null; }
      const row = await result(store.get(args.key as string)); await completion; return row?.value ?? null;
    }
    if (operation === "listSongs" || operation === "listPlaylists" || operation === "listSequences") {
      const tx = db.transaction(operation === "listSongs" ? "songs" : operation === "listSequences" ? "sequences" : "playlists", "readonly"); const completion = done(tx);
      const rows = await result(tx.objectStore(operation === "listSongs" ? "songs" : operation === "listSequences" ? "sequences" : "playlists").getAll()) as Row[]; await completion;
      return rows.map((row) => row.value);
    }
    if (operation === "chartRevisions") {
      const tx = db.transaction("chart_revisions", "readonly"); const completion = done(tx);
      const rows = await result(tx.objectStore("chart_revisions").index("chart").getAll(args.chartId as string)) as { createdAtMs: number; revision: string; value: ChartRevision }[]; await completion;
      return rows.sort((a, b) => a.createdAtMs - b.createdAtMs || (a.revision < b.revision ? -1 : 1)).map((row) => row.value);
    }
    const table = operation === "events" ? "events" : operation === "getRoutine" ? "routines" : operation === "getSettings" ? "settings" : "practice_logs";
    const tx = db.transaction(table, "readonly"); const completion = done(tx);
    const store = tx.objectStore(table);
    if (operation === "getRoutine") {
      const row = await result(store.get(args.id as string)) as Row | undefined; await completion; return row?.value ?? null;
    }
    const rows = await result(store.getAll()); await completion;
    if (operation === "events") return rows.map(({ atMs: _, ...event }) => event).sort((a: StoredEvent, b: StoredEvent) => Date.parse(a.at) - Date.parse(b.at) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    if (operation === "getSettings") return rows.map(({ key, value }: Row) => ({ key, value }));
    if (operation === "countByExercise") {
      const counts: Record<string, number> = {};
      for (const row of rows) counts[row.exerciseId] = (counts[row.exerciseId] ?? 0) + 1;
      return counts;
    }
    if (operation !== "listLogs") throw new Error("Operação desconhecida.");
    const range = args as LogRange;
    return rows.filter((row) => (!range.from || row.atMs >= Date.parse(range.from)) && (!range.to || row.atMs < Date.parse(range.to)) && (!range.exerciseId || row.exerciseId === range.exerciseId))
      .sort((a, b) => a.atMs - b.atMs || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).map((row) => row.value);
  }
}
