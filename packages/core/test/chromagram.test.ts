import { describe, it, expect } from 'vitest';
import { chromaFromSpectrum, powerSpectrum } from '../src';
const sr = 48000, n = 16384;
const signal = (midis: number[], a4 = 440, harmonics = false) => Float32Array.from({ length: n }, (_, i) => midis.reduce((sum, midi) => {
  const phase = 2 * Math.PI * a4 * 2 ** ((midi - 69) / 12) * i / sr;
  return sum + .15 * (Math.sin(phase) + (harmonics ? .4 * Math.sin(2 * phase) + .2 * Math.sin(3 * phase) : 0)) / midis.length;
}, 0));
const analyze = (notes: number[], ref = 440, harmonics = false) => chromaFromSpectrum(powerSpectrum(signal(notes, ref, harmonics)), sr, n, .1, ref)!;
describe('cromagrama experimental', () => {
  it('FFT preserva energia de seno em bin conhecido e remove DC', () => {
    const samples = Float32Array.from({ length: 1024 }, (_, i) => .2 + Math.sin(2 * Math.PI * 32 * i / 1024));
    const powers = powerSpectrum(samples);
    expect(powers[32]).toBeCloseTo(.06238, 4);
    expect(powers[0]).toBeLessThan(1e-8);
    expect(Array.from(powers).indexOf(Math.max(...powers))).toBe(32);
    expect(() => powerSpectrum(new Float32Array(33))).toThrow();
    expect(() => powerSpectrum(Float32Array.from({ length: 32 }, () => NaN))).toThrow();
  });
  it.each([['C', [48,52,55]], ['Am', [45,48,52]], ['E', [40,44,47]], ['G7', [43,47,50,53]], ['Dm', [50,53,57]]])('reconhece %s sintético sem inventar baixo', (name, notes) => {
    const result = analyze(notes as number[]);
    expect(result.candidates).toContain(name);
    expect(result.pcs).toEqual([...new Set((notes as number[]).map((m) => m % 12))].sort((a,b) => a-b));
    expect(result.candidates.every((c) => !c.includes('/'))).toBe(true);
  });
  it('referência, inversão e oitavas não alteram as classes', () => {
    expect(analyze([52,55,60], 442).candidates).toContain('C');
    expect(analyze([48,52,55,60], 432).pcs).toEqual([0,4,7]);
    expect(analyze([48,52,55], 440, true).candidates).toContain('C');
  });
  it('preserva ambiguidades e não transforma uma nota em acorde', () => {
    const result = analyze([48,52,55,57]);
    expect(result.candidates).toContain('C6'); expect(result.candidates).toContain('Am7');
    expect(analyze([45],440,true).candidates).toEqual([]);
    expect(analyze([48,52]).candidates).toEqual([]);
  });
  it('silêncio, resolução insuficiente e valores inválidos não viram resultado', () => {
    const spectrum = powerSpectrum(signal([48,52,55]));
    expect(chromaFromSpectrum(spectrum,sr,n,0)).toBeNull();
    expect(chromaFromSpectrum(new Float32Array(n/2+1),sr,n,.1)).toBeNull();
    expect(chromaFromSpectrum(spectrum,192000,n,.1)).toBeNull();
    expect(chromaFromSpectrum([0,NaN,1],sr,n,.1)).toBeNull();
    expect(chromaFromSpectrum(spectrum,sr,n,.1,NaN)).toBeNull();
  });
  it('ruído e saturação ficam limitados, sem promessa de identificação', () => {
    let seed=12345;
    const noise=Float32Array.from({length:n},()=>{seed=(1664525*seed+1013904223)>>>0;return seed/0xffffffff-.5;});
    const r=chromaFromSpectrum(powerSpectrum(noise),sr,n,.1);
    expect(r?.candidates ?? []).toEqual([]);
    const distorted=signal([40,44,47]).map((v)=>Math.tanh(v*30));
    const result=chromaFromSpectrum(powerSpectrum(distorted),sr,n,.1);
    expect(result?.values.every((v)=>Number.isFinite(v)&&v>=0&&v<=1) ?? true).toBe(true);
  });
});
