import { useEffect, useRef, useState } from "react";

const FLOOR = -60;
const toDb = (peak: number) => (peak > 1e-6 ? Math.max(FLOOR, 20 * Math.log10(peak)) : FLOOR);

/** Medidor de pico em dBFS com segura de pico e aviso de clip. */
export function Meter({ label, peak, running }: { label: string; peak: number; running: boolean }) {
  const [shown, setShown] = useState(FLOOR);
  const [hold, setHold] = useState(FLOOR);
  const holdAt = useRef(0);
  useEffect(() => {
    if (!running) { setShown(FLOOR); setHold(FLOOR); return; }
    const db = toDb(peak);
    setShown((s) => (db > s ? db : Math.max(db, s - 3)));
    const now = performance.now();
    setHold((h) => { if (db >= h) { holdAt.current = now; return db; } return now - holdAt.current > 1200 ? Math.max(db, h - 1.5) : h; });
  }, [peak, running]);
  const pos = (db: number) => `${Math.round(((db - FLOOR) / -FLOOR) * 1000) / 10}%`;
  const hot = hold > -1;
  return <div className="meter" role="meter" aria-label={label} aria-valuemin={FLOOR} aria-valuemax={0} aria-valuenow={Math.round(shown)}>
    <div className="meter-head"><span>{label}</span><span className={`num${hot ? " is-hot" : ""}`}>{running && hold > FLOOR ? `${hold.toFixed(0)} dB` : "-∞"}</span></div>
    <div className="meter-bar">
      <span className="meter-fill" style={{ width: pos(shown) }} />
      <span className={`meter-hold${hot ? " is-hot" : ""}`} style={{ left: pos(hold) }} />
      {[-48, -36, -24, -12, -6].map((t) => <span key={t} className="meter-tick" style={{ left: pos(t) }} />)}
    </div>
  </div>;
}
