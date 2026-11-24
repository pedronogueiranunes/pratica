import { useState } from "react";
import { exerciseGuide, studyTempo } from "@gx/core";
import { FretboardExplorer } from "./FretboardExplorer";
import { CircleOfFifths } from "./CircleOfFifths";

/** Guia no lugar da tab quando o exercício não tem diagrama. */
export function ExerciseGuide({ id, setBpm }: { id: string; setBpm: (bpm: number) => void }) {
  const guide = exerciseGuide(id);
  const [original, setOriginal] = useState("");
  if (!guide) {
    return (
      <div className="empty" style={{ minHeight: 220 }}>
        <div>
          <h2>Sem tab para este</h2>
          <p style={{ margin: 0, maxWidth: 360 }}>Aqui as notas dependem da música ou do que você está estudando. Use o metrônomo e a descrição.</p>
        </div>
      </div>
    );
  }
  const bpm = guide.tempo ? studyTempo(Number(original), guide.tempo.percent) : 0;
  return (
    <div className="exercise-guide">
      <p className="guide-intro">{guide.intro}</p>
      <div className="guide-cols">
        <div>
          <h3>Como fazer</h3>
          <ol className="guide-steps">{guide.steps.map((s) => <li key={s}>{s}</li>)}</ol>
        </div>
        <div>
          <h3>O que observar</h3>
          <ul className="guide-watch">{guide.watch.map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
      </div>
      {guide.rhythm && (
        <div className="guide-block">
          <h3>{guide.rhythm.label}</h3>
          <div className="guide-grid" role="img" aria-label={`${guide.rhythm.label}: ${guide.rhythm.cells.map((c) => `${c.beat} ${c.stroke}`).join(", ")}`}>
            {guide.rhythm.cells.map((c, i) => (
              <div key={i} className={`guide-cell${c.accent ? " accent" : ""}${c.stroke === "·" ? " rest" : ""}`}>
                <span className="guide-beat">{c.beat}</span>
                <span className="guide-stroke">{c.stroke === "D" ? "↓" : c.stroke === "U" ? "↑" : c.stroke}</span>
              </div>
            ))}
          </div>
          <p className="muted guide-legend">↓ para baixo · ↑ para cima · x abafado · · silêncio</p>
        </div>
      )}
      {guide.snippet && (
        <div className="guide-block">
          <h3>{guide.snippet.title}</h3>
          <pre className="guide-snippet">{guide.snippet.text}</pre>
        </div>
      )}
      {guide.tempo && (
        <div className="guide-block guide-tempo">
          <h3>{guide.tempo.label}</h3>
          <label className="guide-tempo-row">
            <span>Andamento original</span>
            <input type="number" inputMode="numeric" min={30} max={300} placeholder="bpm" value={original} onChange={(e) => setOriginal(e.target.value)} />
          </label>
          {bpm > 0 && (
            <p className="guide-tempo-result">
              Estude a <strong className="num">{bpm} bpm</strong> ({guide.tempo.percent}%).{" "}
              <button className="btn" onClick={() => setBpm(Math.min(300, Math.max(30, bpm)))}>Usar no metrônomo</button>
            </p>
          )}
        </div>
      )}
      {guide.embed === "fretboard" && <div className="guide-embed"><FretboardExplorer embedded /></div>}
      {guide.embed === "circle" && <div className="guide-embed"><CircleOfFifths /></div>}
    </div>
  );
}
