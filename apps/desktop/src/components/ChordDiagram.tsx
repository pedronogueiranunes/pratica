// Diagrama de acorde vertical, como nas revistas de cifra: cordas em pé
// (Mi grave à esquerda), casas na horizontal, número do dedo na bolinha.
import type { Diagram, StringNo } from "@gx/core";

const COLS: StringNo[] = [6, 5, 4, 3, 2, 1];
const SIZES = { sm: { w: 92, gap: 13, fret: 17 }, md: { w: 120, gap: 17, fret: 22 }, lg: { w: 196, gap: 28, fret: 36 } } as const;

export function ChordDiagram({ diagram, size = "md", title, live = false }: { diagram: Diagram; size?: keyof typeof SIZES; title?: string; live?: boolean }) {
  const z = SIZES[size];
  const fretted = diagram.notes.filter((n) => n.fret > 0).map((n) => n.fret);
  const max = fretted.length ? Math.max(...fretted) : 0;
  const min = fretted.length ? Math.min(...fretted) : 0;
  // Mostra a partir da 1ª casa quando cabe; senão começa na menor casa e escreve o número.
  const base = max <= 4 ? 1 : min;
  const rows = Math.max(4, max - base + 1);
  const left = (z.w - z.gap * 5) / 2;
  const top = z.fret * 1.1;
  const height = top + rows * z.fret + z.fret * 0.4;
  const x = (s: StringNo) => left + COLS.indexOf(s) * z.gap;
  const y = (fret: number) => top + (fret - base + 0.5) * z.fret;
  const r = z.gap * 0.42;
  const label = title ?? diagram.name;
  const desc = COLS.map((s) => diagram.muted?.includes(s) ? "x" : String(diagram.notes.find((n) => n.string === s)?.fret ?? "x")).join(" ");
  return <svg className={`chord-diagram ${size}${live ? " live" : ""}`} viewBox={`0 0 ${z.w} ${height}`} width={z.w} role="img" aria-label={`${label}: ${desc}`}>
    {base > 1 && <text className="cd-base" x={left - z.gap * 0.55} y={y(base) + 4} textAnchor="end">{base}</text>}
    {/* pestana do braço (traste zero) só quando começa na primeira casa */}
    {base === 1 ? <rect className="cd-nut" x={left - 1} y={top - 3} width={z.gap * 5 + 2} height={3.5} rx={1} />
      : <line className="cd-fret" x1={left} x2={left + z.gap * 5} y1={top} y2={top} />}
    {Array.from({ length: rows }, (_, i) => <line key={i} className="cd-fret" x1={left} x2={left + z.gap * 5} y1={top + (i + 1) * z.fret} y2={top + (i + 1) * z.fret} />)}
    {COLS.map((s) => <line key={s} className="cd-string" x1={x(s)} x2={x(s)} y1={top} y2={top + rows * z.fret} />)}
    {COLS.map((s) => {
      const open = diagram.notes.find((n) => n.string === s && n.fret === 0);
      const cy = top - z.fret * 0.55;
      if (diagram.muted?.includes(s)) return <g key={s} className="cd-muted"><path d={`M${x(s) - r * 0.6} ${cy - r * 0.6}l${r * 1.2} ${r * 1.2}m0 ${-r * 1.2}l${-r * 1.2} ${r * 1.2}`} /></g>;
      if (open) return <circle key={s} className={`cd-open${open.root ? " root" : ""}`} cx={x(s)} cy={cy} r={r * 0.62} />;
      return null;
    })}
    {diagram.barre && <rect className="cd-barre" x={x(diagram.barre.from) - r} y={y(diagram.barre.fret) - r} width={x(diagram.barre.to) - x(diagram.barre.from) + 2 * r} height={2 * r} rx={r} />}
    {diagram.notes.filter((n) => n.fret > 0 && !(diagram.barre && n.fret === diagram.barre.fret && n.finger === 1)).map((n) => <g key={n.string} className={`cd-dot${n.root ? " root" : ""}`}>
      <circle cx={x(n.string)} cy={y(n.fret)} r={r} />
      {n.finger ? <text x={x(n.string)} y={y(n.fret)} dy="0.35em" textAnchor="middle">{n.finger}</text> : null}
    </g>)}
    {diagram.barre && <text className="cd-barre-finger" x={x(diagram.barre.from)} y={y(diagram.barre.fret)} dy="0.35em" textAnchor="middle">1</text>}
  </svg>;
}

/** Cartão com o nome em cima e o diagrama; avisa quando a forma foi calculada pelo app. */
export function ChordCard({ name, diagram, size = "md", generated = false, live = false, onClick, pressed }: { name: string; diagram: Diagram | null; size?: keyof typeof SIZES; generated?: boolean; live?: boolean; onClick?: () => void; pressed?: boolean }) {
  const body = <>
    <span className="chord-name">{name}</span>
    {diagram ? <ChordDiagram diagram={diagram} size={size} title={name} live={live} /> : <span className="chord-missing">Sem forma para este nome</span>}
    {generated && diagram && <span className="chord-note">forma calculada</span>}
  </>;
  return onClick ? <button className={`chord-tile ${size}${live ? " live" : ""}`} onClick={onClick} aria-pressed={pressed}>{body}</button>
    : <div className={`chord-tile ${size}${live ? " live" : ""}`}>{body}</div>;
}
