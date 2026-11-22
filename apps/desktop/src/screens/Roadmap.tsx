import { useEffect, useMemo, useState } from "react";
import { filterRoadmap, hasVisual, practicedExerciseCount, type Exercise, type ExerciseType, type Phase } from "@gx/core";
import { useApp } from "../lib/app-state";
import { useNav } from "../lib/nav";
import { usePractice } from "../lib/practice-state";

type View = "timeline" | "fases" | "lista" | "grid";
const VIEWS: View[] = ["lista", "grid", "fases", "timeline"];
const LABELS: Record<View, string> = { timeline: "Timeline", fases: "Fases", lista: "Lista", grid: "Grade" };
function initialView(): View {
  try { const saved = localStorage.getItem("pratica.roadmap.view"); return VIEWS.includes(saved as View) ? saved as View : "lista"; }
  catch { return "lista"; }
}
const shortPhase = (p: Phase) => (p.id === 0 ? "Rotina" : p.id <= 4 ? `Fase ${p.id}` : "Depois");
const phaseLabel = (p: Phase) => (p.id >= 1 && p.id <= 4 ? `Fase ${p.id}: ${p.nome}` : p.nome);

export function Roadmap() {
  const { t, catalog, settings } = useApp();
  const { counts, ready } = usePractice();
  const [view, setView] = useState<View>(initialView);
  const [phase, setPhase] = useState<number | "all">("all");
  const [type, setType] = useState<ExerciseType | "all">("all");
  const [expanded, setExpanded] = useState(() => new Set([0, settings.currentPhase]));
  useEffect(() => setExpanded((previous) => new Set([...previous, settings.currentPhase])), [settings.currentPhase]);
  const exercises = useMemo(() => filterRoadmap(catalog, { phase, type }), [catalog, phase, type]);
  const groups = useMemo(() => catalog.fases.map((item) => ({ phase: item, exercises: exercises.filter((e) => e.fase === item.id) })).filter((group) => group.exercises.length), [catalog, exercises]);
  const selectView = (next: View) => { setView(next); try { localStorage.setItem("pratica.roadmap.view", next); } catch {} };
  const clear = () => { setPhase("all"); setType("all"); };
  const togglePhase = (id: number) => setExpanded((previous) => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  return <div className="screen roadmap-screen">
    <header className="screen-head">
      <h1>{t("nav.roadmap")}</h1>
      <span className="sub">Você escolhe quando avançar.</span>
    </header>

    <nav className="phase-rail" aria-label="Fases do roadmap">
      {catalog.fases.map((p) => {
        const all = catalog.exercicios.filter((e) => e.fase === p.id);
        if (!all.length) return null;
        const done = ready ? practicedExerciseCount(all, counts) : 0;
        const current = p.id === settings.currentPhase;
        return <button key={p.id} className={`phase-stop${current ? " current" : ""}`} aria-pressed={phase === p.id} onClick={() => setPhase(phase === p.id ? "all" : p.id)}
          aria-label={`${phaseLabel(p)}, ${p.periodo}. ${done} de ${all.length} exercícios com prática.${current ? " Fase atual." : ""}`}>
          <span className="phase-stop-top"><span className="num">{shortPhase(p)}</span>{current && <span className="phase-stop-now">atual</span>}</span>
          <span className="phase-stop-name">{p.nome}</span>
          <span className="phase-stop-period">{p.periodo}</span>
          <span className="phase-stop-squares" aria-hidden="true">
            {all.map((e) => <i key={e.id} className={ready && (counts[e.id] ?? 0) > 0 ? "on" : ""} />)}
          </span>
          <span className="phase-stop-count num" aria-hidden="true">{ready ? `${done} de ${all.length}` : "…"}</span>
        </button>;
      })}
    </nav>

    <div className="roadmap-toolbar">
      <div className="seg roadmap-views" role="group" aria-label="Visão do Roadmap">
        {VIEWS.map((item) => <button key={item} aria-pressed={view === item} onClick={() => selectView(item)}>{LABELS[item]}</button>)}
      </div>
      <select aria-label="Tipo de exercício" value={type} onChange={(event) => setType(event.target.value as ExerciseType | "all")}>
        <option value="all">Todos os tipos</option>
        {catalog.tipos.map((item) => <option key={item} value={item}>{t(`type.${item}`)}</option>)}
      </select>
      <p className="muted small roadmap-results" role="status">
        {phase !== "all" || type !== "all" ? `${exercises.length} de ${catalog.exercicios.length} exercícios` : `${catalog.exercicios.length} exercícios`}
        {ready ? ` · ${practicedExerciseCount(exercises, counts)} com prática` : ""}
      </p>
      {(phase !== "all" || type !== "all") && <button className="btn ghost" onClick={clear}>Mostrar tudo</button>}
    </div>

    {!exercises.length && <div className="empty"><div><h2>Nenhum exercício com esses filtros</h2><p>Escolha outra fase ou outro tipo.</p><button className="btn" onClick={clear}>Mostrar tudo</button></div></div>}

    {view === "lista" && exercises.length > 0 && <div className="rm-table" role="table" aria-label="Exercícios">
      <div className="rm-row rm-head" role="row">
        <span role="columnheader">Exercício</span><span role="columnheader">Tipo</span><span role="columnheader">Meta</span><span role="columnheader" className="rm-count">Práticas</span>
      </div>
      {groups.map((group) => <div key={group.phase.id} role="rowgroup">
        {phase === "all" && <div className="rm-group" role="row"><span role="cell">{phaseLabel(group.phase)}<span className="muted"> · {group.phase.periodo}</span></span></div>}
        {group.exercises.map((exercise) => <ExerciseRow key={exercise.id} exercise={exercise} />)}
      </div>)}
    </div>}

    {view === "grid" && <div className="roadmap-grid" aria-label="Grade de exercícios">
      {exercises.map((exercise) => <ExerciseCard key={exercise.id} exercise={exercise} />)}
    </div>}

    {view === "timeline" && <ol className="roadmap-timeline" aria-label="Sequência das fases">
      {groups.map((group) => <li key={group.phase.id} className={group.phase.id === settings.currentPhase ? "current" : ""}>
        <div className="roadmap-phase-head">
          <h2>{phaseLabel(group.phase)}</h2>
          <span className="muted small">{group.phase.periodo}</span>
          <span className="num small muted rm-phase-progress">{ready ? practicedExerciseCount(group.exercises, counts) : "…"} de {group.exercises.length} com prática</span>
        </div>
        <div className="rm-compact">{group.exercises.map((exercise) => <ExerciseLine key={exercise.id} exercise={exercise} />)}</div>
      </li>)}
    </ol>}

    {view === "fases" && <div className="roadmap-phases" aria-label="Exercícios por fase">
      {groups.map((group) => <section className={`roadmap-phase${group.phase.id === settings.currentPhase ? " current" : ""}`} key={group.phase.id}>
        <h2>
          <button className="roadmap-phase-toggle" aria-expanded={expanded.has(group.phase.id)} aria-controls={`phase-${group.phase.id}-exercises`} onClick={() => togglePhase(group.phase.id)}>
            <Chevron open={expanded.has(group.phase.id)} />
            <span>{phaseLabel(group.phase)}</span>
            <span className="num small muted rm-phase-progress">{ready ? practicedExerciseCount(group.exercises, counts) : "…"} de {group.exercises.length}</span>
          </button>
        </h2>
        <div id={`phase-${group.phase.id}-exercises`} className="rm-compact" hidden={!expanded.has(group.phase.id)}>
          {group.exercises.map((exercise) => <ExerciseLine key={exercise.id} exercise={exercise} />)}
        </div>
      </section>)}
    </div>}
  </div>;
}

function Chevron({ open }: { open: boolean }) {
  return <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={open ? "m5 8 5 5 5-5" : "m8 5 5 5-5 5"} /></svg>;
}
/** Marca pequena de "tem tab e braço": três cordas e uma nota. */
function TabMark() {
  return <svg className="rm-tab" width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" role="img" aria-label="Com tab e braço"><path d="M3 6h14M3 10h14M3 14h14" /><circle cx="12" cy="10" r="2.2" fill="currentColor" stroke="none" /></svg>;
}
function goal(exercise: Exercise): string {
  if (exercise.metrica.tipo === "bpm" && exercise.bpmAlvo) return `${exercise.bpmAlvo} bpm`;
  if (exercise.metrica.alvo != null) return `${exercise.metrica.alvo} ${exercise.metrica.unidade ?? ""}`.trim();
  return "";
}
function useCount(id: string) {
  const { counts, ready } = usePractice();
  return ready ? counts[id] ?? 0 : null;
}
function Count({ id }: { id: string }) {
  const n = useCount(id);
  return <span className={`rm-count num${n ? " has" : ""}`} aria-label={n === null ? "Carregando" : `${n} práticas`}>{n === null ? "…" : n ? `${n}×` : "nenhuma"}</span>;
}
function ExerciseRow({ exercise }: { exercise: Exercise }) {
  const { t } = useApp();
  const nav = useNav();
  return <button className="rm-row rm-item" role="row" onClick={() => nav.openExercise(exercise.id)}>
    <span className="rm-main" role="cell">
      <span className="rm-title">{exercise.nome}{hasVisual(exercise.id) && <TabMark />}</span>
      <span className="rm-desc">{exercise.descricao}</span>
    </span>
    <span className="rm-type" role="cell">{t(`type.${exercise.tipo}`)}</span>
    <span className="rm-goal num" role="cell">{goal(exercise) || <span className="muted">livre</span>}</span>
    <span role="cell"><Count id={exercise.id} /></span>
  </button>;
}
function ExerciseLine({ exercise }: { exercise: Exercise }) {
  const nav = useNav();
  return <button className="rm-line" onClick={() => nav.openExercise(exercise.id)}>
    <span className="rm-title">{exercise.nome}{hasVisual(exercise.id) && <TabMark />}</span>
    <span className="rm-goal num">{goal(exercise)}</span>
    <Count id={exercise.id} />
  </button>;
}
function ExerciseCard({ exercise }: { exercise: Exercise }) {
  const { t, catalog } = useApp();
  const nav = useNav();
  const p = catalog.fases.find((item) => item.id === exercise.fase)!;
  return <button className="roadmap-exercise-card" onClick={() => nav.openExercise(exercise.id)}>
    <span className="rm-card-top"><span className="num">{shortPhase(p)}</span><span>{t(`type.${exercise.tipo}`)}</span>{hasVisual(exercise.id) && <TabMark />}</span>
    <span className="title">{exercise.nome}</span>
    <span className="rm-desc">{exercise.descricao}</span>
    <span className="rm-card-foot"><span className="rm-goal num">{goal(exercise)}</span><Count id={exercise.id} /></span>
  </button>;
}
