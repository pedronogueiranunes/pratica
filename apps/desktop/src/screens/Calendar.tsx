import { useMemo, useState } from "react";
import { dayKey, logsByDay, practicedSeconds, type PracticeRecord } from "@gx/core";
import { useApp } from "../lib/app-state";
import { usePractice } from "../lib/practice-state";
import { useNav } from "../lib/nav";

function metric(log: PracticeRecord) {
  if (log.bpm !== undefined) return `${log.bpm} bpm`;
  if (log.count !== undefined) return `${log.count} ${log.metric?.unidade ?? "vezes"}`;
  if (log.seconds !== undefined) return log.metric?.unidade === "min" ? `${log.seconds / 60} min` : `${log.seconds} s`;
  return "Feito";
}
export function Calendar() {
  const { logs, ready } = usePractice();
  const { catalog, settings } = useApp();
  const nav = useNav();
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selected, setSelected] = useState(() => dayKey(new Date()));
  const days = useMemo(() => logsByDay(logs), [logs]);
  const byId = useMemo(() => new Map(catalog.exercicios.map((e) => [e.id, e])), [catalog]);
  const year = month.getFullYear(), index = month.getMonth();
  const offset = (month.getDay() + 6) % 7;
  const cells = Math.ceil((offset + new Date(year, index + 1, 0).getDate()) / 7) * 7;
  const detail = days.get(selected) ?? [];
  const seconds = practicedSeconds(detail);
  const unknown = detail.some((l) => l.durationSeconds === undefined && l.durationMin === undefined);
  const fmt = new Intl.DateTimeFormat(settings.locale, { month: "long", year: "numeric" });
  const dateFmt = new Intl.DateTimeFormat(settings.locale, { weekday: "long", day: "numeric", month: "long" });
  const choose = (date: Date) => { setSelected(dayKey(date)); setMonth(new Date(date.getFullYear(), date.getMonth(), 1)); };
  const key = (event: React.KeyboardEvent<HTMLButtonElement>, date: Date) => {
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (event.key in steps) {
      event.preventDefault(); event.stopPropagation();
      const next = new Date(date); next.setDate(next.getDate() + steps[event.key]!); choose(next);
      requestAnimationFrame(() => document.getElementById(`day-${dayKey(next)}`)?.focus());
    }
  };
  return <div className="screen">
    <header className="screen-head"><h1>Calendário</h1><span className="sub">Sua prática, dia a dia.</span></header>
    {!ready && <p role="status">Carregando práticas…</p>}
    <div className="panels two calendar-layout">
      <section className="panel" aria-label="Calendário mensal">
        <div className="panel-head"><h2 aria-live="polite">{fmt.format(month)}</h2><span className="spacer" />
          <button className="btn icon" aria-label="Mês anterior" onClick={() => setMonth(new Date(year, index - 1, 1))}><Chevron back /></button>
          <button className="btn" onClick={() => choose(new Date())}>Hoje</button>
          <button className="btn icon" aria-label="Próximo mês" onClick={() => setMonth(new Date(year, index + 1, 1))}><Chevron /></button>
        </div>
        <div className="calendar-week" aria-hidden="true">{["seg", "ter", "qua", "qui", "sex", "sáb", "dom"].map((d) => <span key={d}>{d}</span>)}</div>
        <div className="calendar-days" role="group" aria-label={fmt.format(month)}>
          {Array.from({ length: cells }, (_, i) => {
            const date = new Date(year, index, i - offset + 1), day = dayKey(date);
            const count = days.get(day)?.length ?? 0;
            return <button id={`day-${day}`} key={day} className={`calendar-day${date.getMonth() !== index ? " outside" : ""}${day === dayKey(new Date()) ? " today" : ""}`}
              aria-pressed={selected === day} aria-label={`${dateFmt.format(date)}, ${count} práticas`} onClick={() => choose(date)} onKeyDown={(e) => key(e, date)}>
              <span>{date.getDate()}</span><span className={`calendar-mark${count ? " practiced" : ""}`} aria-hidden="true" />
            </button>;
          })}
        </div>
        <p className="muted small">O ponto marca os dias com prática. Use as setas para escolher um dia.</p>
      </section>
      <section className="panel" aria-label="Práticas do dia">
        <div className="panel-head"><h2>{dateFmt.format(new Date(`${selected}T12:00:00`))}</h2></div>
        {detail.length ? <>
          <p className="num muted">{detail.length} práticas · {seconds ? `${Number((seconds / 60).toFixed(1))} min registrados` : "tempo não informado"}</p>
          {unknown && seconds > 0 && <p className="muted small">Algumas práticas estão sem duração.</p>}
          <div className="list">{detail.map((log) => <div key={log.id} className="calendar-log">
            <button className="btn ghost calendar-exercise" onClick={() => nav.openExercise(log.exerciseId)}>{byId.get(log.exerciseId)?.nome ?? log.exerciseId}</button>
            <div className="num small muted">{new Intl.DateTimeFormat(settings.locale, { hour: "2-digit", minute: "2-digit" }).format(new Date(log.at))} · {metric(log)}{log.durationSeconds !== undefined ? ` · ${Number((log.durationSeconds / 60).toFixed(1))} min de prática` : ""}</div>
            {log.note && <p className="practice-log-note">{log.note}</p>}
          </div>)}</div>
        </> : <p className="muted">Nenhuma prática registrada neste dia.</p>}
      </section>
    </div>
  </div>;
}
function Chevron({ back = false }: { back?: boolean }) {
  return <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={back ? "M12 5 7 10l5 5" : "m8 5 5 5-5 5"} /></svg>;
}
