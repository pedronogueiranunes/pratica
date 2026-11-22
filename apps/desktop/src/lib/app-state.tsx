// Ajustes persistidos por PracticeStore, tradução e catálogo.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useRef, type ReactNode } from "react";
import {
  createTranslator,
  defaultSettings,
  parseCatalog,
  type Catalog,
  type Settings,
  type Translate,
} from "@gx/core";
import { openPracticeStore, getStorageWarning } from "./storage";
import type { PracticeStore } from "@gx/core";
import seed from "../../../../data/exercises.seed.json";


type Patch = { [K in keyof Settings]?: Settings[K] extends object ? Partial<Settings[K]> : Settings[K] };

interface AppState {
  settings: Settings;
  update: (patch: Patch) => Promise<boolean>;
  t: Translate;
  catalog: Catalog;
  settingsError: string | null;
}

const Ctx = createContext<AppState | null>(null);
const catalog = parseCatalog(seed);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => structuredClone(defaultSettings));
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const store = useRef<PracticeStore | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const revision = useRef(0);
  useEffect(() => {
    let active = true;
    const hydrate = async () => {
      try {
        const repository = await openPracticeStore();
        await queue.current;
        const before = revision.current;
        const saved = await repository.getSettings();
        const warning = await getStorageWarning();
        if (active) {
          store.current = repository;
          if (warning) setSettingsError(warning);
          if (before === revision.current) setSettings(saved);
        }
      } catch (e) { if (active) setSettingsError(String(e)); }
    };
    void hydrate();
    window.addEventListener("practice-synced", hydrate);
    return () => { active = false; window.removeEventListener("practice-synced", hydrate); };
  }, []);

  const update = useCallback((patch: Patch) => {
    revision.current++;
    const write = queue.current.catch(() => {}).then(async () => {
      const repository = store.current ?? await openPracticeStore();
      await repository.saveSettings(patch);
      setSettings((prev) => {
        const next = { ...prev } as Settings;
        for (const [k, v] of Object.entries(patch)) {
          const key = k as keyof Settings;
          const cur = prev[key];
          (next as unknown as Record<string, unknown>)[key] =
            typeof cur === "object" && cur !== null ? { ...cur, ...(v as object) } : v;
        }
        return next;
      });
      setSettingsError(null);
      window.dispatchEvent(new Event("practice-written"));
    });
    queue.current = write.catch(() => {});
    return write.then(() => true, (error) => {
      setSettingsError(`Não foi possível salvar o ajuste. Tente de novo. ${String(error)}`);
      return false;
    });
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === "sistema") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", settings.theme);
    root.lang = settings.locale;
  }, [settings.theme, settings.locale]);

  const t = useMemo(() => createTranslator(settings.locale), [settings.locale]);
  const value = useMemo(() => ({ settings, update, t, catalog, settingsError }), [settings, update, t, settingsError]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp fora do AppStateProvider");
  return v;
}
