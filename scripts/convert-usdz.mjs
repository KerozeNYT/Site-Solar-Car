// Converts a .usdz (or .usdc/.usda) car model to .glb using three.js in headless Chromium.
// Skinned meshes are baked into static geometry. Usage:
//   node scripts/convert-usdz.mjs <input.usdz> <output.glb>
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import * as esbuild from 'esbuild';

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('usage: convert-usdz.mjs <input.usdz> <output.glb>');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'usdz-'));
await esbuild.build({
  entryPoints: [new URL('./convert/page.js', import.meta.url).pathname],
  bundle: true,
  format: 'esm',
  outfile: path.join(tmp, 'page.js'),
  logLevel: 'warning',
});
fs.writeFileSync(path.join(tmp, 'index.html'), '<!doctype html><script type="module" src="page.js"></script>');
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x').pathname;
  const file = url === '/input/model.usdz' ? path.resolve(input) : path.join(tmp, url === '/' ? 'index.html' : url);
  if (!fs.existsSync(file)) return res.writeHead(404).end();
  const type = file.endsWith('.html') ? 'text/html' : file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream';
  res.writeHead(200, { 'content-type': type });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.goto(`http://localhost:${server.address().port}/`);
await page.waitForFunction(() => window.__result, null, { timeout: 600000 });
const { baked, b64 } = await page.evaluate(() => window.__result);
fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
fs.writeFileSync(output, Buffer.from(b64, 'base64'));
console.log(`baked ${baked} skinned meshes -> ${output} (${(fs.statSync(output).size / 1e6).toFixed(1)} MB)`);
await browser.close();
server.close();
fs.rmSync(tmp, { recursive: true, force: true });
