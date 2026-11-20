// Tablatura com o passo atual em destaque. Rolagem acompanha o passo.

import { useEffect, useRef } from "react";
import type { TabStep } from "@gx/core";

const LABELS = ["e", "B", "G", "D", "A", "E"];
const GROUP = 8;

export function Tab({ steps, current, onSeek }: { steps: TabStep[]; current: number; onSeek: (i: number) => void }) {
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrap.current?.querySelector<HTMLElement>(`[data-i="${current}"]`);
    if (!el || !wrap.current) return;
    const box = wrap.current;
    const target = el.offsetLeft - box.clientWidth / 3;
    box.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [current]);

  return (
    <div className="tab" ref={wrap} role="group" aria-label="Tablatura">
      <div className="tab-labels" aria-hidden="true">
        {LABELS.map((l, i) => (
          <span key={i}>{l}</span>
        ))}
      </div>
      {steps.map((step, i) => (
        <button
          key={i}
          data-i={i}
          className={`tab-col${i === current ? " on" : ""}${i % GROUP === 0 && i > 0 ? " bar" : ""}`}
          onClick={() => onSeek(i)}
          aria-label={`Passo ${i + 1}${step.label ? `, ${step.label}` : ""}`}
        >
          {[1, 2, 3, 4, 5, 6].map((s) => {
            const n = step.notes.find((x) => x.string === s);
            return (
              <span key={s} className="tab-cell">
                {n ? (
                  <>
                    {step.technique && step.notes.length === 1 ? <em>{step.technique}</em> : null}
                    {n.fret}
                  </>
                ) : null}
              </span>
            );
          })}
          {step.label ? <span className="tab-label">{step.label}</span> : null}
        </button>
      ))}
    </div>
  );
}
