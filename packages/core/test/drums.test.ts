import { describe, expect, it } from "vitest";
import { DRUM_INSTRUMENTS, DRUM_PATTERNS, compileDrums, defaultDrums, synthesizeDrum, validAudioDrums } from "../src";
describe("bateria original de acompanhamento", () => {
  it("todos os estilos são distintos, compilam e cabem em 16 passos", () => {
    expect(new Set(DRUM_PATTERNS.map((p) => p.steps.join())).size).toBe(DRUM_PATTERNS.length);
    for (const p of DRUM_PATTERNS) expect(validAudioDrums(compileDrums({ ...defaultDrums, pattern: p.id }))).toBe(true);
  });
  it.each(DRUM_INSTRUMENTS)("%s: sinal determinístico, finito e com ataque/liberação", (instrument) => {
    for (const sr of [8000, 44100, 48000]) {
      const pcm = synthesizeDrum(instrument, sr);
      expect(pcm[0]).toBe(0);
      expect(Math.abs(pcm.at(-1)!)).toBeLessThan(.001);
      expect(pcm.some((x) => Math.abs(x) > .005)).toBe(true);
      expect(pcm.every((x) => Number.isFinite(x) && Math.abs(x) <= .5)).toBe(true);
      expect(synthesizeDrum(instrument, sr)).toEqual(pcm);
    }
  });
  it("os estilos seguem a convenção do gênero", () => {
    const get = (id: string) => DRUM_PATTERNS.find((p) => p.id === id)!.steps as readonly number[];
    const KICK = 1, SNARE = 2, HAT = 4, OPEN = 8, RIM = 16;
    const beats = [0, 4, 8, 12];
    // Rock: caixa no 2 e no 4, bumbo no 1 e no 3.
    expect(get("rock")[4]! & SNARE).toBeTruthy(); expect(get("rock")[12]! & SNARE).toBeTruthy();
    expect(get("rock")[0]! & KICK).toBeTruthy(); expect(get("rock")[8]! & KICK).toBeTruthy();
    // Reggae one drop: nada de bumbo nem caixa no 1; bumbo e aro juntos no 3.
    expect(get("reggae")[0]! & (KICK | SNARE | RIM)).toBe(0);
    expect(get("reggae")[8]! & KICK).toBeTruthy(); expect(get("reggae")[8]! & RIM).toBeTruthy();
    // Ska e disco: chimbal aberto no contratempo e chimbal fechado nos tempos, para cortar o aberto.
    for (const id of ["ska", "disco"]) for (const i of [2, 6, 10]) { expect(get(id)[i]! & OPEN, id).toBeTruthy(); expect(get(id)[i - 2]! & HAT, id).toBeTruthy(); }
    // Disco: bumbo nos quatro tempos.
    for (const i of beats) expect(get("disco")[i]! & KICK).toBeTruthy();
    // Metal: bumbo em todas as semicolcheias.
    for (const v of get("metal")) expect(v & KICK).toBeTruthy();
    // Bossa nova: aro na clave 3-2.
    for (const i of [0, 3, 6, 10, 13]) expect(get("bossa")[i]! & RIM).toBeTruthy();
    // Meio tempo de drum n bass: caixa só no 3.
    expect(get("dnb")[8]! & SNARE).toBeTruthy(); expect(get("dnb")[4]! & SNARE).toBeFalsy(); expect(get("dnb")[12]! & SNARE).toBeFalsy();
  });
  it("recusa volume e padrões incompatíveis", () => {
    expect(() => compileDrums({ ...defaultDrums, volume: NaN })).toThrow();
    expect(validAudioDrums({ enabled: true, volume: .5, pattern: [32] })).toBe(false);
    expect(validAudioDrums({ enabled: true, volume: .5, pattern: Array(16).fill(256) })).toBe(false);
    expect(validAudioDrums({ enabled: true, volume: .5, pattern: Array(16).fill(255) })).toBe(true);
  });
});
