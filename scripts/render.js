// Renderiza frames de uma cena (ou de um intervalo) com Three.js em Chromium headless (WebGL por CPU / SwiftShader).
// Uso: node scripts/render.js --modo final|preview --cena N [--workers 2] [--t0 s --t1 s] [--teste t1,t2,...]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');

const ROOT = path.resolve(__dirname, '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? a.concat([[v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]]) : a), []));
const MODOS = { final: { w: 1080, h: 1920, fps: 30, q: .9 }, preview: { w: 540, h: 960, fps: 12, q: .85 } };
const CENAS = [[0, 12], [12, 20], [20, 28], [28, 38], [38, 44], [44, 55], [55, 60]];
const modo = args.modo || 'preview'; const M = MODOS[modo];
const falas = JSON.parse(fs.readFileSync(path.join(__dirname, 'falas.json'), 'utf8'));
const MIME = { '.js': 'text/javascript', '.html': 'text/html', '.otf': 'font/otf' };

async function abrir() {
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage();
  page.on('console', m => { if (m.type() === 'error') console.error('[pagina]', m.text()); });
  page.on('pageerror', e => console.error('[pagina erro]', e.message));
  await page.route('http://render.local/**', route => {
    const rel = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//, '') || 'pagina.html';
    const f = path.join(__dirname, rel);
    if (!f.startsWith(__dirname) || !fs.existsSync(f)) return route.fulfill({ status: 404, body: 'nao encontrado' });
    route.fulfill({ status: 200, contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
  });
  await page.goto('http://render.local/pagina.html');
  await page.waitForFunction('window.READY === true', null, { timeout: 60000 });
  await page.evaluate(([w, h, f]) => window.init(w, h, f), [M.w, M.h, falas]);
  return { browser, page };
}
async function frame(page, t, file) {
  const url = await page.evaluate(([t, q]) => window.renderFrame(t, q), [t, M.q]);
  const tmp = file + '.tmp'; fs.writeFileSync(tmp, Buffer.from(url.split(',')[1], 'base64')); fs.renameSync(tmp, file);
}

(async () => {
  if (args.teste) { // renderiza alguns instantes isolados para conferência
    const dir = path.join(ROOT, 'frames', 'teste'); fs.mkdirSync(dir, { recursive: true });
    const { browser, page } = await abrir();
    for (const s of String(args.teste).split(',')) { const t0 = Date.now(); await frame(page, parseFloat(s), path.join(dir, `t_${parseFloat(s).toFixed(2)}.jpg`)); console.log(`t=${s} ${(Date.now() - t0)}ms`); }
    await browser.close(); return;
  }
  const c = parseInt(args.cena); const [a, b] = CENAS[c - 1];
  const dir = path.join(ROOT, 'frames', modo, `cena${c}`); fs.mkdirSync(dir, { recursive: true });
  const f0 = Math.round(a * M.fps), f1 = Math.round(b * M.fps);
  const todos = []; for (let f = f0; f < f1; f++) todos.push(f);
  const faltam = todos.filter(f => !fs.existsSync(path.join(dir, `${String(f - f0).padStart(5, '0')}.jpg`)));
  console.log(`[${modo}] cena ${c}: ${todos.length} frames, faltam ${faltam.length}`);
  if (!faltam.length) return;
  const nw = Math.min(parseInt(args.workers || 2), faltam.length); let feitos = 0; const ini = Date.now();
  await Promise.all(Array.from({ length: nw }, async (_, wi) => {
    const { browser, page } = await abrir();
    for (let k = wi; k < faltam.length; k += nw) {
      const f = faltam[k]; await frame(page, f / M.fps, path.join(dir, `${String(f - f0).padStart(5, '0')}.jpg`)); feitos++;
      if (feitos % 15 === 0 || feitos === faltam.length) { const el = (Date.now() - ini) / 1000; console.log(`  cena ${c}: ${feitos}/${faltam.length}  (${(el / feitos).toFixed(2)} s/frame, resta ~${Math.round(el / feitos * (faltam.length - feitos))} s)`); }
    }
    await browser.close();
  }));
})().catch(e => { console.error(e); process.exit(1); });
