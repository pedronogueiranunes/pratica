import assert from 'node:assert/strict';
import { build } from 'vite';
const bundle = await build({ configFile: false, logLevel: 'silent', build: { write: false, lib: { entry: 'src/lib/web-engine.ts', formats: ['es'], fileName: 'engine' } } });
const { createWebEngine } = await import(`data:text/javascript;base64,${Buffer.from((Array.isArray(bundle) ? bundle[0] : bundle).output[0].code).toString('base64')}`);
const sources = [], contexts = [];
let suspended = false, releases = [];
const node = () => ({ connections: [], connect(to) { this.connections.push(to); }, disconnect() { this.connections.length = 0; } });
const gain = () => ({ ...node(), gain: { value: 1, cancelScheduledValues() {}, setValueAtTime(v) { this.value = v; }, linearRampToValueAtTime(v) { this.value = v; }, setTargetAtTime(v) { this.value = v; } } });
class Context {
  sampleRate = 48000; currentTime = 1; destination = {}; baseLatency = 0; outputLatency = 0;
  constructor() { contexts.push(this); }
  createGain() { return gain(); }
  createWaveShaper() { const n = node(); this.limiter = n; return n; }
  createBuffer(_channels, length) { return { length, copyToChannel(data) { assert.equal(data.length, length); assert.ok(data.every(Number.isFinite)); this.data = data; } }; }
  createBufferSource() {
    const source = { ...node(), started: false, stops: [], start() { this.started = true; }, stop(t = 0) { this.stops.push(t); } };
    sources.push(source); return source;
  }
  resume() { return suspended ? new Promise((r) => releases.push(r)) : Promise.resolve(); }
}
Object.defineProperty(globalThis, 'AudioContext', { value: Context, configurable: true });
Object.defineProperty(globalThis, 'window', { value: { setInterval: () => 1, clearInterval() {} }, configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: { mediaDevices: { enumerateDevices: async () => [], addEventListener() {}, getUserMedia() { throw Error('A prévia não pode pedir microfone'); } } }, configurable: true });
const events = [], engine = createWebEngine((e) => events.push(e));
suspended = true;
const pending = engine.previewChord(null, [440], .5);
engine.stopPreview(); releases.splice(0).forEach((r) => r()); await pending;
assert.equal(sources.length, 0, 'cancelar antes de resume não toca depois');
suspended = false;
for (let i = 0; i < 40; i++) await engine.previewChord(null, [110, 220, 330, 440], .5);
assert.equal(contexts.length, 1, 'todas as prévias compartilham um contexto');
assert.ok(sources.filter((s) => s.connections.length).length <= 2, 'no máximo prévia atual e cauda');
assert.equal(contexts[0].limiter.curve[0], Math.fround(-.98));
assert.equal(contexts[0].limiter.curve.at(-1), Math.fround(.98));
await assert.rejects(engine.previewChord(null, [NaN], .5));
engine.stopPreview();
for (const source of sources) source.onended?.();
assert.equal(sources.filter((s) => s.connections.length).length, 0, 'fim libera as conexões');
await engine.startMetronome(null, { bpm: 60, beatsPerBar: 4, subdivision: 1, accentFirstBeat: true, volume: .5, sound: 'madeira' });
await engine.previewChord(null, [440], .5);
assert.equal(contexts.length, 1, 'metrônomo e prévia não abrem saídas paralelas');
assert.ok(events.some((e) => e.type === 'metronomeState' && e.running));
assert.ok(!events.some((e) => e.type === 'tunerState'));
engine.stopMetronome(); engine.stopPreview();
console.log('Prévia web: cancelamento, repetição, limite de vozes, teto de saída e contexto compartilhado passaram.');
