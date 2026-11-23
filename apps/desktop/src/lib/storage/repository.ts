import { validateSavedSequence, type SequenceDraft, type SavedSequence, validateChartRevision, validatePlaylist, validateSong, type ChartDraft, type ChartRevision, type Playlist, type Song, type SongStore,
  createMusicPackage, validateMusicPackage, type MusicPackage, type MusicTransferStore, flattenSettings, settingsFromRows, validateStoredEvent, validateLog, validateRoutine, validDate,
  type LogRange, type StoredEvent, type PracticeEvent, type PracticeRecord, type PracticeStore, type SavedRoutine,
  type SettingChange, type SettingsPatch, type StoreBackend } from "@gx/core";

/** Mesmo contrato no Tauri e no IndexedDB. Sem dependência de React. */
export class PracticeRepository implements PracticeStore, SongStore, MusicTransferStore {
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
  async saveSequence(draft: SequenceDraft): Promise<SavedSequence> {
    const event = await this.event("sequence.saved", null);
    const saved = { ...draft, updatedAt: event.at }; validateSavedSequence(saved);
    await this.mergeEvents([{ ...event, data: saved }]); return saved;
  }
  async listSequences(): Promise<SavedSequence[]> {
    const rows = await this.backend.request("listSequences") as SavedSequence[];
    rows.forEach(validateSavedSequence);
    return rows.filter((s) => !s.deleted).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
  }
  async listSongs() { return this.backend.request("listSongs") as Promise<Song[]>; }
  async saveSong(song: Song) {
    validateSong(song);
    await this.mergeEvents([await this.event("song.saved", song)]);
  }
  async listPlaylists() { return this.backend.request("listPlaylists") as Promise<Playlist[]>; }
  async savePlaylist(playlist: Playlist) {
    validatePlaylist(playlist);
    await this.mergeEvents([await this.event("playlist.saved", playlist)]);
  }
  async chartRevisions(chartId: string) { return this.backend.request("chartRevisions", { chartId }) as Promise<ChartRevision[]>; }
  async reviseChart(draft: ChartDraft) {
    const event = await this.event("chart.revised", null);
    const revision: ChartRevision = {
      chartId: draft.chartId ?? crypto.randomUUID(), songId: draft.songId, revision: crypto.randomUUID(),
      chordpro: draft.chordpro, importedFrom: draft.importedFrom, createdAt: event.at,
      ...(draft.parentRevision ? { parentRevision: draft.parentRevision } : {}),
      ...(draft.supersedes?.length ? { supersedes: draft.supersedes } : {}),
      ...(draft.sourceUrl ? { sourceUrl: draft.sourceUrl } : {}),
    };
    validateChartRevision(revision);
    await this.mergeEvents([{ ...event, data: revision }]);
    return revision;
  }
  async exportMusic() { return createMusicPackage(await this.events(), new Date().toISOString()); }
  async importMusic(pack: MusicPackage) { await this.backend.request("apply", { events: validateMusicPackage(pack).events, relayMusic: true }); }
  async mergeEvents(events: StoredEvent[]) {
    events.forEach(validateStoredEvent);
    await this.backend.request("apply", { events });
  }
  async events() { return this.backend.request("events") as Promise<StoredEvent[]>; }
}
