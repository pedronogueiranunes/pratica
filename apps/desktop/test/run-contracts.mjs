import { build } from 'vite';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve(import.meta.dirname, '..');
const workspace = resolve(root, '../..');
const manualWeb = process.argv.includes('--manual-web');
const webOnly = process.argv.includes('--web') || manualWeb;
const nativeOnly = process.argv.includes('--native');
if (webOnly && nativeOnly) throw new Error('Escolha --web ou --native, não os dois.');
const temp = mkdtempSync(resolve(tmpdir(), 'pratica-contract-'));
let browser;

// Transforma e empacota a mesma suíte TS, sem servidor HTTP ou WebSocket.
async function bundleEntry(file, format) {
  const result = await build({
    root, configFile: false, logLevel: 'error',
    build: {
      write: false,
      lib: { entry: resolve(root, file), name: 'PracticeContract', formats: [format] },
    },
  });
  const output = (Array.isArray(result) ? result[0] : result).output;
  const entry = output.find((item) => item.type === 'chunk' && item.isEntry);
  if (!entry) throw new Error('O bundle de contrato não foi gerado.');
  return entry.code;
}
try {
  if (!webOnly) {
    execFileSync('cargo', ['build', '-p', 'practice-store', '--example', 'bridge'], { cwd: workspace, stdio: 'inherit' });
    const code = await bundleEntry('test/store-contract.ts', 'es');
    const { storeContract } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
    const checks = await storeContract(async () => ({
      request: async (operation, data = {}) => {
        const output = execFileSync(resolve(workspace, 'target/debug/examples/bridge'), [resolve(temp, 'practice.sqlite3')], { input: JSON.stringify({ operation, data }), encoding: 'utf8' });
        const result = JSON.parse(output);
        if ('error' in result) throw new Error(result.error);
        return result.ok;
      },
    }));
    console.log(`SQLite: ${checks.length} verificações passaram.`);
  }
  if (!nativeOnly) {
    const code = await bundleEntry('test/browser-contract.ts', 'iife');
    const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Contrato IndexedDB Prática</title><body>Testando…<script>${code.replaceAll('</script', '<\\/script')}</script></body></html>`;
    if (manualWeb) {
      const directory = resolve(workspace, 'target/contract');
      mkdirSync(directory, { recursive: true });
      const file = resolve(directory, 'practice-store.html');
      writeFileSync(file, html);
      console.log(`Página de contrato gerada: ${file}\nAbra no navegador. Só o resultado exibido na página confirma a execução; gerar o arquivo não executa o teste.`);
    } else {
      const channel = process.env.PRACTICE_TEST_BROWSER;
      if (channel && channel !== 'chrome') throw new Error('PRACTICE_TEST_BROWSER aceita apenas chrome. Sem a variável, usa Chromium.');
      browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
      const context = await browser.newContext();
      const page = await context.newPage();
      // Origem HTTPS isolada e totalmente interceptada. Sem localhost, rede real
      // ou perfil pessoal; o IndexedDB continua sendo o do navegador de verdade.
      await context.route('https://pratica.test/**', (route) => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }));
      await page.goto('https://pratica.test/');
      await page.waitForFunction(() => document.body.dataset.result, undefined, { timeout: 30_000 });
      const result = await page.locator('body').getAttribute('data-result');
      const body = await page.locator('body').innerText();
      if (result !== 'passed') throw new Error(body);
      console.log(`IndexedDB: ${JSON.parse(body).passed.length} verificações passaram.`);
    }
  }
} finally {
  await browser?.close(); rmSync(temp, { recursive: true, force: true });
}
