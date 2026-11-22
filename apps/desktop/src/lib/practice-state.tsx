import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PERSONAL_ROUTINE_ID, type SavedRoutine, type PracticeRecord, type PracticeStore } from "@gx/core";
import { useApp } from "./app-state";
import { openPracticeStore, syncPractice, type SyncStatus } from "./storage";

interface PracticeState {
  store: PracticeStore | null;
  logs: PracticeRecord[];
  counts: Record<string, number>;
  routine: SavedRoutine | null;
  routineSaving: boolean;
  routineSaveError: string | null;
  routineDraft: SavedRoutine | null;
  setRoutineDraft: (routine: SavedRoutine | null) => void;
  saveRoutine: (routine: SavedRoutine) => Promise<void>;
  ready: boolean;
  error: string | null;
  sync: SyncStatus | null;
  refresh: () => Promise<void>;
  addLog: (log: PracticeRecord) => Promise<void>;
}
const Context = createContext<PracticeState | null>(null);
export function PracticeProvider({ children }: { children: ReactNode }) {
  const { update } = useApp();
  const [routineSaving, setRoutineSaving] = useState(false);
  const [routineSaveError, setRoutineSaveError] = useState<string | null>(null);
  const routineLock = useRef(false);
  const [store, setStore] = useState<PracticeStore | null>(null);
  const [logs, setLogs] = useState<PracticeRecord[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [routineDraft, setRoutineDraft] = useState<SavedRoutine | null>(null);
  const [routine, setRoutine] = useState<SavedRoutine | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const current = useRef<PracticeStore | null>(null);
  const refreshing = useRef(0);
  const refresh = useCallback(async () => {
    const active = current.current; if (!active) return;
    const generation = ++refreshing.current;
    const [history, totals, savedRoutine] = await Promise.all([active.listLogs(), active.countByExercise(), active.getRoutine(PERSONAL_ROUTINE_ID)]);
    if (generation !== refreshing.current) return;
    setLogs(history); setCounts(totals); setRoutine(savedRoutine);
  }, []);
  useEffect(() => {
    let active = true; let syncing = false;
    const synchronize = async () => {
      if (syncing || !current.current) return;
      syncing = true;
      try {
        const status = await syncPractice();
        if (active) {
          setSync(status); await refresh();
          window.dispatchEvent(new Event("practice-synced"));
        }
      } catch (e) { if (active) setSync({ state: "error", message: `Sincronização pendente: ${String(e)}` }); }
      finally { syncing = false; }
    };
    void openPracticeStore().then(async (repository) => {
      if (!active) return;
      current.current = repository; setStore(repository);
      await refresh();
      if (active) { setReady(true); void synchronize(); }
    }).catch((e) => { if (active) setError(`Não foi possível abrir seus dados. Reabra o app para tentar de novo. ${String(e)}`); });
    const timer = window.setInterval(() => void synchronize(), 15_000);
    const focus = () => void synchronize();
    window.addEventListener("focus", focus);
    window.addEventListener("practice-written", focus);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("focus", focus); window.removeEventListener("practice-written", focus); };
  }, [refresh]);
  const addLog = useCallback(async (log: PracticeRecord) => {
    if (!current.current) throw new Error("Os dados ainda estão carregando.");
    await current.current.addLog(log);
    await refresh();
    window.dispatchEvent(new Event("practice-written"));
  }, [refresh]);
  const saveRoutine = useCallback(async (next: SavedRoutine) => {
    if (!current.current) throw new Error("Os dados ainda estão carregando.");
    if (routineLock.current) throw new Error("Aguarde a rotina terminar de salvar.");
    routineLock.current = true; setRoutineSaving(true); setRoutineSaveError(null);
    try {
      await current.current.saveRoutine(next);
      await refresh();
      if (!(await update({ routineSource: "custom" }))) throw new Error("A rotina foi salva, mas não foi possível ativá-la. Tente salvar novamente.");
      window.dispatchEvent(new Event("practice-written"));
    } catch (error) {
      setRoutineSaveError(error instanceof Error ? error.message : String(error));
      throw error;
    } finally { routineLock.current = false; setRoutineSaving(false); }
  }, [refresh, update]);
  const value = useMemo(() => ({ store, logs, counts, routine, routineSaving, routineSaveError, routineDraft, setRoutineDraft, saveRoutine, ready, error, sync, refresh, addLog }), [store, logs, counts, routine, routineSaving, routineSaveError, routineDraft, setRoutineDraft, saveRoutine, ready, error, sync, refresh, addLog]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function usePractice() {
  const state = useContext(Context); if (!state) throw new Error("usePractice fora do provider"); return state;
}
