import { dayKey, suggestRoutine, routineMinutes, PERSONAL_ROUTINE_ID, hasVisual, type DedicationLevel, type SavedRoutine } from "@gx/core";
import { useMemo, useState } from "react";
import { useApp } from "../lib/app-state";
import { useNav } from "../lib/nav";
import { usePractice } from "../lib/practice-state";
import { PracticeForm } from "../components/PracticeForm";
import { MetronomePanel } from "../components/MetronomePanel";
import { RoutineEditor } from "../components/RoutineEditor";

const LEVELS: DedicationLevel[] = ["baixa", "media", "alta"];
const LEVEL_MINUTES: Record<DedicationLevel, number> = { baixa: 20, media: 40, alta: 60 };

export function Today() {
  const nav = useNav();
  const { logs, counts, ready, routine: savedRoutine, saveRoutine, routineDraft: draft, setRoutineDraft: setDraft } = usePractice();
  const [registerId, setRegisterId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const { t, settings, update, catalog } = useApp();
  const today = dayKey(new Date());
  const earlierHistory = useMemo(() => logs.filter((log) => Date.parse(log.at) < new Date(`${today}T00:00:00`).getTime()), [logs, today]);
  const suggested = useMemo(
    () => suggestRoutine({ catalog, phase: settings.currentPhase, level: settings.dedication, history: earlierHistory }),
    [catalog, settings.currentPhase, settings.dedication, earlierHistory],
  );
  const custom = settings.routineSource === "custom" && savedRoutine !== null;
  const routine = custom ? savedRoutine.blocks : suggested;
  const byId = useMemo(() => new Map(catalog.exercicios.map((exercise) => [exercise.id, exercise])), [catalog]);
  const date = new Intl.DateTimeFormat(settings.locale, { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  const edit = () => {
    setMessage(""); setRegisterId(null);
    setDraft({ id: PERSONAL_ROUTINE_ID, name: custom ? savedRoutine.name : "Minha rotina", blocks: structuredClone(routine) });
  };
  const save = async (next: SavedRoutine) => {
    await saveRoutine(next);
    setDraft(null); setMessage("Rotina salva.");
  };
  const selectSource = async (source: "suggested" | "custom") => {
    setMessage(""); setRegisterId(null);
    await update({ routineSource: source });
  };

  return <div className="screen">
    <header className="screen-head">
      <h1>{t("today.title")}</h1><span className="sub">{date}</span>
    </header>
    <div className="panels two">
      <section className="panel today-routine">
        <div className="panel-head">
          <h2>{custom ? savedRoutine.name : "Rotina sugerida"}</h2>
          <span className="num muted small">{routineMinutes(routine)} min planejados</span>
          <span className="spacer" />
          {!draft && <button className="btn" disabled={!ready} onClick={edit}>Editar rotina</button>}
        </div>
        <div className="routine-setup">
          <div className="seg" role="group" aria-label="Rotina do dia">
            <button disabled={!!draft || !ready} aria-pressed={!custom} onClick={() => void selectSource("suggested")}>Sugestão</button>
            <button disabled={!!draft || !ready || !savedRoutine} aria-pressed={custom} onClick={() => void selectSource("custom")}>Minha rotina</button>
          </div>
          {!custom && <div className="seg routine-levels" role="group" aria-label="Dedicação">
            {LEVELS.map((level) => <button key={level} disabled={!!draft || !ready} aria-pressed={settings.dedication === level} onClick={() => { setRegisterId(null); void update({ dedication: level }); }}>
              {t(`level.${level}`)} <span className="num">{LEVEL_MINUTES[level]} min</span>
            </button>)}
          </div>}
          <label className="routine-phase-label">Fase atual
            <select disabled={!!draft || !ready} value={settings.currentPhase} onChange={(event) => { setRegisterId(null); void update({ currentPhase: Number(event.target.value) }); }}>
              {catalog.fases.filter((phase) => phase.id >= 1 && phase.id <= 4).map((phase) => <option key={phase.id} value={phase.id}>Fase {phase.id}: {phase.nome}</option>)}
            </select>
          </label>
        </div>
        {settings.routineSource === "custom" && !savedRoutine && ready && <p className="muted small">Sua rotina ainda não está disponível neste aparelho. Mostrando a sugestão.</p>}
        {draft ? <RoutineEditor initial={draft} onChange={setDraft} onCancel={() => { setDraft(null); setMessage("Alterações descartadas."); }} onSave={save} /> : <>
          <div className="list">
            {routine.map((block, index) => {
              const exercise = block.exerciseId ? byId.get(block.exerciseId) : undefined;
              return <div className="row today-row" key={`${index}-${block.exerciseId}`}>
                <button className="today-open" disabled={!exercise || !ready} onClick={() => exercise && nav.openExercise(exercise.id)}>
                  <span className="block-time">{t("minutes", { n: block.minutes })}</span>
                  <span className="today-exercise-copy"><span className="title">{exercise?.nome ?? t("today.empty")}</span><span className="muted small">{t(`block.${block.kind}`)}</span></span>
                </button>
                <span className="meta">
                  {exercise?.bpmInicial != null && exercise.bpmAlvo != null && <span>{exercise.bpmInicial} a {exercise.bpmAlvo} bpm</span>}
                  <span>{ready && exercise ? counts[exercise.id] ?? 0 : "…"} práticas</span>
                  {exercise && hasVisual(exercise.id) && <span className="tag accent">tab</span>}
                </span>
                {exercise && <button className="btn" disabled={!ready} aria-expanded={registerId === exercise.id} aria-label={`Registrar ${exercise.nome}`} onClick={() => setRegisterId(registerId === exercise.id ? null : exercise.id)}>Registrar</button>}
              </div>;
            })}
          </div>
          {registerId && byId.get(registerId) && <div className="today-register"><h3>{byId.get(registerId)!.nome}</h3><PracticeForm key={registerId} exercise={byId.get(registerId)!} /></div>}
        </>}
        <p className="muted small" role="status">{message}</p>
      </section>
      <MetronomePanel compact />
    </div>
  </div>;
}
