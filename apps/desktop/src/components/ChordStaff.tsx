import { useId } from "react";
import type { ChordVoicing } from "@gx/core";

function Accidental({ value, x, y }: { value: number; x: number; y: number }) {
  if (!value) return null;
  if (value < 0) return <g transform={`translate(${x} ${y})`} className="staff-accidental">
    {Array.from({ length: -value }, (_, i) => <path key={i} transform={`translate(${-i * 7} 0)`} d="M0 -15V8C12 0 8 -7 0 -1" />)}
  </g>;
  if (value === 2) return <path className="staff-accidental" d={`M${x - 5} ${y - 6}l10 12m0 -12l-10 12`} />;
  return <path className="staff-accidental" d={`M${x - 3} ${y - 11}v22m6 -24v22m-11 -12l16 -3m-16 11l16 -3`} />;
}

/** Acorde estático em clave de sol da guitarra: escrita uma oitava acima do som. */
export function ChordStaff({ voicing, name }: { voicing: ChordVoicing; name: string }) {
  const id = useId();
  const unique = voicing.notes.filter((n, i, all) => all.findIndex((v) => v.staffStep === n.staffStep && v.alteration === n.alteration) === i)
    .sort((a, b) => a.staffStep - b.staffStep);
  const columns: number[][] = [];
  const accidentals = unique.map((note) => {
    if (!note.alteration) return -1;
    let col = columns.findIndex((steps) => steps.every((s) => Math.abs(s - note.staffStep) >= 5));
    if (col < 0) { col = columns.length; columns.push([]); }
    columns[col]!.push(note.staffStep); return col;
  });
  const center = 170 + columns.length * 8;
  let lastStep = -Infinity, shifted = false;
  const positions = unique.map((note) => {
    shifted = note.staffStep - lastStep === 1 ? !shifted : false;
    lastStep = note.staffStep;
    return { note, x: center + (shifted ? 17 : 0), y: 132 - note.staffStep * 7 };
  });
  const top = Math.min(24, ...positions.map((p) => p.y - 25));
  const bottom = Math.max(190, ...positions.map((p) => p.y + 24));
  const ledgers = new Set<number>();
  for (const { note } of positions) {
    for (let step = -2; step >= note.staffStep; step -= 2) ledgers.add(step);
    for (let step = 10; step <= note.staffStep; step += 2) ledgers.add(step);
  }
  return <figure className="chord-staff">
    <figcaption><h3>Partitura</h3><span className="muted small">Clave de sol · guitarra</span></figcaption>
    <svg role="img" aria-labelledby={`${id}-title ${id}-desc`} viewBox={`0 ${top} 360 ${bottom - top}`}>
      <title id={`${id}-title`}>{name}, notas da forma selecionada</title>
      <desc id={`${id}-desc`}>Notas que soam: {voicing.notes.map((n) => n.label).join(", ")}. A escrita da guitarra fica uma oitava acima do som. Acorde estático, sem indicação de ritmo.</desc>
      {[0, 2, 4, 6, 8].map((s) => <line key={s} className="staff-line" x1="20" x2="340" y1={132 - s * 7} y2={132 - s * 7} />)}
      {/* Símbolo musical, não ícone de interface. Fallbacks nativos com cobertura musical. */}
      <text x="29" y="139" className="staff-clef" aria-hidden="true">𝄞</text>
      <text x="47" y="161" className="staff-octave" aria-hidden="true">8</text>
      {[...ledgers].map((step) => <line key={step} className="staff-ledger" x1={center - 18} x2={center + 35} y1={132 - step * 7} y2={132 - step * 7} />)}
      {positions.map(({ note, x, y }, i) => <g key={`${note.staffStep}:${note.alteration}`}>
        <Accidental value={note.alteration} x={center - 28 - accidentals[i]! * 21} y={y} />
        <ellipse className="staff-note" cx={x} cy={y} rx="10" ry="6" transform={`rotate(-18 ${x} ${y})`} />
      </g>)}
    </svg>
    <p className="num staff-pitches">{voicing.notes.map((n) => n.label).join(" · ")}</p>
    <p className="muted small">Notas que soam. Na pauta, uma oitava acima.</p>
  </figure>;
}
