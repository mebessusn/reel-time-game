// Screenshot helper: node tests/shot.mjs "<query>" out.png [w h] [waitMs] [js-to-eval-before-shot]
import { chromium } from 'playwright';
const [, , query = '', out = '/tmp/shot.png', w = '420', h = '640', wait = '2500', js = ''] = process.argv;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errors = [];
page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !m.text().includes('ERR_TUNNEL')) errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
await page.goto(`http://localhost:5173/${query}`);
await page.waitForTimeout(+wait);
if (js) { await page.evaluate(js); await page.waitForTimeout(1500); }
await page.screenshot({ path: out });
console.log(errors.slice(0, 20).join('\n') || 'no console errors');
await browser.close();
