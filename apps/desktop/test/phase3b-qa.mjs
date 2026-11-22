// Navegador real, origem HTTP local e perfil descartável. Nunca usa o banco pessoal.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const root = resolve(import.meta.dirname, '..');
const screenshots = resolve(root, '../../target/qa-3b');
await mkdir(screenshots, { recursive: true });
let version = 1;
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith('/pratica/')) { res.writeHead(404).end(); return; }
    const relative = url.pathname.slice('/pratica/'.length) || 'index.html';
    const file = resolve(root, 'dist', relative);
    if (!file.startsWith(resolve(root, 'dist') + '/')) { res.writeHead(403).end(); return; }
    let data = await readFile(file).catch(() => readFile(resolve(root, 'dist/index.html')));
    if (relative === 'sw.js' && version === 2) data = Buffer.from(data.toString().replace('pratica-shell-', 'pratica-shell-qa-next-'));
    res.setHeader('Content-Type', relative.endsWith('.js') ? 'text/javascript' : relative.endsWith('.css') ? 'text/css' : relative.endsWith('.woff2') ? 'font/woff2' : relative.endsWith('.woff') ? 'font/woff' : 'text/html');
    res.setHeader('Cache-Control', 'no-store'); res.end(data);
  } catch (error) { res.writeHead(500).end(String(error)); }
});
async function openScreen(page, name) {
  const nav = page.getByRole('navigation', { name: 'Telas', exact: true });
  const target = nav.getByRole('button', { name: new RegExp(`^${name}(?:\\s|$)`) });
  if (!await target.isVisible()) await nav.getByRole('button', { name: 'Mais', exact: true }).click();
  await target.click();
}
let browser;
try {
  await new Promise((ok, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', ok); });
  const base = `http://127.0.0.1:${server.address().port}/pratica/`;
  browser = await chromium.launch({ channel: process.env.PRACTICE_TEST_BROWSER || 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await context.addInitScript(() => { if (!localStorage.getItem('pratica.route')) localStorage.setItem('pratica.route', 'musicas'); });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  page.setDefaultNavigationTimeout(20_000);
  console.log('3B QA: abrindo o app em perfil descartável…');
  const errors = []; page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(base);
  await page.getByText(/de 12 músicas/).waitFor();
  const event = (id, type, data, seconds = '00') => ({ version: 1, id, type, data, deviceId: 'qa-device', at: `2026-11-22T12:00:${seconds}Z` });
  const song = { id: 'qa-song', title: 'Estudo neutro', links: [], tracks: [], tags: [], chartId: 'qa-chart' };
  const revision = (id, text, seconds, parentRevision) => ({ chartId: 'qa-chart', songId: song.id, revision: id, chordpro: text, importedFrom: 'manual', createdAt: `2026-11-22T12:00:${seconds}Z`, ...(parentRevision ? { parentRevision } : {}) });
  const pack = { format: 'pratica.repertoire', version: 1, exportedAt: '2026-11-22T12:00:04Z', events: [
    event('qa-song-event', 'song.saved', song),
    event('qa-root-event', 'chart.revised', revision('qa-root', '[C]Texto inicial\n', '00')),
    ...['[Am]Primeiro texto neutro\n', '[D]Segundo texto neutro\n', '[G]Terceiro texto neutro\n'].map((text, i) => event(`qa-branch-${i}`, 'chart.revised', revision(`qa-rev-${i}`, text, `0${i + 1}`, 'qa-root'), `0${i + 1}`)),
  ] };
  console.log('3B QA: importando repertório com três versões concorrentes…');
  await page.getByText('Levar repertório para outro aparelho', { exact: true }).click();
  await page.locator('.music-transfer input[type=file]').setInputFiles({ name: 'repertorio-qa.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(pack)) });
  await page.getByRole('button', { name: 'Confirmar importação', exact: true }).click();
  await page.getByText('Repertório importado.', { exact: false }).waitFor();
  await page.getByRole('searchbox', { name: 'Buscar música' }).fill('Estudo neutro');
  await page.getByRole('button', { name: /Estudo neutro.*Artista/ }).click();
  await page.getByRole('button', { name: 'Comparar', exact: true }).click();
  assert.equal(await page.locator('.chart-compare [role=document]').count(), 3);
  console.log('3B QA: comparando versões e capturando desktop/celular, claro/escuro…');
  for (const width of [1440, 390]) for (const colorScheme of ['light', 'dark']) {
    await page.setViewportSize({ width, height: 1000 }); await page.emulateMedia({ colorScheme });
    await page.evaluate(async () => { await document.fonts.ready; document.querySelector('.main')?.scrollTo(0, 0); });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `overflow ${width}/${colorScheme}`);
    await page.screenshot({ path: resolve(screenshots, `conflito-${width}-${colorScheme}.png`), fullPage: true });
    // O conteúdo rola dentro de .main; fullPage sozinho não mostra o final.
    await page.getByRole('document', { name: 'Outra versão 2', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(screenshots, `conflito-${width}-${colorScheme}-continuacao.png`), fullPage: true });
  }
  await page.getByRole('button', { name: 'Ficar com a outra versão 1', exact: true }).click();
  await page.locator('.chart-conflict').waitFor({ state: 'detached' });
  await page.reload(); await page.locator('.song-title').filter({ hasText: 'Estudo neutro' }).waitFor();
  assert.equal(await page.locator('.chart-conflict').count(), 0);
  console.log('3B QA: conferindo playlists e persistência…');
  await page.getByRole('button', { name: 'Playlists', exact: true }).click();
  await page.getByRole('button', { name: 'Nova playlist', exact: true }).click();
  await page.getByRole('textbox', { name: 'Nome da playlist' }).fill('Treino neutro');
  await page.getByRole('combobox', { name: 'Adicionar música' }).selectOption('qa-song');
  await page.getByRole('combobox', { name: 'Adicionar música' }).selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Descer Estudo neutro', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar playlist', exact: true }).click();
  await page.getByRole('button', { name: 'Editar Treino neutro', exact: true }).waitFor();
  await page.reload();
  await page.getByRole('button', { name: 'Playlists', exact: true }).click();
  await page.getByRole('button', { name: 'Editar Treino neutro', exact: true }).click();
  assert.ok((await page.locator('.playlist-order li').last().innerText()).includes('Estudo neutro'));
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  console.log('3B QA: conferindo preparo offline e abrindo Ajustes pelo menu responsivo…');
  await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration())?.active, undefined, { timeout: 20_000 });
  await openScreen(page, 'Ajustes');
  await page.getByText('App preparado para abrir offline neste navegador.', { exact: true }).waitFor();
  console.log('3B QA: testando atualização com duas abas…');
  const second = await context.newPage(); await second.goto(base);
  version = 2;
  await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration()).update(); });
  await page.getByRole('button', { name: 'Atualizar e recarregar', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Atualizar e recarregar', exact: true }).click();
  await page.getByText('Feche as outras abas do Prática antes de atualizar.', { exact: true }).waitFor();
  await second.close();
  await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Atualizar e recarregar', exact: true }).click()]);
  console.log('3B QA: recarregando sem rede e conferindo repertório…');
  await context.setOffline(true); await page.reload();
  await openScreen(page, 'Músicas');
  await page.getByRole('button', { name: 'Playlists', exact: true }).click();
  await page.getByRole('button', { name: 'Editar Treino neutro', exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log(`3B no navegador: importação, três pontas, resolução/reabertura, playlists, capturas dos quatro cenários com continuação, atualização com duas abas e reload offline passaram. Capturas: ${screenshots}`);
} finally { await browser?.close(); await new Promise((ok) => server.close(ok)); }
