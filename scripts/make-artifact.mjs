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
const out = [title, ...links, ...styles, markup, ...scripts].join('\n');
fs.mkdirSync(new URL('../dist-artifact/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('../dist-artifact/reel-time.html', import.meta.url), out);
console.log(`artifact page: ${(out.length / 1024).toFixed(0)} KB, ${scripts.length} script(s), ${styles.length} style block(s)`);
