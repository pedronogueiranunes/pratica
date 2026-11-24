import assert from 'node:assert/strict';
import { build } from 'vite';
const bundle = await build({ configFile: false, logLevel: 'silent', build: { write: false, lib: { entry: 'src/lib/web-engine.ts', formats: ['es'], fileName: 'engine' } } });
const { createWebEngine } = await import(`data:text/javascript;base64,${Buffer.from((Array.isArray(bundle) ? bundle[0] : bundle).output[0].code).toString('base64')}`);
let releaseResume, acquire, requests = 0, blockResume = false, analyse, clock = 0, signalGain = .1;
Object.defineProperty(performance, "now", {value:()=>clock});
const events = [];
const node = () => ({ connect() {}, disconnect() {} });
class Context {
  sampleRate = 48000;
  destination = {};
  createGain() { return node(); }
  createWaveShaper() { return node(); }
  resume() { return blockResume ? new Promise((r) => { releaseResume = r; }) : Promise.resolve(); }
  createMediaStreamSource() { return node(); }
  createChannelSplitter(channels) { assert.equal(channels, 1); return node(); }
  createAnalyser() { return { ...node(), fftSize: 0, getFloatTimeDomainData(buf) { for(let i=0;i<buf.length;i++) buf[i]=signalGain*[48,52,55].reduce((sum,m)=>sum+Math.sin(2*Math.PI*440*2**((m-69)/12)*i/48000)/3,0); } }; }
}
Object.defineProperty(globalThis, 'AudioContext', { value: Context, configurable: true });
Object.defineProperty(globalThis, 'window', { value: { setInterval: (fn) => {analyse=fn;return 1;}, clearInterval() {} }, configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: { mediaDevices: {
  enumerateDevices: async () => [{ kind: 'audioinput', deviceId: 'default', groupId: 'a' }, { kind: 'audioinput', deviceId: 'mic', label: 'Microfone', groupId: 'a' }],
  addEventListener() {},
  getUserMedia: async () => { requests++; return new Promise((r) => { acquire = r; }); },
} }, configurable: true });
const makeTrack = () => {
  let stopped = false, ended;
  const track = { stop() { stopped = true; }, getSettings: () => ({ deviceId: 'mic', channelCount: 1, latency: .012 }), addEventListener(_event, fn) { ended = fn; } };
  return { stream: { getAudioTracks: () => [track], getTracks: () => [track] }, stopped: () => stopped, end: () => ended?.() };
};
const settle = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
const engine = createWebEngine((e) => events.push(e));
navigator.audioSession = { type: 'auto' };
blockResume = true;
let pending = engine.startTuner(null, 0, 440);
assert.equal(navigator.audioSession.type, 'play-and-record', 'afinador mantém captura e reprodução na mesma sessão');
await settle(); engine.stopTuner(); releaseResume(); await pending;
assert.equal(requests, 0, 'cancelar durante resume não pede microfone');
blockResume = false;
pending = engine.startTuner(null, 0, 440); await settle(); engine.stopTuner();
let track = makeTrack(); acquire(track.stream); await pending;
assert.equal(track.stopped(), true, 'captura obtida após cancelar é liberada');
assert.equal(events.some((e) => e.type === 'tunerState' && e.running), false);
events.length = 0;
pending = engine.startTuner(null, 0, 440); await settle();
track = makeTrack(); acquire(track.stream); await pending;
assert.ok(events.some((e) => e.type === 'tunerStream' && e.deviceId === 'in:mic' && e.channels === 1 && e.bufferFrames === null));
assert.ok(events.some((e) => e.type === 'latency' && e.ms === 12 && e.deviceId === 'in:mic'));
track.end(); assert.equal(track.stopped(), true);
assert.equal(navigator.audioSession.type, 'playback', 'encerrar captura restaura a categoria musical');
assert.ok(events.some((e) => e.type === 'error' && e.code === 'deviceLost'));
events.length = 0;
pending = engine.startTuner('in:mic', 1, 440); await settle();
track = makeTrack(); acquire(track.stream); await pending;
assert.equal(track.stopped(), true, 'canal inexistente libera captura');
assert.ok(events.some((e) => e.type === 'tunerState' && !e.running));
assert.equal(events.some((e) => e.type === 'tunerState' && e.running), false);
console.log('Captura web: cancelamento antes/depois da permissão, canal real e desconexão passaram.');

// Espectro usa o mesmo stream e só trabalha com consumidor explícito.
engine.setSpectrum(true);
const beforeRequests = requests; events.length=0;
pending=engine.startTuner('in:mic',0,442); await settle(); track=makeTrack(); acquire(track.stream); await pending;
assert.equal(requests,beforeRequests+1);
clock+=150; analyse();
const spectral=events.find((e)=>e.type==='spectrum');
assert.ok(spectral); assert.equal(spectral.a4,442); assert.equal(spectral.fftSize,16384);
assert.ok(spectral.powers.length<600);
assert.ok(spectral.powers.some((v)=>v>0));
signalGain=0; clock+=150; analyse();
assert.equal(events.filter((e)=>e.type==='spectrum').at(-1).level,0);
engine.setSpectrum(false); events.length=0; clock+=150; analyse();
assert.equal(events.some((e)=>e.type==='spectrum'),false);
assert.equal(requests,beforeRequests+1,'espectro não abre segunda captura');
engine.stopTuner(); assert.equal(track.stopped(),true);
console.log('Espectro web: opt-in, mesma captura, referência, silêncio e desligamento passaram.');
