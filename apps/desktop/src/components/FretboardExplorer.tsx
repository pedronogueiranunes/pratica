import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { chordNoteName, chordTones, FRETBOARD_STRINGS, fretboardPitches, fretFrequencies, fretPitch, identifyFretChord, SCALE_PATTERNS, scaleTones, selectFret, shapesFor, type Diagram, type FretPosition, type ScalePatternId, type StringNo } from "@gx/core";
import { useApp } from "../lib/app-state";
import { engine, onEngine } from "../lib/engine";
import { IconPlay } from "../icons";

const key = (p: FretPosition) => `${p.string}:${p.fret}`;
const NOTES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
type Mode = "all" | "chord" | "scale";
const W = 52, H = 48, X = 64, Y = 48;

/** Braço de afinação padrão. Seleção manual, sem estimar notas ou pedir microfone. */
export function FretboardExplorer({ diagram, embedded = false }: { diagram?: Diagram; embedded?: boolean }) {
  const { settings } = useApp();
  const [mode, setMode] = useState<Mode>(diagram ? "chord" : "all");
  const [chord, setChord] = useState(diagram?.name ?? "C"), [root, setRoot] = useState("A");
  const [scale, setScale] = useState<ScalePatternId>("minor-pentatonic"), [flats, setFlats] = useState(false);
  const [selected, setSelected] = useState<FretPosition[]>(() => diagram?.notes.map((n) => ({ string: n.string, fret: n.fret })) ?? []);
  const [focus, setFocus] = useState("6:0"), [volume, setVolume] = useState(.4), [sounding, setSounding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cells = useRef(new Map<string, SVGGElement>()), timer = useRef(0), playing = useRef(false), generation = useRef(0);
  const stop = () => { generation.current++; window.clearTimeout(timer.current); setSounding(false); if (playing.current) { playing.current = false; void engine.stopPreview().catch(() => {}); } };
  useEffect(() => {
    const hide = () => { if (document.hidden) stop(); };
    const off = onEngine((e) => { if (e.type === "error" && e.direction !== "input" && playing.current) { stop(); setError(`Não deu para tocar. Confira a saída em Ajustes. ${e.message}`); } });
    document.addEventListener("visibilitychange", hide);
    return () => { stop(); off(); document.removeEventListener("visibilitychange", hide); };
  }, []);
  useEffect(() => { if (diagram) { setChord(diagram.name); setMode("chord"); setSelected(diagram.notes.map((n) => ({ string: n.string, fret: n.fret }))); setError(null); } }, [diagram]);
  useEffect(() => { stop(); }, [settings.tuner.a4]);
  const chordInfo = useMemo(() => mode === "chord" ? chordTones(chord.trim()) : null, [mode, chord]);
  const scaleInfo = useMemo(() => mode === "scale" ? scaleTones(root, scale) : null, [mode, root, scale]);
  const pcs = useMemo(() => new Set(chordInfo ? chordInfo.intervals.map((n) => (chordInfo.root + n) % 12) : scaleInfo?.pcs ?? []), [chordInfo, scaleInfo]);
  const fundamental = chordInfo?.root ?? scaleInfo?.root;
  const map = useMemo(() => fretboardPitches(flats), [flats]);
  const matches = useMemo(() => identifyFretChord(selected, flats), [selected, flats]);
  const selectionKeys = new Set(selected.map(key));
  const toggle = (p: FretPosition) => { stop(); setError(null); setSelected((current) => selectFret(current, p)); };
  const keyboard = (e: KeyboardEvent<SVGGElement>, p: FretPosition) => {
    let string = p.string, fret = p.fret;
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); e.stopPropagation(); toggle(p); return; }
    if (e.key === "ArrowLeft") fret = Math.max(0, fret - 1);
    else if (e.key === "ArrowRight") fret = Math.min(24, fret + 1);
    else if (e.key === "ArrowUp") string = Math.max(1, string - 1) as StringNo;
    else if (e.key === "ArrowDown") string = Math.min(6, string + 1) as StringNo;
    else if (e.key === "Home") fret = 0;
    else if (e.key === "End") fret = 24;
    else return;
    e.preventDefault(); e.stopPropagation();
    const id = key({ string, fret }); setFocus(id);
    const cell = cells.current.get(id); cell?.focus(); cell?.scrollIntoView({ block: "nearest", inline: "nearest" });
    const viewport = cell?.closest<HTMLElement>(".fret-scroll");
    if (viewport && fret === 0) viewport.scrollLeft = 0;
    if (viewport && fret === 24) viewport.scrollLeft = viewport.scrollWidth;
  };
  const play = async () => {
    stop(); setError(null); if (!selected.length || volume === 0) return;
    const request = generation.current; playing.current = true;
    try {
      await engine.previewChord(settings.metronome.outputDeviceId ?? null, fretFrequencies(selected, settings.tuner.a4), volume);
      if (request !== generation.current) return;
      setSounding(true); timer.current = window.setTimeout(() => { playing.current = false; setSounding(false); }, 1450);
    } catch (e) { if (request === generation.current) { playing.current = false; setError(`Não deu para tocar. ${String(e)}`); } }
  };
  const loadShape = () => {
    const shape = shapesFor(chord.trim()).shapes[0];
    if (shape) { stop(); setSelected(shape.notes.map((n) => ({ string: n.string, fret: n.fret }))); setError(null); }
    else setError("Não há forma disponível para esse nome.");
  };
  return <section className={`fret-explorer${embedded ? " embedded" : " panel"}`} aria-label="Braço interativo">
    {!embedded && <h2>Braço</h2>}
    <p className="muted small">Afinação padrão, 24 casas. Mi agudo em cima. Selecione uma nota por corda para identificar um acorde.</p>
    <div className="fret-controls">
      <label>Destacar<select aria-label="Destacar no braço" value={mode} onChange={(e) => setMode(e.target.value as Mode)}><option value="all">Todas as notas</option><option value="chord">Acorde</option><option value="scale">Escala</option></select></label>
      {mode === "chord" && <><label>Acorde<input type="text" aria-label="Acorde no braço" value={chord} onChange={(e) => setChord(e.target.value)} maxLength={64} /></label><button className="btn" disabled={!chordInfo} onClick={loadShape}>Usar uma forma</button></>}
      {mode === "scale" && <><label>Fundamental<select aria-label="Fundamental da escala" value={root} onChange={(e) => setRoot(e.target.value)}>{NOTES.map((n) => <option key={n}>{n}</option>)}</select></label><label>Escala<select aria-label="Escala no braço" value={scale} onChange={(e) => setScale(e.target.value as ScalePatternId)}>{SCALE_PATTERNS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label></>}
      <label className="inline-check"><input type="checkbox" checked={flats} onChange={(e) => setFlats(e.target.checked)} />Usar bemóis</label>
    </div>
    {mode === "chord" && !chordInfo && <p role="status" className="muted small">Não reconheci esse acorde. Tente C, Am ou D/F#.</p>}
    <p className="muted small">Arraste a barra para ver as outras casas. No teclado: setas navegam, Enter ou Espaço seleciona; Home e End vão às pontas.</p>
    <div className="fret-scroll">
      <svg className="fret-full" width={X + 25 * W + 20} height={Y + 6 * H + 12} viewBox={`0 0 ${X + 25 * W + 20} ${Y + 6 * H + 12}`} role="grid" aria-label="Notas do braço, cordas 1 a 6 e casas 0 a 24" aria-rowcount={6} aria-colcount={25}>
        <g aria-hidden="true" className="fret-grid-lines">
          {Array.from({ length: 25 }, (_, fret) => <g key={fret}><text x={X + fret * W} y={22} textAnchor="middle">{fret}</text><line x1={X + (fret + .5) * W} x2={X + (fret + .5) * W} y1={Y - 22} y2={Y + 5 * H + 22} className={fret === 0 ? "fret-nut" : undefined} /></g>)}
          {FRETBOARD_STRINGS.map((s) => <g key={s}><text x={20} y={Y + (s - 1) * H + 4}>{s}</text><line x1={X - 25} x2={X + 24 * W + 25} y1={Y + (s - 1) * H} y2={Y + (s - 1) * H} /></g>)}
          {[3, 5, 7, 9, 12, 15, 17, 19, 21, 24].map((f) => <g key={f}><circle cx={X + f * W} cy={Y + 2.5 * H} r={3} />{f % 12 === 0 && <circle cx={X + f * W} cy={Y + 3.5 * H} r={3} />}</g>)}
        </g>
        {FRETBOARD_STRINGS.map((s) => <g key={s} role="row" aria-rowindex={s} aria-label={`Corda ${s}`}>
          {map.filter((p) => p.string === s).map((p) => {
            const id = key(p), chosen = selectionKeys.has(id), highlighted = mode === "all" || pcs.has(p.pc), isRoot = p.pc === fundamental;
            const label = mode === "chord" && pcs.has(p.pc) ? fretPitch(p, flats, chord.trim()).label : p.label;
            const note = mode === "chord" && pcs.has(p.pc) ? chordNoteName(chord.trim(), p.pc) : label.replace(/-?\d+$/, "");
            return <g key={id} ref={(el) => { if (el) cells.current.set(id, el); else cells.current.delete(id); }} role="gridcell" aria-colindex={p.fret + 1} aria-selected={chosen} aria-label={`${label}, corda ${s}, casa ${p.fret}`} tabIndex={focus === id ? 0 : -1} transform={`translate(${X + p.fret * W} ${Y + (s - 1) * H})`} className={`fret-cell${chosen ? " chosen" : ""}${highlighted ? " highlighted" : ""}${isRoot ? " root" : ""}${chosen && sounding ? " sounding" : ""}`} onFocus={() => setFocus(id)} onKeyDown={(e) => keyboard(e, p)} onClick={(e) => { e.currentTarget.focus(); setFocus(id); toggle(p); }}>
              <rect className="fret-hit" x={-W / 2} y={-H / 2} width={W} height={H} rx={6} /><circle r={18} /><text dy=".35em" textAnchor="middle">{note}</text>
            </g>;
          })}
        </g>)}
      </svg>
    </div>
    <p className="small muted">Fundamental com contorno laranja. Notas escolhidas preenchidas. Destaque de escala/acorde não é uma sugestão de digitação.</p>
    <div className="fret-controls">
      <button className="btn primary" disabled={!selected.length || volume === 0} onClick={() => void play()}><IconPlay />Ouvir seleção</button>
      <button className="btn" disabled={!selected.length} onClick={() => { stop(); setSelected([]); }}>Limpar notas</button>
      {diagram && <button className="btn" onClick={() => { stop(); setSelected(diagram.notes.map((n) => ({ string: n.string, fret: n.fret }))); }}>Repor forma da cifra</button>}
      <label className="chord-preview-volume">Volume<input type="range" min="0" max="100" step="5" aria-label="Volume do braço" value={volume * 100} onChange={(e) => { stop(); setVolume(Number(e.target.value) / 100); }} /><span className="num">{Math.round(volume * 100)}%</span></label>
    </div>
    <div className="fret-result" role="status">
      <p>{selected.length ? `Notas: ${selected.map((p) => fretPitch(p, flats).label).join(" · ")}` : "Nenhuma nota escolhida."}</p>
      {selected.length > 0 && <p>{matches.length ? `Compatíveis: ${matches.map((m) => m.name).join(" · ")}` : "Sem correspondência exata no catálogo. Nenhuma nota foi completada."}</p>}
    </div>
    {error && <p role="alert" className="error-text">{error}</p>}
  </section>;
}
