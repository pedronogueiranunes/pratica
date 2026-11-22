import { useEffect, useMemo, useState } from "react";
import { filterRoadmap, hasVisual, practicedExerciseCount, type Exercise, type ExerciseType, type Phase } from "@gx/core";
import { useApp } from "../lib/app-state";
import { useNav } from "../lib/nav";
import { usePractice } from "../lib/practice-state";

type View = "timeline" | "fases" | "lista" | "grid";
const VIEWS: View[] = ["timeline", "fases", "lista", "grid"];
const LABELS: Record<View, string> = { timeline: "Timeline", fases: "Fases", lista: "Lista", grid: "Grid" };
function initialView(): View {
  try { const saved = localStorage.getItem("pratica.roadmap.view"); return VIEWS.includes(saved as View) ? saved as View : "lista"; }
  catch { return "lista"; }
}

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
  const togglePhase = (id: number) => setExpanded((previous) => {
    const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next;
  });

  return <div className="screen roadmap-screen">
    <header className="screen-head">
      <h1>{t("nav.roadmap")}</h1>
      <span className="sub">Você escolhe quando avançar.</span>
    </header>
    <div className="roadmap-toolbar">
      <div className="seg roadmap-views" role="group" aria-label="Visão do Roadmap">
        {VIEWS.map((item) => <button key={item} aria-pressed={view === item} onClick={() => selectView(item)}>{LABELS[item]}</button>)}
      </div>
      <div className="roadmap-filters">
        <label>Fase
          <select value={phase} onChange={(event) => setPhase(event.target.value === "all" ? "all" : Number(event.target.value))}>
            <option value="all">Todas as fases</option>
            {catalog.fases.map((item) => <option key={item.id} value={item.id}>{phaseLabel(item)}</option>)}
          </select>
        </label>
        <label>Tipo
          <select value={type} onChange={(event) => setType(event.target.value as ExerciseType | "all")}>
            <option value="all">Todos os tipos</option>
            {catalog.tipos.map((item) => <option key={item} value={item}>{t(`type.${item}`)}</option>)}
          </select>
        </label>
        {(phase !== "all" || type !== "all") && <button className="btn ghost" onClick={clear}>Limpar filtros</button>}
      </div>
    </div>
    <p className="muted small roadmap-results" role="status">
      {exercises.length} de {catalog.exercicios.length} exercícios{ready ? ` · ${practicedExerciseCount(exercises, counts)} com prática registrada` : " · Carregando práticas…"}
    </p>
    {!exercises.length && <div className="empty"><div><h2>Nenhum exercício com esses filtros</h2><p>Escolha outra fase ou outro tipo.</p><button className="btn" onClick={clear}>Limpar filtros</button></div></div>}
    {view === "lista" && <div className="list roadmap-list" aria-label="Lista de exercícios">
      {exercises.map((exercise) => <ExerciseItem key={exercise.id} exercise={exercise} showPhase />)}
    </div>}
    {view === "grid" && <div className="roadmap-grid" aria-label="Grade de exercícios">
      {exercises.map((exercise) => <ExerciseItem key={exercise.id} exercise={exercise} card showPhase />)}
    </div>}
    {view === "timeline" && <ol className="roadmap-timeline" aria-label="Sequência das fases">
      {groups.map((group) => <li key={group.phase.id} className={group.phase.id === settings.currentPhase ? "current" : ""}>
        <div className="roadmap-phase-head">
          <h2>{phaseLabel(group.phase)}</h2>
          {group.phase.id === settings.currentPhase && <span className="tag accent">Fase atual</span>}
          <span className="muted small">{ready ? practicedExerciseCount(group.exercises, counts) : "…"} de {group.exercises.length} com prática</span>
        </div>
        <div className="list">{group.exercises.map((exercise) => <ExerciseItem key={exercise.id} exercise={exercise} />)}</div>
      </li>)}
    </ol>}
    {view === "fases" && <div className="roadmap-phases" aria-label="Exercícios por fase">
      {groups.map((group) => <section className="roadmap-phase" key={group.phase.id}>
        <h2>
          <button className="roadmap-phase-toggle" aria-expanded={expanded.has(group.phase.id)} aria-controls={`phase-${group.phase.id}-exercises`} onClick={() => togglePhase(group.phase.id)}>
            <Chevron open={expanded.has(group.phase.id)} />
            <span>{phaseLabel(group.phase)}</span>
            {group.phase.id === settings.currentPhase && <span className="tag accent">Atual</span>}
            <span className="muted small">{group.exercises.length} exercícios</span>
          </button>
        </h2>
        <p className="muted small roadmap-phase-count">{ready ? practicedExerciseCount(group.exercises, counts) : "…"} com prática registrada</p>
        <div id={`phase-${group.phase.id}-exercises`} className="list" hidden={!expanded.has(group.phase.id)}>
          {group.exercises.map((exercise) => <ExerciseItem key={exercise.id} exercise={exercise} />)}
        </div>
      </section>)}
    </div>}
  </div>;
}

function phaseLabel(phase: Phase): string { return phase.id >= 1 && phase.id <= 4 ? `Fase ${phase.id}: ${phase.nome}` : phase.nome; }
function Chevron({ open }: { open: boolean }) {
  return <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={open ? "m5 8 5 5 5-5" : "m8 5 5 5-5 5"} /></svg>;
}
function ExerciseItem({ exercise, card = false, showPhase = false }: { exercise: Exercise; card?: boolean; showPhase?: boolean }) {
  const { t, catalog } = useApp();
  const { counts, ready } = usePractice();
  const nav = useNav();
  const phase = catalog.fases.find((item) => item.id === exercise.fase)!;
  return <button className={card ? "roadmap-exercise-card" : "row row-btn roadmap-exercise"} onClick={() => nav.openExercise(exercise.id)}>
    <span className="roadmap-exercise-copy">
      <span className="title">{exercise.nome}</span>
      <span className="muted small roadmap-exercise-description">{exercise.descricao}</span>
    </span>
    <span className="roadmap-exercise-meta">
      {showPhase && <span className="muted small">{exercise.fase >= 1 && exercise.fase <= 4 ? `Fase ${exercise.fase}` : phase.nome}</span>}
      <span className="tag">{t(`type.${exercise.tipo}`)}</span>
      {hasVisual(exercise.id) && <span className="tag accent">tab</span>}
      {exercise.metrica.tipo === "bpm" && <span className="num small muted">Meta: {exercise.bpmAlvo} bpm</span>}
      {exercise.metrica.alvo != null && <span className="num small muted">Meta: {exercise.metrica.alvo} {exercise.metrica.unidade}</span>}
      <span className="num small practice-count">{ready ? counts[exercise.id] ?? 0 : "…"} práticas</span>
    </span>
  </button>;
}
