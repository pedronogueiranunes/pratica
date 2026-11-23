import { useCallback, useEffect, useState, type SetStateAction } from "react";
import { defaultDrums, type SequenceDraft } from "@gx/core";
import { usePractice } from "./practice-state";
import { useApp } from "./app-state";
import { useMetronome } from "./metronome";

let session: SequenceDraft | null = null;
let revision = 0, hydrated = false;
export function useSequenceDraft() {
  const { store } = usePractice(); const { settings, update } = useApp(); const m = useMetronome();
  const [draft, setLocal] = useState<SequenceDraft>(() => session ??= { id: crypto.randomUUID(), name: "Minha sequência", steps: [], bpm: m.bpm, volume: .5, click: true, clickVolume: settings.metronome.volume, drums: { ...defaultDrums } });
  const [error, setError] = useState<string | null>(null);
  const setDraft = useCallback((next: SetStateAction<SequenceDraft>) => {
    const value = typeof next === "function" ? next(session!) : next;
    session = value; revision++; setLocal(value);
  }, []);
  useEffect(() => {
    if (!store || hydrated) return;
    let active = true; const before = revision;
    void store.listSequences().then((saved) => {
      if (!active) return;
      hydrated = true;
      if (before !== revision || !saved[0]) return;
      const latest = saved[0]; setDraft(structuredClone(latest)); m.setBpm(latest.bpm);
      if (settings.metronome.volume !== latest.clickVolume) void update({ metronome: { volume: latest.clickVolume } });
    }).catch((e) => { if (active) setError(`Não deu para recuperar as sequências. ${String(e)}`); });
    return () => { active = false; };
  }, [store]);
  return { draft, setDraft, error };
}
