import { useId, useRef, useState } from "react";
import type { Exercise, PracticeRecord } from "@gx/core";
import { usePractice } from "../lib/practice-state";
import { useMetronome } from "../lib/metronome";

export function PracticeForm({ exercise, initialBpm }: { exercise: Exercise; initialBpm?: number }) {
  const { addLog, counts, ready } = usePractice();
  const metro = useMetronome();
  const prefix = useId();
  const [value, setValue] = useState("");
  const [minutes, setMinutes] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const pending = useRef<PracticeRecord | null>(null);
  const lock = useRef(false);
  const metric = exercise.metrica;
  const labels = { bpm: "BPM atingido", contagem: metric.unidade ?? "Contagem", tempo: `Tempo (${metric.unidade ?? "s"})`, feito: "" };
  const bpm = initialBpm ?? metro.bpm;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setMessage("");
    try {
      const n = value === "" && metric.tipo === "bpm" ? bpm : Number(value);
      if (metric.tipo !== "feito" && ((!value && metric.tipo !== "bpm") || !Number.isFinite(n) || n <= 0 || (metric.tipo === "contagem" && !Number.isInteger(n)))) throw new Error("Informe um valor válido para a prática.");
      const duration = minutes === "" ? undefined : Number(minutes) * 60;
      if (duration !== undefined && (!Number.isFinite(duration) || duration <= 0)) throw new Error("Informe o tempo praticado em minutos.");
      pending.current ??= {
        id: crypto.randomUUID(), exerciseId: exercise.id, at: new Date().toISOString(), metric,
        ...(metric.tipo === "bpm" ? { bpm: n } : metric.tipo === "contagem" ? { count: n } : metric.tipo === "tempo" ? { seconds: n * (metric.unidade === "min" ? 60 : 1) } : {}),
        ...(duration !== undefined ? { durationSeconds: duration } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      };
      await addLog(pending.current);
      pending.current = null; setMessage("Prática registrada."); setNote(""); setMinutes("");
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { lock.current = false; setBusy(false); }
  };
  return <form className="practice-form" onSubmit={(e) => void submit(e)} aria-label={`Registrar ${exercise.nome}`}>
    <div className="panel-head"><h2>Registrar prática</h2><span className="spacer" /><span className="num muted small">{counts[exercise.id] ?? 0} práticas</span></div>
    {metric.tipo !== "feito" && <div className="field">
      <label htmlFor={`${prefix}-metric`}>{labels[metric.tipo]}</label>
      <input id={`${prefix}-metric`} type="number" min={metric.tipo === "bpm" ? 20 : metric.tipo === "contagem" ? 1 : 0.01} max={metric.tipo === "bpm" ? 400 : undefined} step={metric.tipo === "contagem" || metric.tipo === "bpm" ? 1 : "any"}
        placeholder={metric.tipo === "bpm" ? String(bpm) : ""} value={value} disabled={busy} onChange={(e) => { pending.current = null; setValue(e.target.value); }} />
    </div>}
    <div className="field"><label htmlFor={`${prefix}-minutes`}>Prática (min)</label><input id={`${prefix}-minutes`} type="number" min="0.01" step="any" placeholder="Opcional" value={minutes} disabled={busy} onChange={(e) => { pending.current = null; setMinutes(e.target.value); }} /></div>
    <div className="practice-note"><label htmlFor={`${prefix}-note`}>Nota opcional</label><textarea id={`${prefix}-note`} rows={2} value={note} disabled={busy} onChange={(e) => { pending.current = null; setNote(e.target.value); }} /></div>
    <button className="btn primary big" type="submit" disabled={!ready || busy}>{busy ? "Salvando…" : "Registrar prática"}</button>
    <p className={error ? "error-text small" : "muted small"} role={error ? "alert" : "status"}>{error || message || "O tempo é opcional. Informe só o que praticou."}</p>
  </form>;
}
