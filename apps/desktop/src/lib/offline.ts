import { useSyncExternalStore } from "react";
import { isNative } from "./engine";
interface OfflineState { ready: boolean; update: boolean; persistence: "checking" | "granted" | "notGranted" | "unsupported"; busy: boolean; error: string | null }
let state: OfflineState = { ready: false, update: false, persistence: "checking", busy: false, error: null };
let registration: ServiceWorkerRegistration | null = null;
let started = false;
let requestedReload = false;
const listeners = new Set<() => void>();
const patch = (next: Partial<OfflineState>) => { state = { ...state, ...next }; for (const listener of listeners) listener(); };
const subscribe = (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); };
export const useOffline = () => useSyncExternalStore(subscribe, () => state);
export async function initOffline() {
  if (started || isNative) return;
  started = true;
  try { patch({ persistence: typeof navigator.storage?.persisted === "function" && typeof navigator.storage?.persist === "function" ? await navigator.storage.persisted() ? "granted" : "notGranted" : "unsupported" }); }
  catch { patch({ persistence: "unsupported" }); }
  if (!import.meta.env.PROD || import.meta.env.BASE_URL !== "/pratica/" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (requestedReload) window.location.reload(); });
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "UPDATE_BLOCKED") { requestedReload = false; patch({ error: "Feche as outras abas do Prática antes de atualizar." }); }
  });
  try {
    registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: "/pratica/", updateViaCache: "none" });
    const refresh = () => patch({ ready: !!registration?.active, update: !!registration?.waiting });
    const watch = () => {
      registration?.installing?.addEventListener("statechange", refresh);
      refresh();
    };
    registration.addEventListener("updatefound", watch); watch();
    window.addEventListener("online", () => { void registration?.update().catch(() => {}); });
  } catch (error) { patch({ error: `Não foi possível preparar o app offline. ${String(error)}` }); }
}
export async function requestPersistence() {
  if (state.busy || typeof navigator.storage?.persist !== "function") return;
  patch({ busy: true, error: null });
  try { patch({ persistence: await navigator.storage.persist() ? "granted" : "notGranted" }); }
  catch (error) { patch({ error: `Não deu para pedir a persistência. ${String(error)}` }); }
  finally { patch({ busy: false }); }
}
export function activateOfflineUpdate() {
  if (!registration?.waiting) return;
  requestedReload = true;
  patch({ error: null });
  registration.waiting.postMessage({ type: "ACTIVATE_UPDATE" });
}
