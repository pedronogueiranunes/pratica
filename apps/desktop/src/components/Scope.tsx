import { useEffect, useRef } from "react";

/** Osciloscópio: guitarra limpa (cinza) e saída do Amp (laranja), alinhados por cruzamento de zero. */
export function Scope({ input, output, running }: { input: number[]; output: number[]; running: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scale = useRef(1);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const dpr = window.devicePixelRatio || 1;
    const w = el.clientWidth, h = el.clientHeight;
    if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) { el.width = Math.round(w * dpr); el.height = Math.round(h * dpr); }
    const g = el.getContext("2d");
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const css = getComputedStyle(el);
    const line = css.getPropertyValue("--line").trim() || "#2a2a2a", dim = css.getPropertyValue("--fg-3").trim() || "#75716a", accent = css.getPropertyValue("--accent").trim() || "#ff5a1f";
    g.lineWidth = 1; g.strokeStyle = line;
    for (const f of [0.25, 0.5, 0.75]) { g.beginPath(); g.moveTo(0, h * f); g.lineTo(w, h * f); g.stroke(); }
    for (let i = 1; i < 8; i++) { g.beginPath(); g.moveTo((w * i) / 8, 0); g.lineTo((w * i) / 8, h); g.stroke(); }
    if (!running || output.length < 32) return;
    const win = Math.floor(output.length * 0.75);
    let start = 0;
    const lead = output.length - win;
    for (let i = 1; i < lead; i++) if (output[i - 1]! < 0 && output[i]! >= 0) { start = i; break; }
    const peak = Math.max(0.02, ...output.map(Math.abs), ...input.map(Math.abs));
    scale.current += (1 / peak - scale.current) * 0.15;
    const draw = (data: number[], color: string, width: number) => {
      g.strokeStyle = color; g.lineWidth = width; g.beginPath();
      for (let i = 0; i < win; i++) {
        const x = (i / (win - 1)) * w, y = h / 2 - (data[start + i]! * scale.current * 0.9 * h) / 2;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    };
    draw(input, dim, 1);
    draw(output, accent, 1.75);
  }, [input, output, running]);
  return <canvas ref={canvas} className="scope" role="img" aria-label="Forma de onda da guitarra e da saída do Amp" />;
}
