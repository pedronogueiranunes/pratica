// Braço da guitarra em SVG. Cordas de cima para baixo como na tab
// (1 = Mi agudo no alto). Notas com o número do dedo; raiz em laranja.

import { fretWindow, type Diagram, type StringNo } from "@gx/core";

const STRINGS: StringNo[] = [1, 2, 3, 4, 5, 6];
const INLAYS = [3, 5, 7, 9, 15, 17, 19, 21];

interface Props {
  diagram: Diagram;
  /** Notas acesas agora (passo atual da tab). */
  active?: { string: StringNo; fret: number }[];
  compact?: boolean;
}

export function Fretboard({ diagram, active = [], compact = false }: Props) {
  const all = [...diagram.notes, ...active];
  const { from, to } = fretWindow(all, compact ? 4 : 5);
  const frets = to - from + 1;
  const left = 34;
  const fretW = compact ? 34 : 64;
  const gap = compact ? 13 : 22;
  const top = compact ? 14 : 18;
  const width = left + frets * fretW + 12;
  const height = top * 2 + gap * 5 + (compact ? 12 : 18);
  const y = (s: StringNo) => top + (s - 1) * gap;
  const x = (fret: number) => left + (fret - from + 0.5) * fretW;
  const isActive = (s: StringNo, f: number) => active.some((a) => a.string === s && a.fret === f);
  const r = compact ? 6.5 : 9.5;
  const hasActive = active.length > 0;

  return (
    <svg
      className="fretboard"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${diagram.name}, casas ${from} a ${to}`}
    >
      {/* casas */}
      {Array.from({ length: frets + 1 }, (_, i) => {
        const fx = left + i * fretW;
        const nut = i === 0 && from === 1;
        return (
          <line
            key={i}
            x1={fx}
            x2={fx}
            y1={y(1)}
            y2={y(6)}
            stroke={nut ? "var(--fg)" : "var(--line-strong)"}
            strokeWidth={nut ? 4 : 1.5}
            strokeLinecap="round"
          />
        );
      })}
      {/* marcações */}
      {Array.from({ length: frets }, (_, i) => from + i)
        .filter((f) => INLAYS.includes(f) || f === 12)
        .map((f) =>
          f === 12 ? (
            <g key={f} fill="var(--bg-sunken)">
              <circle cx={x(f)} cy={(y(2) + y(3)) / 2} r={compact ? 3 : 5} />
              <circle cx={x(f)} cy={(y(4) + y(5)) / 2} r={compact ? 3 : 5} />
            </g>
          ) : (
            <circle key={f} cx={x(f)} cy={(y(3) + y(4)) / 2} r={compact ? 3 : 5} fill="var(--bg-sunken)" />
          ),
        )}
      {/* cordas, a 6 mais grossa */}
      {STRINGS.map((s) => (
        <line key={s} x1={left} x2={width - 12} y1={y(s)} y2={y(s)} stroke="var(--fg-3)" strokeWidth={0.8 + (s - 1) * 0.28} />
      ))}
      {/* números das casas */}
      {Array.from({ length: frets }, (_, i) => from + i).map((f) => (
        <text key={f} x={x(f)} y={height - 3} textAnchor="middle" className="fb-fretno">
          {f}
        </text>
      ))}
      {/* pestana */}
      {diagram.barre && (
        <rect
          x={x(diagram.barre.fret) - r}
          y={y(diagram.barre.to) - r}
          width={r * 2}
          height={y(diagram.barre.from) - y(diagram.barre.to) + r * 2}
          rx={r}
          fill="var(--fg)"
          opacity={hasActive ? 0.35 : 1}
        />
      )}
      {/* abafadas */}
      {diagram.muted?.map((s) => (
        <g key={`m${s}`} stroke="var(--fg-3)" strokeWidth={1.5} strokeLinecap="round">
          <line x1={14} x2={22} y1={y(s) - 4} y2={y(s) + 4} />
          <line x1={22} x2={14} y1={y(s) - 4} y2={y(s) + 4} />
        </g>
      ))}
      {/* notas */}
      {diagram.notes.map((n) => {
        const on = isActive(n.string, n.fret);
        const dim = hasActive && !on;
        if (n.fret === 0) {
          return (
            <circle
              key={`${n.string}-0`}
              cx={18}
              cy={y(n.string)}
              r={r * 0.62}
              fill={on ? "var(--accent)" : "none"}
              stroke={on ? "var(--accent)" : "var(--fg-2)"}
              strokeWidth={1.5}
              opacity={dim ? 0.4 : 1}
            />
          );
        }
        const fill = on ? "var(--accent)" : n.root ? "var(--accent)" : "var(--fg)";
        return (
          <g key={`${n.string}-${n.fret}`} opacity={dim ? 0.45 : 1} className={on ? "fb-on" : undefined}>
            <circle cx={x(n.fret)} cy={y(n.string)} r={on ? r + 2 : r} fill={fill} />
            {!compact && n.finger ? (
              <text x={x(n.fret)} y={y(n.string) + 3.6} textAnchor="middle" className="fb-finger">
                {n.finger}
              </text>
            ) : null}
          </g>
        );
      })}
      {/* notas ativas fora do desenho (ex.: corda solta tocada) */}
      {active
        .filter((a) => !diagram.notes.some((n) => n.string === a.string && n.fret === a.fret))
        .map((a) => (
          <circle
            key={`a${a.string}-${a.fret}`}
            cx={a.fret === 0 ? 18 : x(a.fret)}
            cy={y(a.string)}
            r={a.fret === 0 ? r * 0.62 : r + 2}
            fill="var(--accent)"
          />
        ))}
    </svg>
  );
}
