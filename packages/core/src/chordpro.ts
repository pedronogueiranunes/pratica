// Leitura e escrita de ChordPro (subconjunto usado pelo app).
import { keyUsesFlats, transposeChord } from "./chords";

export type ChordProLine =
  | { type: "lyrics"; segments: { chord?: string; text: string }[] }
  | { type: "comment"; text: string }
  | { type: "section"; name: string; edge: "start" | "end" }
  | { type: "blank" };

export interface ChordProDoc {
  meta: { title?: string; artist?: string; key?: string; tempo?: number; time?: string; capo?: number };
  lines: ChordProLine[];
}

const DIRECTIVE = /^\{\s*([a-z_]+)\s*(?::\s*(.*?))?\s*\}$/i;
const ALIAS: Record<string, string> = { t: "title", st: "artist", subtitle: "artist", c: "comment", soc: "start_of_chorus", eoc: "end_of_chorus", sov: "start_of_verse", eov: "end_of_verse", sob: "start_of_bridge", eob: "end_of_bridge" };

export function parseChordPro(source: string): ChordProDoc {
  const doc: ChordProDoc = { meta: {}, lines: [] };
  for (const raw of source.replace(/\r\n?/g, "\n").replace(/\n$/, "").split("\n")) {
    const line = raw.trimEnd();
    if (line.startsWith("#")) continue;
    if (!line.trim()) { doc.lines.push({ type: "blank" }); continue; }
    const d = DIRECTIVE.exec(line.trim());
    if (d) {
      const name = ALIAS[d[1]!.toLowerCase()] ?? d[1]!.toLowerCase();
      const value = d[2] ?? "";
      if (name === "title" || name === "artist" || name === "key" || name === "time") doc.meta[name] = value;
      else if (name === "tempo" || name === "capo") {
        const n = Number(value);
        if (Number.isFinite(n) && n > 0) doc.meta[name] = n;
      } else if (name === "comment" || name === "comment_italic" || name === "ci") doc.lines.push({ type: "comment", text: value });
      else if (/^(start|end)_of_/.test(name)) doc.lines.push({ type: "section", name: name.replace(/^(start|end)_of_/, ""), edge: name.startsWith("start") ? "start" : "end" });
      continue;
    }
    const segments: { chord?: string; text: string }[] = [];
    const re = /\[([^\]]*)\]/g;
    let last = 0, chord: string | undefined;
    for (let m; (m = re.exec(line)); ) {
      if (m.index > last || chord !== undefined) segments.push(chord !== undefined ? { chord, text: line.slice(last, m.index) } : { text: line.slice(last, m.index) });
      chord = m[1]!;
      last = m.index + m[0].length;
    }
    segments.push(chord !== undefined ? { chord, text: line.slice(last) } : { text: line.slice(last) });
    doc.lines.push({ type: "lyrics", segments: segments.filter((s) => s.chord !== undefined || s.text) });
  }
  return doc;
}

export function serializeChordPro(doc: ChordProDoc): string {
  const out: string[] = [];
  const m = doc.meta;
  for (const k of ["title", "artist", "key", "tempo", "time", "capo"] as const) if (m[k] !== undefined) out.push(`{${k}: ${m[k]}}`);
  for (const l of doc.lines) {
    if (l.type === "blank") out.push("");
    else if (l.type === "comment") out.push(`{comment: ${l.text}}`);
    else if (l.type === "section") out.push(`{${l.edge}_of_${l.name}}`);
    else out.push(l.segments.map((s) => (s.chord !== undefined ? `[${s.chord}]` : "") + s.text).join(""));
  }
  return `${out.join("\n")}\n`;
}

export function chordsUsed(doc: ChordProDoc): string[] {
  const seen = new Set<string>();
  for (const l of doc.lines) if (l.type === "lyrics") for (const s of l.segments) if (s.chord) seen.add(s.chord);
  return [...seen];
}

/** Transposição só de exibição: não altera a cifra salva. */
export function transposeDoc(doc: ChordProDoc, semitones: number, flats?: boolean): ChordProDoc {
  if (!semitones) return doc;
  if (flats === undefined) {
    // Sem escolha explícita, a grafia segue o tom de destino: o da cifra ou o primeiro acorde.
    const reference = doc.meta.key ?? chordsUsed(doc)[0];
    flats = reference ? keyUsesFlats(transposeChord(reference, semitones, false)) : false;
  }
  const meta = { ...doc.meta };
  if (meta.key) meta.key = transposeChord(meta.key, semitones, flats);
  return {
    meta,
    lines: doc.lines.map((l) => (l.type === "lyrics" ? { ...l, segments: l.segments.map((s) => (s.chord ? { ...s, chord: transposeChord(s.chord, semitones, flats) } : s)) } : l)),
  };
}
