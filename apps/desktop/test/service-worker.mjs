import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const handlers = new Map(), stores = new Map();
let windows = [{ url: 'https://test/pratica/' }], skipped = false, claimed = false;
const fetched = [];
const caches = {
  async open(name) {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name);
    return { addAll: async (requests) => { for (const r of requests) store.set(r.url, { body: r.url }); }, match: async (key) => store.get(new URL(key, 'https://test').href) };
  },
  keys: async () => [...stores.keys()], delete: async (name) => stores.delete(name),
};
class Request { constructor(url) { this.url = new URL(url, 'https://test').href; } }
const self = {
  registration: { scope: 'https://test/pratica/' }, addEventListener: (name, fn) => handlers.set(name, fn),
  clients: { matchAll: async () => windows, claim: async () => { claimed = true; } },
  skipWaiting: async () => { skipped = true; },
};
runInNewContext(readFileSync(new URL('../src/service-worker.js', import.meta.url), 'utf8').replace('__CACHE_VERSION__', 'test').replace('__PRECACHE__', JSON.stringify(['/pratica/index.html', '/pratica/app.js'])), { self, caches, URL, Request, fetch: async (request) => { fetched.push(request.url); return 'network'; } });
const wait = async (name, event = {}) => {
  let pending;
  handlers.get(name)({ ...event, waitUntil: (p) => { pending = p; } });
  await pending;
};
await wait('install');
stores.set('pratica-shell-old', new Map()); stores.set('portfolio-cache', new Map());
await wait('activate');
assert.equal(claimed, true); assert.equal(stores.has('pratica-shell-old'), false); assert.equal(stores.has('portfolio-cache'), true);
const request = async (url, mode = 'same-origin', method = 'GET') => {
  let result;
  handlers.get('fetch')({ request: { url, mode, method }, respondWith(p) { result = p; } });
  return result === undefined ? 'ignored' : await result;
};
assert.deepEqual(await request('https://test/pratica/song/one', 'navigate'), { body: 'https://test/pratica/index.html' });
assert.deepEqual(await request('https://test/pratica/app.js'), { body: 'https://test/pratica/app.js' });
assert.equal(fetched.length, 0, 'shell servido sem rede');
assert.equal(await request('https://test/portfolio/', 'navigate'), 'ignored');
assert.equal(await request('https://youtube.com/watch?v=test'), 'ignored');
assert.equal(await request('https://test/pratica/data.json'), 'ignored');
assert.equal(await request('https://test/pratica/app.js', 'same-origin', 'POST'), 'ignored');
windows = [{ url: 'https://test/pratica/' }, { url: 'https://test/pratica/#songs' }];
let message;
await wait('message', { data: { type: 'ACTIVATE_UPDATE' }, source: { postMessage(value) { message = value; } } });
assert.equal(message.type, 'UPDATE_BLOCKED'); assert.equal(skipped, false);
windows = [{ url: 'https://test/pratica/' }];
await wait('message', { data: { type: 'ACTIVATE_UPDATE' } }); assert.equal(skipped, true);
console.log('Service worker: shell, escopo, cache de versões e atualização com duas abas passaram em APIs controladas.');
