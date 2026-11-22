import { isNative } from "../engine";
import { IndexedDbBackend } from "./indexeddb";
import { SqliteBackend } from "./sqlite";
import { PracticeRepository } from "./repository";
import { flattenSettings, validateSetting, type StoreBackend, type SettingsPatch, type PracticeStore } from "@gx/core";
let opening: Promise<PracticeStore> | undefined;
let storageBackend: StoreBackend | undefined;
export function openPracticeStore(): Promise<PracticeStore> {
  return opening ??= open().catch((error) => { opening = undefined; throw error; });
}
async function open() {
  const backend: StoreBackend = isNative ? new SqliteBackend() : new IndexedDbBackend();
  storageBackend = backend;
  const deviceId = await backend.request("deviceId") as string;
  const repository = new PracticeRepository(backend, deviceId);
  if (!(await backend.request("metaGet", { key: "settingsMigrated" }))) {
    const raw = localStorage.getItem("pratica.settings.v1");
    if (raw) {
      try {
      // Não sobrescreve ajustes importados de outro Mac antes da primeira abertura.
      const rows = await backend.request("getSettings") as unknown[];
      if (rows.length === 0) {
        const parsed = JSON.parse(raw) as SettingsPatch;
        // Valida antes de gravar; um legado corrompido não bloqueia os registros.
        const changes = flattenSettings(parsed, deviceId); changes.forEach(validateSetting);
        await repository.saveSettings(parsed);
      }
      } catch (error) {
        // Mantém a cópia original para recuperação, com aviso persistente.
        if (error instanceof SyntaxError || error instanceof TypeError || (error instanceof Error && error.message === "Ajuste inválido.")) {
          await backend.request("metaSet", { key: "migrationWarning", value: "Os ajustes antigos não puderam ser importados. Configure-os novamente em Ajustes. A cópia original foi preservada." });
        } else throw error;
      }
    }
    await backend.request("metaSet", { key: "settingsMigrated", value: true });
  }
  return repository;
}
export interface SyncStatus { state: "local" | "ok" | "pending" | "error"; message: string; imported?: number }
export async function syncPractice(): Promise<SyncStatus> {
  if (!isNative) return { state: "local", message: "Dados salvos neste navegador." };
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<SyncStatus>("practice_sync");
}

export async function getStorageWarning(): Promise<string | null> {
  await openPracticeStore();
  return storageBackend!.request("metaGet", { key: "migrationWarning" }) as Promise<string | null>;
}
