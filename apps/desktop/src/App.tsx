import { useEffect, useState, type ReactNode } from "react";
import { useApp } from "./lib/app-state";
import { useMetronome } from "./lib/metronome";
import { isNative } from "./lib/engine";
import {
  IconCalendar,
  IconCompanion,
  IconLab,
  IconMusic,
  IconChords,
  IconRoadmap,
  IconSettings,
  IconToday,
  IconTools,
  IconAmp,
} from "./icons";
import { Calendar } from "./screens/Calendar";
import { usePractice } from "./lib/practice-state";
import { Today } from "./screens/Today";
import { Roadmap } from "./screens/Roadmap";
import { Tools } from "./screens/Tools";
import { Amp } from "./screens/Amp";
import { Settings } from "./screens/Settings";
import { Lab } from "./screens/Lab";
import { Placeholder } from "./screens/Placeholder";
import { Exercise } from "./screens/Exercise";
import { Songs } from "./screens/Songs";
import { Chords, presetTrainer } from "./screens/Chords";
import { NavContext } from "./lib/nav";
import type { MessageKey } from "@gx/core";

type Route = "exercicio" | "hoje" | "roadmap" | "calendario" | "musicas" | "acordes" | "companion" | "ferramentas" | "amp" | "ajustes" | "laboratorio";

const NAV: { id: Route; icon: ReactNode; key: MessageKey }[] = [
  { id: "hoje", icon: <IconToday />, key: "nav.hoje" },
  { id: "roadmap", icon: <IconRoadmap />, key: "nav.roadmap" },
  { id: "calendario", icon: <IconCalendar />, key: "nav.calendario" },
  { id: "musicas", icon: <IconMusic />, key: "nav.musicas" },
  { id: "acordes", icon: <IconChords />, key: "nav.acordes" },
  { id: "companion", icon: <IconCompanion />, key: "nav.companion" },
  { id: "ferramentas", icon: <IconTools />, key: "nav.ferramentas" },
  ...(isNative ? [{ id: "amp" as Route, icon: <IconAmp />, key: "nav.amp" as MessageKey }] : []),
];
const BOTTOM: { id: Route; icon: ReactNode; key: MessageKey }[] = [
  { id: "ajustes", icon: <IconSettings />, key: "nav.ajustes" },
  { id: "laboratorio", icon: <IconLab />, key: "nav.laboratorio" },
];

function isTyping(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}

export function App() {
  const { t, settingsError } = useApp();
  const { error: storageError, ready } = usePractice();
  const m = useMetronome();
  const [route, setRoute] = useState<Route>(() => (localStorage.getItem("pratica.route") as Route) || "hoje");

  const [exerciseId, setExerciseId] = useState<string | null>(() => localStorage.getItem("pratica.exercise"));
  const [prevRoute, setPrevRoute] = useState<Route>("hoje");
  useEffect(() => {
    localStorage.setItem("pratica.route", route);
    if (exerciseId) localStorage.setItem("pratica.exercise", exerciseId);
  }, [route, exerciseId]);
  const nav = {
    openExercise: (id: string) => {
      setPrevRoute(route === "exercicio" ? prevRoute : route);
      setExerciseId(id);
      setRoute("exercicio");
      document.querySelector(".main")?.scrollTo(0, 0);
    },
    back: () => setRoute(prevRoute),
    openChordTrainer: (chords: string[]) => { presetTrainer(chords); setRoute("acordes"); document.querySelector(".main")?.scrollTo(0, 0); },
    openChordSequence: () => { try { localStorage.setItem("pratica.chords.tab", "sequencia"); } catch {} setRoute("acordes"); document.querySelector(".main")?.scrollTo(0, 0); },
  };
  useEffect(() => {
    if (!isNative) document.body.classList.add("no-vibrancy");
  }, []);

  // Atalhos: espaço liga e desliga o metrônomo, setas mudam o bpm
  // (com Shift, de 4 em 4), Cmd+1 a 9 trocam de tela.
  useEffect(() => {
    const all = [...NAV, ...BOTTOM];
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey && /^[1-9]$/.test(e.key)) {
        const r = all[Number(e.key) - 1];
        if (r) {
          e.preventDefault();
          setRoute(r.id);
        }
        return;
      }
      if (e.defaultPrevented || isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === "Space" && !(e.target as HTMLElement)?.closest("button, a, summary, [role=button]")) {
        e.preventDefault();
        m.toggle();
      } else if (e.key === "ArrowUp" || e.key === "ArrowRight") {
        e.preventDefault();
        m.setBpm(m.bpm + (e.shiftKey ? 4 : 1));
      } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
        e.preventDefault();
        m.setBpm(m.bpm - (e.shiftKey ? 4 : 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [m]);

  // No celular, a barra vira abas embaixo: as principais ficam à vista, o resto vai para "Mais".
  const PRIMARY: Route[] = ["hoje", "roadmap", "musicas", "acordes", "ferramentas", "amp"];
  const [moreOpen, setMoreOpen] = useState(false);
  const isCurrent = (id: Route) => route === id || (route === "exercicio" && prevRoute === id);
  const navButton = (n: { id: Route; icon: ReactNode; key: MessageKey }, i: number) => (
    <button key={n.id} className={PRIMARY.includes(n.id) ? "nav-primary" : "nav-secondary"} aria-current={isCurrent(n.id) ? "page" : undefined} onClick={() => { setRoute(n.id); setMoreOpen(false); }}>
      {n.icon}
      {t(n.key)}
      <span className="kbd">⌘{i + 1}</span>
    </button>
  );

  return (
    <NavContext.Provider value={nav}>
    <div className="shell">
      <aside className="sidebar">
        <div className="drag" data-tauri-drag-region />
        <div className="wordmark" aria-hidden="true">
          <i />
          prática
        </div>
        <nav className={`nav${moreOpen ? " more-open" : ""}`} id="nav-sheet" aria-label="Telas">
          {NAV.map((n, i) => navButton(n, i))}
          <div className="nav-sep" />
          {BOTTOM.map((n, i) => navButton(n, i + NAV.length))}
          <button className={`nav-more${[...NAV, ...BOTTOM].some((n) => !PRIMARY.includes(n.id) && isCurrent(n.id)) ? " has-current" : ""}`} aria-expanded={moreOpen} aria-controls="nav-sheet" onClick={() => setMoreOpen((v) => !v)}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><circle cx="4.5" cy="10" r="1.2" /><circle cx="10" cy="10" r="1.2" /><circle cx="15.5" cy="10" r="1.2" /></svg>
            Mais
          </button>
        </nav>
        <div className="sidebar-foot">
          <div className="live">
            <span className={`dot${m.running ? " on" : ""}`} />
            <span className="num">
              {m.bpm} bpm {m.running ? "" : "· parado"}
            </span>
          </div>
        </div>
      </aside>
      <main className="main">
        <div className="drag" data-tauri-drag-region />
        {(storageError || settingsError) && <p className="storage-status error-text" role="alert">{storageError || settingsError}</p>}
        {!ready && !storageError && <p className="storage-status muted" role="status">Carregando seus dados…</p>}
        {route === "exercicio" && exerciseId && <Exercise id={exerciseId} />}
        {route === "hoje" && <Today />}
        {route === "roadmap" && <Roadmap />}
        {route === "ferramentas" && <Tools />}
        {route === "amp" && <Amp />}
        {route === "ajustes" && <Settings />}
        {route === "laboratorio" && <Lab />}
        {route === "calendario" && <Calendar />}
        {route === "musicas" && <Songs />}
        {route === "acordes" && <Chords />}
        {route === "companion" && (
          <Placeholder title={t("nav.companion")} icon={<IconCompanion size={40} />} phase={5}>
            A cifra rola no tempo da música enquanto você toca.
          </Placeholder>
        )}
      </main>
    </div>
    </NavContext.Provider>
  );
}
