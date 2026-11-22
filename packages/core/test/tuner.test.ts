import { describe, expect, it } from "vitest";
import { displayedCents, noteFromFrequency, tuningStatus, validInputProfiles, flattenSettings, settingsFromRows, validateSetting, detectPitch } from "../src/index";

const profile = { deviceId: "usb", channel: 1, bufferFrames: 128, sampleRate: 48000, inputMs: 4.2, source: "nativeTimestamp", measuredAt: "2026-11-21T22:00:00Z" };
describe("afinador e perfis", () => {
  it("distingue sinal ausente, fraco, instável e desvio", () => {
    const note = noteFromFrequency(440, 440)!;
    expect(tuningStatus(false, note, 1, .1)).toBe("stopped");
    expect(tuningStatus(true, null, 0, 0)).toBe("listening");
    expect(tuningStatus(true, null, 0, .001)).toBe("weak");
    expect(tuningStatus(true, note, .5, .1)).toBe("unstable");
    expect(tuningStatus(true, note, 1, .1)).toBe("inTune");
    expect(tuningStatus(true, { ...note, cents: -5 }, 1, .1)).toBe("flat");
    expect(tuningStatus(true, { ...note, cents: 5 }, 1, .1)).toBe("sharp");
    expect(displayedCents(85)).toBe(50);
    expect(displayedCents(-100)).toBe(-50);
    expect(displayedCents(NaN)).toBe(0);
  });
  it("perfis não vazam entre aparelhos e rejeitam valores inválidos", () => {
    expect(validInputProfiles([profile])).toBe(true);
    for (const patch of [{ channel: 1.5 }, { inputMs: -1 }, { sampleRate: 0 }, { bufferFrames: 0 }, { measuredAt: "ontem" }, { measuredAt: "2026-02-30T00:00:00Z" }, { source: "inventada" }]) expect(validInputProfiles([{ ...profile, ...patch }])).toBe(false);
    expect(validInputProfiles([profile, profile])).toBe(false);
    const patch = { tuner: { inputProfiles: [{ ...profile, source: "nativeTimestamp" as const }] } };
    const rows = flattenSettings(patch, "mac-a");
    rows.forEach(validateSetting);
    expect(settingsFromRows(rows, "mac-a").tuner.inputProfiles).toEqual([profile]);
    expect(settingsFromRows(rows, "mac-b").tuner.inputProfiles).toEqual([]);
    expect(() => validateSetting({ key: "tuner.inputProfiles", value: [profile] })).toThrow();
  });
  it("YIN identifica as seis cordas e desvios conhecidos em 44,1 e 48 kHz", () => {
    // Frequências derivadas do temperamento igual, não dados de repertório.
    for (const sr of [44100, 48000]) for (const midi of [40, 45, 50, 55, 59, 64]) for (const cents of [-15, 0, 15]) {
      const hz = 440 * 2 ** ((midi - 69 + cents / 100) / 12);
      const samples = Float32Array.from({ length: 4096 }, (_, n) => .2 * Math.sin(2 * Math.PI * hz * n / sr) + .06 * Math.sin(4 * Math.PI * hz * n / sr));
      const detected = detectPitch(samples, sr)!;
      expect(detected).not.toBeNull();
      const note = noteFromFrequency(detected.frequency, 440)!;
      expect(note.midi).toBe(midi);
      expect(Math.abs(note.cents - cents)).toBeLessThan(2);
    }
  });
});
