import { useId, useRef, useState } from "react";
import { BLOCK_KINDS, blockForExercise, moveRoutineBlock, removeRoutineBlock, routineMinutes,
  updateRoutineBlock, validatePersonalRoutine, type RoutineBlock, type SavedRoutine } from "@gx/core";
import { useApp } from "../lib/app-state";
import { usePractice } from "../lib/practice-state";
import { IconPlus } from "../icons";

export function RoutineEditor({ initial, onChange, onCancel, onSave }: {
  initial: SavedRoutine;
  onChange: (routine: SavedRoutine) => void;
  onCancel: () => void;
  onSave: (routine: SavedRoutine) => Promise<void>;
}) {
  const { catalog, t } = useApp();
  const { routineSaving, routineSaveError } = usePractice();
  const prefix = useId();
  // O rascunho fica acima das rotas, para sobreviver à navegação.
  const name = initial.name;
  const blocks = initial.blocks;
  const setName = (name: string) => onChange({ ...initial, name });
  const setBlocks = (edit: (blocks: RoutineBlock[]) => RoutineBlock[]) => onChange({ ...initial, blocks: edit(blocks) });
  const [keys, setKeys] = useState(() => initial.blocks.map(() => crypto.randomUUID()));
  const [addId, setAddId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const lock = useRef(false);
  const setBlock = (index: number, patch: Partial<RoutineBlock>) => setBlocks((previous) => updateRoutineBlock(previous, index, patch));
  const move = (from: number, to: number) => {
    setBlocks((previous) => moveRoutineBlock(previous, from, to));
    const key = keys[from]!;
    setKeys((previous) => {
      const next = [...previous]; next.splice(from, 1); next.splice(to, 0, key); return next;
    });
    setAnnouncement(`Bloco movido para a posição ${to + 1}.`);
    requestAnimationFrame(() => document.getElementById(`${prefix}-${key}-exercise`)?.focus());
  };
  const remove = (index: number) => {
    const nextKey = keys[index + 1] ?? keys[index - 1];
    setBlocks((previous) => removeRoutineBlock(previous, index));
    setKeys((previous) => previous.filter((_, i) => i !== index));
    setAnnouncement(`Bloco ${index + 1} removido.`);
    requestAnimationFrame(() => document.getElementById(nextKey ? `${prefix}-${nextKey}-exercise` : `${prefix}-add`)?.focus());
  };
  const add = () => {
    const exercise = catalog.exercicios.find((item) => item.id === addId); if (!exercise) return;
    const key = crypto.randomUUID();
    setBlocks((previous) => [...previous, blockForExercise(exercise)]);
    setKeys((previous) => [...previous, key]); setAddId("");
    setAnnouncement(`${exercise.nome} adicionado.`);
    requestAnimationFrame(() => document.getElementById(`${prefix}-${key}-exercise`)?.focus());
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (lock.current || routineSaving) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const routine = { id: initial.id, name: name.trim(), blocks };
      validatePersonalRoutine(routine, catalog);
      await onSave(routine);
    } catch (error) { setError(error instanceof Error ? error.message : String(error)); }
    finally { lock.current = false; setBusy(false); }
  };

  return <form className="routine-editor" onSubmit={(event) => void save(event)} aria-label="Editar rotina">
    <fieldset disabled={busy || routineSaving}>
      <legend>Editar rotina</legend>
      <div className="routine-name">
        <label htmlFor={`${prefix}-name`}>Nome da rotina</label>
        <input id={`${prefix}-name`} type="text" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      <ol className="routine-blocks">
        {blocks.map((block, index) => {
          const key = keys[index]!;
          const exercise = catalog.exercicios.find((item) => item.id === block.exerciseId);
          const label = exercise?.nome ?? `Bloco ${index + 1}`;
          return <li key={key} className="routine-block">
            <div className="routine-block-head"><h3>Bloco {index + 1}</h3>
              <div className="practice-actions">
                <button type="button" className="btn icon small-icon" disabled={index === 0} aria-label={`Mover ${label} para cima`} onClick={() => move(index, index - 1)}><Arrow up /></button>
                <button type="button" className="btn icon small-icon" disabled={index === blocks.length - 1} aria-label={`Mover ${label} para baixo`} onClick={() => move(index, index + 1)}><Arrow /></button>
                <button type="button" className="btn ghost" aria-label={`Remover ${label}`} onClick={() => remove(index)}>Remover</button>
              </div>
            </div>
            <div className="routine-block-fields">
              <label className="routine-exercise">Exercício
                <select id={`${prefix}-${key}-exercise`} value={block.exerciseId ?? ""} required onChange={(event) => setBlock(index, { exerciseId: event.target.value })}>
                  {!exercise && <option value={block.exerciseId ?? ""} disabled>Escolha um exercício</option>}
                  <ExerciseOptions />
                </select>
              </label>
              <label>Bloco
                <select value={block.kind} onChange={(event) => setBlock(index, { kind: event.target.value as RoutineBlock["kind"] })}>
                  {BLOCK_KINDS.map((kind) => <option key={kind} value={kind}>{t(`block.${kind}`)}</option>)}
                </select>
              </label>
              <label>Minutos
                <input type="number" min="0.01" step="any" required value={Number.isFinite(block.minutes) ? block.minutes : ""} onChange={(event) => setBlock(index, { minutes: event.target.value === "" ? NaN : Number(event.target.value) })} />
              </label>
            </div>
          </li>;
        })}
      </ol>
      {!blocks.length && <p className="muted">Adicione um exercício para começar sua rotina.</p>}
      <div className="routine-add">
        <label htmlFor={`${prefix}-add`}>Adicionar exercício</label>
        <div className="routine-add-controls">
          <select id={`${prefix}-add`} value={addId} onChange={(event) => setAddId(event.target.value)}><option value="">Escolha um exercício</option><ExerciseOptions /></select>
          <button className="btn" type="button" disabled={!addId} onClick={add}><IconPlus />Adicionar</button>
        </div>
      </div>
      <div className="routine-editor-foot">
        <span className="num muted small">{blocks.length} blocos · {blocks.every((block) => Number.isFinite(block.minutes) && block.minutes > 0) ? routineMinutes(blocks) : "…"} min planejados</span>
        <div className="practice-actions">
          <button className="btn" type="button" onClick={onCancel}>Cancelar</button>
          <button className="btn primary" type="submit" disabled={!blocks.length}>{busy || routineSaving ? "Salvando…" : "Salvar rotina"}</button>
        </div>
      </div>
    </fieldset>
    {(error || routineSaveError) && <p className="error-text small" role="alert">{error || routineSaveError}</p>}
    <p className="sr-only" role="status">{announcement}</p>
  </form>;
}
function ExerciseOptions() {
  const { catalog } = useApp();
  return <>{catalog.fases.map((phase) => <optgroup key={phase.id} label={phase.id >= 1 && phase.id <= 4 ? `Fase ${phase.id}: ${phase.nome}` : phase.nome}>
    {catalog.exercicios.filter((exercise) => exercise.fase === phase.id).map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.nome}</option>)}
  </optgroup>)}</>;
}
function Arrow({ up = false }: { up?: boolean }) {
  return <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={up ? "M10 15V5m-4 4 4-4 4 4" : "M10 5v10m-4-4 4 4 4-4"} /></svg>;
}
