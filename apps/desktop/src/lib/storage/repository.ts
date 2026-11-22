import { flattenSettings, settingsFromRows, validateEvent, validateLog, validateRoutine, validDate,
  type LogRange, type PracticeEvent, type PracticeRecord, type PracticeStore, type SavedRoutine,
  type SettingChange, type SettingsPatch, type StoreBackend } from "@gx/core";

/** Mesmo contrato no Tauri e no IndexedDB. Sem dependência de React. */
export class PracticeRepository implements PracticeStore {
  constructor(readonly backend: StoreBackend, readonly deviceId: string) {}
  private async event(type: PracticeEvent["type"], data: unknown): Promise<PracticeEvent> {
    const time = await this.backend.request("nextTimestamp") as number;
    return { version: 1, id: crypto.randomUUID(), deviceId: this.deviceId, at: new Date(time).toISOString(), type, data };
  }
  async addLog(log: PracticeRecord) {
    validateLog(log);
    await this.mergeEvents([await this.event("practice.added", { ...log, origin: this.deviceId })]);
  }
  async listLogs(range: LogRange = {}) {
    if ((range.from && !validDate(range.from)) || (range.to && !validDate(range.to))) throw new Error("Intervalo inválido.");
    return this.backend.request("listLogs", range) as Promise<PracticeRecord[]>;
  }
  async countByExercise() { return this.backend.request("countByExercise") as Promise<Record<string, number>>; }
  async saveRoutine(routine: SavedRoutine) {
    validateRoutine(routine);
    await this.mergeEvents([await this.event("routine.saved", routine)]);
  }
  async getRoutine(id: string) { return this.backend.request("getRoutine", { id }) as Promise<SavedRoutine | null>; }
  async getSettings() {
    return settingsFromRows(await this.backend.request("getSettings") as SettingChange[], this.deviceId);
  }
  async saveSettings(patch: SettingsPatch) {
    const changes = flattenSettings(patch, this.deviceId);
    if (changes.length) await this.mergeEvents([await this.event("settings.changed", changes)]);
  }
  async mergeEvents(events: PracticeEvent[]) {
    events.forEach(validateEvent);
    await this.backend.request("apply", { events });
  }
  async events() { return this.backend.request("events") as Promise<PracticeEvent[]>; }
}
