import { suggestRoutine, routineMinutes, type DedicationLevel } from "@gx/core";
import { useMemo } from "react";
import { useApp } from "../lib/app-state";
import { useNav } from "../lib/nav";
import { hasVisual } from "@gx/core";
import { MetronomePanel } from "../components/MetronomePanel";

const LEVELS: DedicationLevel[] = ["baixa", "media", "alta"];

export function Today() {
  const nav = useNav();
  const { t, settings, update, catalog } = useApp();
  const routine = useMemo(
    () => suggestRoutine({ catalog, phase: settings.currentPhase, level: settings.dedication, history: [] }),
    [catalog, settings.currentPhase, settings.dedication],
  );
  const byId = useMemo(() => new Map(catalog.exercicios.map((e) => [e.id, e])), [catalog]);
  const date = new Intl.DateTimeFormat(settings.locale, { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return (
    <div className="screen">
      <header className="screen-head">
        <h1>{t("today.title")}</h1>
        <span className="sub">{date}</span>
        <div className="actions">
          <div className="seg" role="group" aria-label="Dedicação">
            {LEVELS.map((l) => (
              <button key={l} aria-pressed={settings.dedication === l} onClick={() => update({ dedication: l })}>
                {t(`level.${l}`)}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="panels two">
        <section className="panel">
          <div className="panel-head">
            <h2>
              {t("phase", { n: settings.currentPhase })}, {t("minutes", { n: routineMinutes(routine) })}
            </h2>
            <span className="spacer" />
            <select
              aria-label="Fase atual"
              value={settings.currentPhase}
              onChange={(e) => update({ currentPhase: Number(e.target.value) })}
            >
              {catalog.fases
                .filter((f) => f.id >= 1 && f.id <= 4)
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {t("phase", { n: f.id })}: {f.nome}
                  </option>
                ))}
            </select>
          </div>
          <div className="list">
            {routine.map((b, i) => {
              const ex = b.exerciseId ? byId.get(b.exerciseId) : undefined;
              return (
                <button className="row row-btn" key={i} disabled={!ex} onClick={() => ex && nav.openExercise(ex.id)}>
                  <span className="block-time">{t("minutes", { n: b.minutes })}</span>
                  <div>
                    <div className="title">{ex?.nome ?? t("today.empty")}</div>
                    <div className="muted small">{t(`block.${b.kind}`)}</div>
                  </div>
                  <span className="meta">
                    {ex?.bpmInicial != null && ex.bpmAlvo != null && (
                      <span>
                        {ex.bpmInicial} a {ex.bpmAlvo} bpm
                      </span>
                    )}
                    {ex && hasVisual(ex.id) && <span className="tag accent">tab</span>}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="muted small" style={{ marginTop: 16, marginBottom: 0 }}>
            Registrar a prática e montar a própria rotina chegam na Fase 1.
          </p>
        </section>
        <MetronomePanel compact />
      </div>
    </div>
  );
}
