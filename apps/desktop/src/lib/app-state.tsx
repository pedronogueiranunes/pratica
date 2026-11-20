// Estado global leve: ajustes (salvos no aparelho), tradução e catálogo.
// Na Fase 1 os ajustes e registros passam para o SQLite via Rust.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  createTranslator,
  defaultSettings,
  parseCatalog,
  type Catalog,
  type Settings,
  type Translate,
} from "@gx/core";
import seed from "../../../../data/exercises.seed.json";

const KEY = "pratica.settings.v1";

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      ...defaultSettings,
      ...parsed,
      metronome: { ...defaultSettings.metronome, ...parsed.metronome },
      tuner: { ...defaultSettings.tuner, ...parsed.tuner },
    };
  } catch {
    return defaultSettings;
  }
}

type Patch = { [K in keyof Settings]?: Settings[K] extends object ? Partial<Settings[K]> : Settings[K] };

interface AppState {
  settings: Settings;
  update: (patch: Patch) => void;
  t: Translate;
  catalog: Catalog;
}

const Ctx = createContext<AppState | null>(null);
const catalog = parseCatalog(seed);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(load);

  const update = useCallback((patch: Patch) => {
    setSettings((prev) => {
      const next = { ...prev } as Settings;
      for (const [k, v] of Object.entries(patch)) {
        const key = k as keyof Settings;
        const cur = prev[key];
        (next as unknown as Record<string, unknown>)[key] =
          typeof cur === "object" && cur !== null ? { ...cur, ...(v as object) } : v;
      }
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // Sem armazenamento: segue só na memória.
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === "sistema") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", settings.theme);
    root.lang = settings.locale;
  }, [settings.theme, settings.locale]);

  const t = useMemo(() => createTranslator(settings.locale), [settings.locale]);
  const value = useMemo(() => ({ settings, update, t, catalog }), [settings, update, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp fora do AppStateProvider");
  return v;
}
