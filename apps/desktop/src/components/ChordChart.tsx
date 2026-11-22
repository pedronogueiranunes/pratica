import type { ChordProDoc } from "@gx/core";

type Piece = { chord?: string; text: string };
const NBSP = " ";

/** Agrupa os trechos por palavra: a linha só quebra em espaço, nunca no meio da palavra onde caiu o acorde. */
function words(segments: Piece[]): Piece[][] {
  const out: Piece[][] = [[]];
  for (const seg of segments) {
    seg.text.split(/(?<= )/).forEach((text, i) => {
      out[out.length - 1]!.push(i === 0 && seg.chord !== undefined ? { chord: seg.chord, text } : { text });
      if (text.endsWith(" ")) out.push([]);
    });
  }
  return out.filter((w) => w.length);
}

/** Cifra em ChordPro renderizada com o acorde em cima da sílaba. Feita para ler a 1 m. */
export function ChordChart({ doc, label }: { doc: ChordProDoc; label: string }) {
  return <div className="chart" role="document" aria-label={label}>
    {doc.lines.map((line, i) => {
      if (line.type === "blank") return <div key={i} className="chart-gap" aria-hidden="true" />;
      if (line.type === "comment") return <p key={i} className="chart-comment">{line.text}</p>;
      if (line.type === "section") return line.edge === "start" ? <p key={i} className="chart-comment">{SECTIONS[line.name] ?? line.name}</p> : null;
      if (line.segments.every((s) => !s.text.trim()))
        return <div key={i} className="chart-line chords-only">{line.segments.map((s, j) => s.chord ? <span key={j} className="chart-chord">{s.chord}</span> : null)}</div>;
      return <div key={i} className="chart-line">
        {words(line.segments).map((word, j) => <span key={j} className="chart-word">
          {word.map((s, k) => <span key={k} className="chart-seg">
            {s.chord !== undefined && <span className="chart-chord">{s.chord || NBSP}</span>}
            <span className="chart-text">{s.text || NBSP}</span>
          </span>)}
        </span>)}
      </div>;
    })}
  </div>;
}
const SECTIONS: Record<string, string> = { chorus: "Refrão", verse: "Estrofe", bridge: "Ponte", tab: "Tablatura", grid: "Grade" };
