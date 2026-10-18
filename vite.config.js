import { defineConfig } from 'vite';
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

// `npm run build` -> normal static site in dist/ (deploy to GitHub Pages / Cloudflare Pages).
// `npm run build:single` -> one self-contained HTML file in dist-single/ (offline / guest demo).
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [base64Import, viteSingleFile()] : [base64Import],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
  },
  server: { port: 5173, host: true },
}));
