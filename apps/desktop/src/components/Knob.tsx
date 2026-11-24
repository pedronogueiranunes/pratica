import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  disabled?: boolean;
  compact?: boolean;
}

const START = -135, SWEEP = 270, R = 30, C = 40;
const point = (deg: number, r = R) => { const a = (deg - 90) * Math.PI / 180; return [C + r * Math.cos(a), C + r * Math.sin(a)] as const; };
const arc = (from: number, to: number) => {
  const [x1, y1] = point(from), [x2, y2] = point(to);
  return `M${x1.toFixed(2)} ${y1.toFixed(2)}A${R} ${R} 0 ${to - from > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
};

/** Knob com arrasto vertical, roda do mouse, setas do teclado e duplo clique para voltar ao padrão. */
export function Knob({ label, value, min, max, step, defaultValue, format, onChange, disabled, compact }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; v: number } | null>(null);
  const live = useRef({ value, onChange });
  live.current = { value, onChange };
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  const set = (v: number) => { const next = clamp(v); if (next !== live.current.value) live.current.onChange(next); };
  const pct = (value - min) / (max - min);
  const angle = START + SWEEP * Math.min(1, Math.max(0, pct));
  const [tx, ty] = point(angle, R - 8), [bx, by] = point(angle, R - 18);

  useEffect(() => {
    const el = ref.current;
    if (!el || disabled) return;
    const wheel = (e: WheelEvent) => { e.preventDefault(); set(live.current.value - Math.sign(e.deltaY) * step * (e.shiftKey ? 1 : 2)); };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  });

  const down = (e: PointerEvent) => { if (disabled) return; (e.currentTarget as Element).setPointerCapture(e.pointerId); drag.current = { y: e.clientY, v: value }; };
  const move = (e: PointerEvent) => { if (!drag.current) return; set(drag.current.v + (drag.current.y - e.clientY) / (e.shiftKey ? 600 : 150) * (max - min)); };
  const up = () => { drag.current = null; };
  const key = (e: KeyboardEvent) => {
    const big = step * 10;
    const map: Record<string, number> = { ArrowUp: step, ArrowRight: step, ArrowDown: -step, ArrowLeft: -step, PageUp: big, PageDown: -big };
    if (e.key in map) { e.preventDefault(); set(value + map[e.key]!); }
    else if (e.key === "Home") { e.preventDefault(); set(min); }
    else if (e.key === "End") { e.preventDefault(); set(max); }
  };

  return <div className={`knob${compact ? " is-compact" : ""}${disabled ? " is-disabled" : ""}`}>
    <div ref={ref} className="knob-dial" role="slider" tabIndex={disabled ? -1 : 0} aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-valuetext={format(value)}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={key} onDoubleClick={() => !disabled && set(defaultValue)}>
      <svg viewBox="0 0 80 80" aria-hidden="true">
        <path className="knob-track" d={arc(START, START + SWEEP)} />
        {pct > 0.002 && <path className="knob-value" d={arc(START, angle)} />}
        <circle className="knob-cap" cx={C} cy={C} r={R - 6} />
        <line className="knob-tick" x1={bx} y1={by} x2={tx} y2={ty} />
      </svg>
    </div>
    <div className="knob-readout num">{format(value)}</div>
    <div className="knob-label">{label}</div>
  </div>;
}
