// Chromium launch options for the browser tests.
// By default the tests render WebGL in software (SwiftShader): it works on any machine, including cloud boxes with
// no graphics card, but it's slow (a few seconds a frame on 2 cores). Set RT_GPU=1 to use the machine's real graphics
// card instead (the owner's PC, via the self-hosted GitHub Actions runner): the same tests, many times faster.
const SOFTWARE = new Set(['--use-angle=swiftshader', '--enable-unsafe-swiftshader']);

export function launchOpts({ args = [], ...rest } = {}) {
  if (!process.env.RT_GPU) return { args, ...rest };
  const gpu = args.filter((a) => !SOFTWARE.has(a));
  if (!gpu.includes('--ignore-gpu-blocklist')) gpu.push('--ignore-gpu-blocklist');
  gpu.push('--enable-gpu', '--enable-gpu-rasterization');
  if (process.platform === 'win32') gpu.push('--use-angle=d3d11');
  // A full browser (not Playwright's stripped headless shell) is what can use a GPU when headless. On Windows that's
  // Microsoft Edge, already installed everywhere, so nothing needs downloading; elsewhere Playwright's own Chromium.
  // RT_CHANNEL overrides it (e.g. RT_CHANNEL=chrome for Google Chrome).
  const channel = process.env.RT_CHANNEL || (process.platform === 'win32' ? 'msedge' : 'chromium');
  return { channel, args: gpu, ...rest };
}
