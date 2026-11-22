import { useEffect, useState } from "react";
import { DEFAULT_RULE, registerRun, type Exercise } from "@gx/core";
import { useApp } from "../lib/app-state";
import { useMetronome } from "../lib/metronome";

export function ExerciseProgression({ exercise, onAchieved }: { exercise: Exercise; onAchieved: (bpm: number) => void }) {
  const { settings, update } = useApp();
  const metro = useMetronome();
  const [state, setState] = useState({ bpm: metro.bpm, streak: 0 });
  const [suggested, setSuggested] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const mode = settings.metronome.progression;
  useEffect(() => { setState({ bpm: metro.bpm, streak: 0 }); setSuggested(null); setMessage(""); }, [metro.bpm, exercise.id, mode]);
  const run = (clean: boolean) => {
    const current = state.bpm === metro.bpm ? state : { bpm: metro.bpm, streak: 0 };
    // O core calcula o próximo BPM. A UI só aplica quando Pedro aceita.
    const result = registerRun(current, clean, { mode: "auto", targetBpm: exercise.bpmAlvo });
    setState({ ...result.state, bpm: metro.bpm });
    if (clean) onAchieved(metro.bpm);
    if (!clean) { setSuggested(null); setMessage("Sequência zerada. Tente de novo."); }
    else if (result.kind === "subiu") {
      setSuggested(result.state.bpm); setState({ bpm: metro.bpm, streak: DEFAULT_RULE.cleanRunsNeeded });
      setMessage("Cinco acertos seguidos.");
    } else if (result.kind === "meta-atingida") { setSuggested(null); setMessage("Meta atingida neste andamento."); }
    else setMessage("");
  };
  return <section className="progression" aria-label="Progressão do exercício">
    <div className="panel-head"><h2>Andamento do exercício</h2><span className="spacer" /><div className="seg" role="group" aria-label="Modo de progressão">
      <button aria-pressed={mode === "auto"} onClick={() => update({ metronome: { progression: "auto" } })}>Automático</button>
      <button aria-pressed={mode === "manual"} onClick={() => update({ metronome: { progression: "manual" } })}>Manual</button>
    </div></div>
    {mode === "auto" ? <>
      <p className="muted small">{Math.min(state.streak, 5)} de 5 acertos a {metro.bpm} bpm</p>
      <div className="practice-actions"><button className="btn" disabled={suggested !== null} onClick={() => run(true)}>Acertei</button><button className="btn" onClick={() => run(false)}>Errei</button>
        {suggested !== null && <button className="btn primary" onClick={() => { metro.setBpm(suggested); setSuggested(null); }}>Subir para {suggested} bpm</button>}
      </div>
      <p className="muted small" role="status">{message || "Cinco acertos sugerem mais 4 bpm."}</p>
    </> : <p className="muted small">Ajuste o BPM e registre o andamento que conseguiu tocar.</p>}
  </section>;
}
