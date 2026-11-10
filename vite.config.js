import { defineConfig, loadEnv } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import fs from 'node:fs';

// `import b64 from './x.bin?b64'` -> the file's bytes as a base64 string inside the JS bundle. Used for the
// gear models so the artifact never has to fetch a data: URL (its CSP blocks that).
const B64 = /[?&]b64$/;
const base64Import = {
  name: 'base64-import',
  enforce: 'pre',
  async resolveId(id, importer) {
    if (!B64.test(id)) return null;
    const r = await this.resolve(id.split('?')[0], importer, { skipSelf: true });
    return r ? `${r.id.split('?')[0]}?b64` : null;
  },
  load(id) {
    if (!B64.test(id)) return null;
    const file = id.split('?')[0];
    this.addWatchFile(file);
    return `export default ${JSON.stringify(fs.readFileSync(file).toString('base64'))};`;
  },
};

// Fonts. src/ui/style.css asks Google Fonts for them, which is what the Claude artifact does (--mode single: nothing
// binary may be embedded in that one file, and fonts.googleapis.com is one of its three allowed hosts). Every other
// build (npm run build for Steam and the phones, and the dev server) swaps that line for src/ui/fonts.css, the same
// fonts shipped inside the game: no request to Google, and the game looks right with no internet.
const GOOGLE_FONTS = /@import url\('https:\/\/fonts\.googleapis\.com[^']*'\);/;
const selfHostedFonts = {
  name: 'self-hosted-fonts',
  enforce: 'pre',
  transform(code, id) {
    if (!/[\\/]src[\\/]ui[\\/]style\.css(\?|$)/.test(id)) return null;
    if (!GOOGLE_FONTS.test(code)) this.error('src/ui/style.css: the Google Fonts @import line was not found (vite.config.js swaps it for fonts.css)');
    return { code: code.replace(GOOGLE_FONTS, "@import './fonts.css';"), map: null };
  },
};

// The standalone build says which server it talks to in dist/server.json, so the desktop shell (desktop/main.cjs) can
// allow exactly that address in its Content-Security-Policy. Never in the artifact build.
const serverInfo = (mode) => ({
  name: 'server-info',
  apply: 'build',
  generateBundle() {
    const env = loadEnv(mode, process.cwd(), 'VITE_');
    this.emitFile({ type: 'asset', fileName: 'server.json', source: `${JSON.stringify({ server: env.VITE_SERVER_URL || null })}\n` });
  },
});

// `npm run build` -> normal static site in dist/ (deploy to GitHub Pages / Cloudflare Pages).
// `npm run build:single` -> one self-contained HTML file in dist-single/ (offline / guest demo).
export default defineConfig(({ mode }) => ({
  base: './',
  define: { __RT_TESTKIT__: JSON.stringify(process.env.RT_TESTKIT === '1') },
  plugins: mode === 'single' ? [base64Import, viteSingleFile()] : [base64Import, selfHostedFonts, serverInfo(mode)],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
    // Each map's models are a chunk of their own, fetched when you travel there (src/<map>/assets.js): name them after
    // the map. (The one-file artifact build inlines everything.)
    ...(mode === 'single' ? {} : { rollupOptions: { output: { chunkFileNames: (c) => {
      const m = /[\\/]src[\\/](ocean|north|air)[\\/]assets\.heavy\.js$/.exec(c.facadeModuleId || '');
      return m ? `assets/${{ ocean: 'open-waters', north: 'frostmere', air: 'air-races' }[m[1]]}-models-[hash].js` : 'assets/[name]-[hash].js';
    } } } }),
  },
  server: { port: 5173, host: true },
}));
