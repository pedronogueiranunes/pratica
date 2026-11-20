import { exercisesByPhase } from "@gx/core";
import { useMemo } from "react";
import { useApp } from "../lib/app-state";
import { useNav } from "../lib/nav";
import { hasVisual } from "@gx/core";

export function Roadmap() {
  const nav = useNav();
  const { t, catalog } = useApp();
  const byPhase = useMemo(() => exercisesByPhase(catalog), [catalog]);

  return (
    <div className="screen">
      <header className="screen-head">
        <h1>{t("nav.roadmap")}</h1>
        <span className="sub">
          {catalog.exercicios.length} exercícios. As visões de timeline, fases e grid chegam na Fase 1.
        </span>
      </header>
      {catalog.fases.map((f) => (
        <section key={f.id}>
          <h2 className="phase-title">
            {f.id === 0 ? f.nome : `${t("phase", { n: f.id })}: ${f.nome}`} <span className="muted">· {f.periodo}</span>
          </h2>
          <div className="list">
            {(byPhase.get(f.id) ?? []).map((e) => (
              <button className="row row-btn" key={e.id} onClick={() => nav.openExercise(e.id)}>
                <div style={{ minWidth: 0 }}>
                  <div className="title">{e.nome}</div>
                  <div className="muted small">{e.descricao}</div>
                </div>
                <span className="meta">
                  {hasVisual(e.id) && <span className="tag accent">tab</span>}
                  <span className="tag">{t(`type.${e.tipo}`)}</span>
                  {e.metrica.tipo === "bpm" && <span>{e.bpmAlvo} bpm</span>}
                  {e.metrica.alvo != null && (
                    <span>
                      {e.metrica.alvo} {e.metrica.unidade}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
