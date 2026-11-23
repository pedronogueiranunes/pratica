import { useEffect, useMemo, useRef, useState } from "react";
import { PRESET_PAIRS, exerciseVisual, youtubeId } from "@gx/core";
import { useApp } from "../lib/app-state";
import { useMetronome } from "../lib/metronome";
import { useNav } from "../lib/nav";
import { isNative } from "../lib/engine";
import { Fretboard } from "../components/Fretboard";
import { Tab } from "../components/Tab";
import { PracticeForm } from "../components/PracticeForm";
import { ExerciseProgression } from "../components/ExerciseProgression";
import { usePractice } from "../lib/practice-state";
import { MetronomePanel } from "../components/MetronomePanel";
import { DrumPanel } from "../components/DrumPanel";

async function openExternal(url: string) {
  if (isNative) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } else window.open(url, "_blank", "noopener,noreferrer");
}

export function Exercise({ id }: { id: string }) {
  const { t, catalog, settings } = useApp();
  const nav = useNav();
  const { logs, ready } = usePractice();
  const [achieved, setAchieved] = useState<number | undefined>();
  const m = useMetronome();
  const ex = catalog.exercicios.find((e) => e.id === id);
  const visual = useMemo(() => exerciseVisual(id), [id]);
  const [diagramIdx, setDiagramIdx] = useState(0);
  const [step, setStep] = useState(0);
  const [follow, setFollow] = useState(true);
  const stepRef = useRef(0);
  stepRef.current = step;

  // Ao abrir, o metrônomo vai para o bpm inicial do exercício (se parado).
  useEffect(() => {
    const last = logs.filter((log) => log.exerciseId === id && log.bpm !== undefined).at(-1);
    if (!m.running && (last?.bpm ?? ex?.bpmInicial)) m.setBpm(last?.bpm ?? ex!.bpmInicial!);
    setAchieved(undefined);
    setStep(0);
    setDiagramIdx(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, ready]);

  useEffect(() => setAchieved(undefined), [settings.metronome.progression]);

  // Cada clique do metrônomo avança um passo da tab.
  useEffect(() => {
    if (!visual || !follow) return;
    return m.onTick(() => {
      setStep((s) => (s + 1) % visual.tab.length);
    });
  }, [m, visual, follow]);

  // Em exercícios com várias formas, o desenho acompanha a forma do passo.
  const current = visual?.tab[step];
  useEffect(() => {
    if (!visual || !current?.label) return;
    const i = visual.diagrams.findIndex((d) => d.name === current.label);
    if (i >= 0) setDiagramIdx(i);
  }, [visual, current]);

  if (!ex) return null;
  const phase = catalog.fases.find((f) => f.id === ex.fase);
  const diagram = visual?.diagrams[diagramIdx];

  return (
    <div className="screen">
      <button className="btn ghost back" onClick={nav.back}>
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12.5 4.5 7 10l5.5 5.5" />
        </svg>
        Voltar
      </button>
      <header className="screen-head ex-head">
        <div>
          <p className="pixel eyebrow">
            {ex.fase === 0 ? phase?.nome : t("phase", { n: ex.fase })} / {t(`type.${ex.tipo}`)}
          </p>
          <h1>{ex.nome}</h1>
          <p className="ex-desc">{ex.descricao}</p>
          {ex.tipo === "acordes" && <button className="btn ex-trainer" onClick={() => nav.openChordTrainer(ex.id === "f1-troca-acordes" ? PRESET_PAIRS[0]! : visual?.diagrams.map((d) => d.name.split(" ")[0]!).filter((n, i, a) => a.indexOf(n) === i).slice(0, 8) ?? PRESET_PAIRS[0]!)}>Treinar a troca com diagramas</button>}
        </div>
      </header>

      <div className="panels ex-grid">
        <section className="panel ex-board">
          {visual && diagram ? (
            <>
              <div className="panel-head">
                <h2>{diagram.name}</h2>
                <span className="spacer" />
                {visual.diagrams.length > 1 && (
                  <div className="seg" role="group" aria-label="Formas">
                    {visual.diagrams.map((d, i) => (
                      <button key={d.name} aria-pressed={i === diagramIdx} onClick={() => setDiagramIdx(i)}>
                        {d.name.replace(/ \(.*\)$/, "").replace(/^Posição /, "")}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Fretboard diagram={diagram} active={current?.notes ?? []} />
              <div className="panel-head" style={{ marginTop: 24, marginBottom: 12 }}>
                <h2>Tab</h2>
                <span className="num muted small">
                  {step + 1}/{visual.tab.length}
                </span>
                <span className="spacer" />
                <label className="inline-check small">
                  <input type="checkbox" className="switch" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
                  Seguir o metrônomo
                </label>
                <button className="btn" onClick={() => setStep(0)}>
                  Do começo
                </button>
              </div>
              <Tab steps={visual.tab} current={step} onSeek={setStep} />
              {visual.diagrams.length > 1 && (
                <div className="chord-strip">
                  {visual.diagrams.map((d, i) => (
                    <button key={d.name} className={`chord-card${i === diagramIdx ? " on" : ""}`} onClick={() => setDiagramIdx(i)}>
                      <Fretboard diagram={d} compact />
                      <span>{d.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="empty" style={{ minHeight: 220 }}>
              <div>
                <h2>Sem tab para este</h2>
                <p style={{ margin: 0, maxWidth: 360 }}>
                  Aqui as notas dependem da música ou do que você está estudando. Use o metrônomo e a descrição.
                </p>
              </div>
            </div>
          )}
        </section>

        <section className="exercise-practice">
          <MetronomePanel compact />
          <DrumPanel />
          {ex.metrica.tipo === "bpm" && <div className="panel"><ExerciseProgression key={id} exercise={ex} onAchieved={setAchieved} /></div>}
          <div className="panel"><PracticeForm key={id} exercise={ex} initialBpm={achieved} /></div>
        </section>

        <section className="panel ex-info">
          <h2>Para passar</h2>
          <p style={{ marginTop: 0 }}>{ex.criterioSucesso}</p>
          <div className="list">
            {ex.bpmInicial != null && ex.bpmAlvo != null && (
              <div className="row">
                <span className="muted">Andamento</span>
                <span className="meta">
                  {ex.bpmInicial} a {ex.bpmAlvo} bpm
                </span>
              </div>
            )}
            {ex.duracaoMin != null && (
              <div className="row">
                <span className="muted">Tempo por dia</span>
                <span className="meta">{t("minutes", { n: ex.duracaoMin })}</span>
              </div>
            )}
            {ex.metrica.alvo != null && (
              <div className="row">
                <span className="muted">Meta</span>
                <span className="meta">
                  {ex.metrica.alvo} {ex.metrica.unidade}
                </span>
              </div>
            )}
          </div>
          {ex.videos.length > 0 && (
            <>
              <h2 style={{ marginTop: 24 }}>Vídeos</h2>
              <div className="video-list">
                {ex.videos.map((url) => {
                  const vid = youtubeId(url);
                  return (
                    <button key={url} className="video" onClick={() => void openExternal(url)}>
                      {vid && <img src={`https://i.ytimg.com/vi/${vid}/mqdefault.jpg`} alt="" loading="lazy" />}
                      <span className="small muted">YouTube</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
