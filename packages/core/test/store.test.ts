import { describe, it, expect } from "vitest";
import { dayKey, monthRange, logsByDay, practicedSeconds, validateLog, validateEvent, flattenSettings, settingsFromRows } from "../src";

describe("dados de prática", () => {
  it("valida as quatro métricas sem exigir duração inventada", () => {
    for (const fields of [{ bpm: 60 }, { count: 30 }, { seconds: 90 }, {}]) {
      expect(() => validateLog({ id: "one", exerciseId: "f1-spider", at: "2026-11-20T12:00:00Z", ...fields })).not.toThrow();
    }
    expect(() => validateLog({ id: "x", exerciseId: "f1", at: "ontem" })).toThrow();
    expect(() => validateLog({ id: "x", exerciseId: "f1", at: "2026-11-20T12:00:00Z", count: 1.5 })).toThrow();
    expect(() => validateLog({ id: "x", exerciseId: "f1", at: "2026-11-20T12:00:00Z", bpm: NaN })).toThrow();
  });
  it("rejeita versão futura e evento de ajuste inválido", () => {
    const e = { version: 1, id: "x", deviceId: "a", at: "2026-11-20T12:00:00Z", type: "settings.changed", data: [{ key: "theme", value: "claro" }] };
    expect(() => validateEvent(e)).not.toThrow();
    expect(() => validateEvent({ ...e, version: 2 })).toThrow();
    expect(() => validateEvent({ ...e, data: [{ key: "metronome.volume", value: 2 }] })).toThrow();
  });
  it("mantém IDs de áudio no dispositivo de origem e combina patches", () => {
    const rows = flattenSettings({ theme: "escuro", metronome: { volume: 0.3, outputDeviceId: "usb" } }, "a");
    expect(settingsFromRows(rows, "a").metronome.outputDeviceId).toBe("usb");
    const b = settingsFromRows(rows, "b");
    expect(b.routineSource).toBe("suggested");
    expect(settingsFromRows(flattenSettings({ routineSource: "custom" }, "a"), "b").routineSource).toBe("custom");
    expect(b.metronome.outputDeviceId).toBeUndefined(); expect(b.metronome.sound).toBe("madeira"); expect(b.theme).toBe("escuro");
  });
});
describe("calendário", () => {
  it("agrupa instantes equivalentes no mesmo dia local", () => {
    const logs = [
      { id: "a", exerciseId: "f1", at: "2026-11-20T23:30:00-03:00", durationSeconds: 120 },
      { id: "b", exerciseId: "f1", at: "2026-11-21T02:30:00Z" },
    ];
    const key = dayKey(new Date(logs[0]!.at));
    expect(logsByDay(logs).get(key)).toHaveLength(2);
    expect(practicedSeconds(logs)).toBe(120);
    expect(practicedSeconds([{ ...logs[0]!, durationMin: 5, durationSeconds: 120 }])).toBe(120);
  });
  it("inclui ano bissexto e mês com horário de verão sem assumir dias de 24h", () => {
    const range = monthRange(2024, 1);
    expect(new Date(range.from).getDate()).toBe(1);
    expect(new Date(range.to).getMonth()).toBe(2);
    const last = new Date(2024, 2, 0);
    expect(last.getDate()).toBe(29);
    const march = monthRange(2026, 2);
    expect(new Date(march.to).getMonth()).toBe(3);
  });
});

it("preserva envelopes futuros sem aceitar dados conhecidos inválidos", async () => {
  const { validateStoredEvent, validateEvent } = await import("../src/events");
  const event = { version: 1, id: "future", deviceId: "b", at: "2026-11-22T12:00:00Z", type: "future.saved", data: { x: 1 } };
  expect(() => validateStoredEvent(event)).not.toThrow();
  expect(() => validateEvent(event)).toThrow();
  expect(() => validateStoredEvent({ ...event, version: 2 })).toThrow();
  expect(() => validateStoredEvent({ ...event, type: "song.saved" })).toThrow();
  expect(() => validateStoredEvent({ ...event, type: "" })).toThrow();
});
