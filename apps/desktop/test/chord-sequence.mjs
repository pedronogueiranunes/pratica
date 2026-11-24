import assert from 'node:assert/strict';
import { build } from 'vite';
const bundle = await build({ configFile: false, logLevel: 'silent', build: { write: false, lib: { entry: 'src/lib/web-engine.ts', formats: ['es'], fileName: 'engine' } } });
const { createWebEngine } = await import(`data:text/javascript;base64,${Buffer.from((Array.isArray(bundle) ? bundle[0] : bundle).output[0].code).toString('base64')}`);
const sources = [], contexts = [], intervals = new Map();
let nextTimer = 0, suspended = false, release;
const node = () => ({ connections: [], connect(to) { this.connections.push(to); }, disconnect() { this.connections = []; } });
const gain = () => ({ ...node(), gain: { value: 1, cancelScheduledValues() {}, setValueAtTime(v) { this.value = v; }, setTargetAtTime(v) { this.value = v; }, linearRampToValueAtTime(v) { this.value = v; } } });
class Context {
  sampleRate = 48000; currentTime = 1; baseLatency = .01; outputLatency = .02; destination = {};
  constructor() { contexts.push(this); }
  createGain() { return gain(); }
  createWaveShaper() { return node(); }
  createBuffer(_n, length) { return { length, duration: length / 48000, copyToChannel(data) { assert.equal(length, data.length); assert.ok(data.every(Number.isFinite)); } }; }
  createBufferSource() {
    const source = { ...node(), at: Infinity, end: Infinity, start(at) { this.at = at; this.end = at + this.buffer.length / 48000; }, stop(at = 0) { this.end = at; } };
    sources.push(source); return source;
  }
  resume() { return suspended ? new Promise((r) => { release = r; }) : Promise.resolve(); }
}
Object.defineProperty(globalThis, 'AudioContext', { value: Context, configurable: true });
Object.defineProperty(globalThis, 'window', { value: { setInterval(fn) { const id = ++nextTimer; intervals.set(id, fn); return id; }, clearInterval(id) { intervals.delete(id); } }, configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: { mediaDevices: { addEventListener() {}, enumerateDevices: async () => [], getUserMedia() { throw Error('Não pode pedir microfone'); } } }, configurable: true });
const events = [], engine = createWebEngine((e) => events.push(e));
const settings = { bpm: 120, beatsPerBar: 4, subdivision: 1, accentFirstBeat: true, volume: .6, sound: 'madeira' };
const steps = [{ frequencies: [220, 330], beats: 1 }, { frequencies: [330, 440], beats: 2 }];
const advance = (time) => { contexts[0].currentTime = time; for (const fn of intervals.values()) fn(); for (const s of sources) if (s.end <= time && !s.ended) { s.ended = true; s.onended?.({}); } };
suspended = true;
const waiting = engine.startSequence(null, settings, steps, .5, true, 1);
engine.stopSequence(); release(); await waiting;
assert.equal(sources.length, 0, 'cancelar resume impede autoplay atrasado');
suspended = false;
await engine.startSequence(null, settings, steps, .5, false, 2);
const clickBus = sources.find((s) => s.buffer.length !== 67200).connections[0];
for (let time = 1.02; time <= 2.7; time += .02) advance(time);
const chordSources = () => sources.filter((s) => s.buffer.length === 67200);
assert.deepEqual(chordSources().slice(0, 3).map((s) => +s.at.toFixed(4)), [1.05, 1.55, 2.55], 'trocas no mesmo relógio dos cliques');
assert.deepEqual(events.filter((e) => e.type === 'sequenceBeat').slice(0, 4).map(({ step, beatsLeft, runId }) => [step, beatsLeft, runId]), [[0,1,2],[1,2,2],[1,1,2],[0,1,2]]);
assert.equal(clickBus.gain.value, 0, 'silenciar clique preserva transporte');
engine.updateMetronome({ ...settings, bpm: 240 });
advance(2.82); advance(3.05); advance(3.3);
assert.equal(clickBus.gain.value, 0, 'BPM novo não reativa clique');
engine.stopSequence();
const count = sources.length;
advance(5); assert.equal(sources.length, count, 'nenhuma batida após parada');
assert.ok(sources.every((s) => s.connections.length === 0), 'fontes desconectadas');
assert.equal(contexts.length, 1, 'um único AudioContext');
await assert.rejects(engine.startSequence(null, settings, [], .5, true, 3));
await assert.rejects(engine.startSequence(null, { ...settings, bpm: Infinity }, steps, .5, true, 3));
await engine.startSequence(null, settings, steps, .5, true, 4);
assert.equal(intervals.size, 1, 'reiniciar não duplica scheduler');
engine.stopMetronome();
assert.ok(events.some((e) => e.type === 'sequenceState' && !e.running && e.runId === 4));
await engine.startSequence(null, settings, steps, .5, true, 5);
advance(contexts[0].currentTime + 3);
assert.equal(intervals.size, 0, 'pausa longa não dispara acordes atrasados em rajada');
assert.ok(events.some((e) => e.type === 'error' && /pausou/.test(e.message)));
const onlyKick = { enabled: true, volume: .5, pattern: [1,...Array(15).fill(0)] };
const from = sources.length, origin = contexts[0].currentTime + .05;
await engine.startSequence(null, settings, [], .5, false, 6, onlyKick);
for (let t = origin; t < origin + .7; t += .02) advance(t);
engine.updateSequenceMixer(6, { volume: .25, click: false, drums: { ...onlyKick, volume: .25, pattern: [16,...Array(15).fill(0)] } });
for (let t = origin + .7; t < origin + 2.15; t += .02) advance(t);
const drums = sources.slice(from).filter((s) => [13440,3840].includes(s.buffer.length));
assert.deepEqual(drums.map((s) => [s.buffer.length, +(s.at - origin).toFixed(4)]), [[13440,0],[3840,2]], 'novo padrão entra no compasso seguinte, sem reiniciar o transporte');
engine.updateSequenceMixer(6, { volume: .5, click: false, drums: { ...onlyKick, enabled: false } });
engine.stopSequence(); advance(origin + 3);
assert.equal(contexts.length, 1, 'bateria sozinha compartilha contexto');
await assert.rejects(engine.startSequence(null, { ...settings, beatsPerBar: 3 }, [], .5, true, 7, onlyKick));
console.log('Sequência web: relógio, durações, BPM, clique mudo, cancelamento, parada e contexto único passaram.');
// A confirmação de início precede o tick visual zero, inclusive após reinício.
engine.stopMetronome(); events.length=0;
await engine.startMetronome(null,settings);
assert.ok(events.findIndex((e)=>e.type==='metronomeState'&&e.running)<events.findIndex((e)=>e.type==='tick'));
assert.equal(events.find((e)=>e.type==='tick').tick.index,0);
engine.stopMetronome();
