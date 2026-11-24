import { fxFormat, type FxPedal } from "@gx/core";
import { Knob } from "./Knob";

interface Props {
  pedal: FxPedal;
  on: boolean;
  values: number[];
  onToggle: (on: boolean) => void;
  onChange: (index: number, value: number) => void;
}

/** Um pedal: pisada liga/desliga, escolhas em botões e knobs compactos. */
export function Pedal({ pedal, on, values, onToggle, onChange }: Props) {
  return <section className={`pedal${on ? " is-on" : ""}`} aria-label={pedal.name}>
    <header className="pedal-head">
      <h3>{pedal.name}</h3>
      <button className="pedal-switch" role="switch" aria-checked={on} aria-label={`${pedal.name}: ${on ? "ligado" : "desligado"}`} onClick={() => onToggle(!on)}><span /></button>
    </header>
    {pedal.params.filter((p) => p.options).map((p) => {
      const i = pedal.params.indexOf(p);
      return <div key={p.id} className="seg pedal-seg" role="group" aria-label={`${pedal.name}: ${p.label}`}>
        {p.options!.map((o, k) => <button key={o} aria-pressed={Math.round(values[i]!) === k} onClick={() => onChange(i, k)}>{o}</button>)}
      </div>;
    })}
    <div className="pedal-knobs">
      {pedal.params.map((p, i) => p.options ? null : <Knob key={p.id} compact label={p.label} value={values[i]!} min={p.min} max={p.max} step={p.step} defaultValue={p.def} format={(v) => fxFormat(p, v)} onChange={(v) => onChange(i, v)} />)}
    </div>
  </section>;
}
