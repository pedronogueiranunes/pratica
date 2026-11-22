// Converte cifra colada (acordes na linha de cima, letra embaixo) para ChordPro.
// Não completa nem corrige dados musicais: só reorganiza o que foi colado.
import { isChord } from "./chords";

const SECTION = /^\[([^\]]+)\]\s*(.*)$/;
const blank = (line: string) => line.replace(/[\s ]/g, "") === "";
const REPEAT = /^\(?\d+x\)?$|^x\d+$|^\|+$/i;

function chordTokens(text: string): string[] | null {
  const tokens = text.trim().split(/[\s ]+/).filter(Boolean);
  if (!tokens.length) return null;
  const chords = tokens.filter((t) => !REPEAT.test(t));
  return chords.length && chords.every(isChord) ? tokens : null;
}

export const isChordLine = (line: string) => !blank(line) && chordTokens(line) !== null;

/** Posições (coluna) de cada acorde na linha. */
function chordColumns(line: string): { col: number; chord: string }[] {
  const out: { col: number; chord: string }[] = [];
  const re = /[^\s ]+/g;
  for (let m; (m = re.exec(line)); ) out.push({ col: m.index, chord: m[0] });
  return out;
}

function inlineChords(line: string): string {
  return chordColumns(line).map(({ chord }) => (REPEAT.test(chord) ? chord : `[${chord}]`)).join(" ");
}

/** Junta a linha de acordes com a letra, inserindo cada acorde na coluna em que estava. */
export function mergeChordsIntoLyrics(chordLine: string, lyric: string): string {
  const cols = chordColumns(chordLine);
  const width = Math.max(lyric.length, ...cols.map((c) => c.col));
  let text = lyric.padEnd(width, " ");
  for (const { col, chord } of [...cols].reverse()) text = `${text.slice(0, col)}[${chord}]${text.slice(col)}`;
  return text.trimEnd();
}

export interface ImportResult {
  chordpro: string;
  /** Linhas que o parser não teve certeza, para a prévia destacar. */
  warnings: { line: number; message: string }[];
}

export function plainTextToChordPro(input: string, meta: { title?: string; artist?: string } = {}): ImportResult {
  const lines = input.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  const warnings: ImportResult["warnings"] = [];
  if (meta.title) out.push(`{title: ${meta.title}}`);
  if (meta.artist) out.push(`{artist: ${meta.artist}}`);
  if (out.length) out.push("");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.replace(/ /g, " ").trimEnd();
    if (blank(line)) {
      if (out.length && out[out.length - 1] !== "") out.push("");
      continue;
    }
    const section = SECTION.exec(line.trim());
    if (section) {
      out.push(`{comment: ${section[1]!.trim()}}`);
      if (section[2] && isChordLine(section[2])) out.push(inlineChords(section[2]));
      else if (section[2]) out.push(section[2]);
      continue;
    }
    if (isChordLine(line)) {
      const next = lines[i + 1]?.replace(/ /g, " ").trimEnd();
      if (next !== undefined && !blank(next) && !isChordLine(next) && !SECTION.test(next.trim())) {
        out.push(mergeChordsIntoLyrics(line, next));
        i++;
      } else out.push(inlineChords(line));
      continue;
    }
    if (/^\(.*\)$/.test(line.trim()) && lines.slice(i + 1).every(blank)) {
      out.push(`{comment: ${line.trim().slice(1, -1)}}`);
      continue;
    }
    if (line.trim().split(/\s+/).some(isChord) && line.trim().split(/\s+/).length <= 3)
      warnings.push({ line: i + 1, message: "Parece ter acordes misturados ao texto." });
    out.push(line);
  }
  while (out[out.length - 1] === "") out.pop();
  return { chordpro: `${out.join("\n")}\n`, warnings };
}
