// Turns the single-file build (dist-single/index.html) into a Claude artifact page body:
// the artifact host supplies <!doctype>, <html>, <head> and <body>, so we emit title, styles, markup and script only.
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../dist-single/index.html', import.meta.url), 'utf8');
const pick = (re) => [...src.matchAll(re)].map((m) => m[0]);
const title = pick(/<title>[\s\S]*?<\/title>/g)[0] || '<title>Reel Time</title>';
const links = pick(/<link[^>]+fonts\.(googleapis|gstatic)[^>]*>/g).filter((l) => l.includes('stylesheet') || l.includes('preconnect'));
const styles = pick(/<style[^>]*>[\s\S]*?<\/style>/g);
const scripts = pick(/<script[^>]*>[\s\S]*?<\/script>/g);
const body = (src.match(/<body[^>]*>([\s\S]*?)<\/body>/) || [])[1] || '';
const markup = body.replace(/<script[\s\S]*?<\/script>/g, '').trim();
// --test: the private Open Waters test artifact (its own title, so it's never mistaken for a lake)
const test = process.argv.includes('--test');
const out = [test ? '<title>Reel Time Frostmere Test</title>' : title, ...links, ...styles, markup, ...scripts].join('\n');
fs.mkdirSync(new URL('../dist-artifact/', import.meta.url), { recursive: true });
const name = test ? 'reel-time-test.html' : 'reel-time.html';
fs.writeFileSync(new URL(`../dist-artifact/${name}`, import.meta.url), out);
console.log(`artifact page ${name}: ${(out.length / 1024).toFixed(0)} KB, ${scripts.length} script(s), ${styles.length} style block(s)`);
// v1.15: a Claude artifact tops out at 16 MB; keep a megabyte of headroom for the platform and later updates
const LIMIT = 15 * 1024 * 1024;
if (Buffer.byteLength(out) > LIMIT) { console.error(`artifact page is ${(Buffer.byteLength(out) / 1048576).toFixed(2)} MB, over the 15 MB limit`); process.exit(1); }
