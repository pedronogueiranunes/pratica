import type { PracticeRecord } from "./types";
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function monthRange(year: number, month: number) {
  return { from: new Date(year, month, 1).toISOString(), to: new Date(year, month + 1, 1).toISOString() };
}
export function logsByDay(logs: PracticeRecord[]): Map<string, PracticeRecord[]> {
  const days = new Map<string, PracticeRecord[]>();
  for (const log of logs) {
    const key = dayKey(new Date(log.at));
    const list = days.get(key) ?? [];
    list.push(log); days.set(key, list);
  }
  return days;
}
export function practicedSeconds(logs: PracticeRecord[]): number {
  return logs.reduce((sum, log) => sum + (log.durationSeconds ?? (log.durationMin === undefined ? 0 : log.durationMin * 60)), 0);
}
