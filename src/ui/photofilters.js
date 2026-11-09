// v1.17.15 photo mode's filters. Each one is a single colour matrix (3 rows of [r, g, b, offset], in sRGB, 0..1), so the
// live view (an SVG feColorMatrix on the game's canvas) and the photo you snap (the same sums on its pixels) match.

const I = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0]];
/** a then b: the matrix that does a first, then b. */
export function compose(a, b) {
  return b.map((r) => [0, 1, 2, 3].map((j) => r[0] * a[0][j] + r[1] * a[1][j] + r[2] * a[2][j] + (j === 3 ? r[3] : 0)));
}
const mix = (m, k) => m.map((r, i) => r.map((v, j) => I[i][j] + (v - I[i][j]) * k));
const contrast = (c) => [[c, 0, 0, 0.5 - 0.5 * c], [0, c, 0, 0.5 - 0.5 * c], [0, 0, c, 0.5 - 0.5 * c]];
const bright = (k) => [[k, 0, 0, 0], [0, k, 0, 0], [0, 0, k, 0]];
const saturate = (s) => [[0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s, 0], [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s, 0], [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s, 0]];
const SEPIA = [[0.393, 0.769, 0.189, 0], [0.349, 0.686, 0.168, 0], [0.272, 0.534, 0.131, 0]];
const tint = (r, g, b) => [[r, 0, 0, 0], [0, g, 0, 0], [0, 0, b, 0]];
const chain = (...ms) => ms.reduce((a, b) => compose(a, b), I);

export const FILTERS = [
  { id: 'none', label: 'Natural', m: I },
  { id: 'warm', label: 'Warm', m: chain(tint(1.08, 1.0, 0.84), saturate(1.12), [[1, 0, 0, 0.02], [0, 1, 0, 0.01], [0, 0, 1, 0]]) },
  { id: 'cool', label: 'Cool', m: chain(tint(0.88, 0.99, 1.12), saturate(0.92), [[1, 0, 0, 0], [0, 1, 0, 0.01], [0, 0, 1, 0.03]]) },
  { id: 'bw', label: 'Black and white', m: chain(saturate(0), contrast(1.18)) },
  { id: 'film', label: 'Film', m: chain(mix(SEPIA, 0.8), contrast(0.92), bright(1.04)) },
  { id: 'vivid', label: 'Vivid', m: chain(saturate(1.5), contrast(1.1)) },
];
export const FILTER_BY_ID = Object.fromEntries(FILTERS.map((f) => [f.id, f]));

/** Pure: one pixel (0..255) through a matrix. */
export function applyPixel(m, r, g, b) {
  const x = r / 255, y = g / 255, z = b / 255, c = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));
  return [c(m[0][0] * x + m[0][1] * y + m[0][2] * z + m[0][3]), c(m[1][0] * x + m[1][1] * y + m[1][2] * z + m[1][3]), c(m[2][0] * x + m[2][1] * y + m[2][2] * z + m[2][3])];
}

/** Put a filter on a 2D canvas's pixels, in place. */
export function filterCanvas(cv, id) {
  const F = FILTER_BY_ID[id]; if (!F || F.id === 'none') return cv;
  const c = cv.getContext('2d'), img = c.getImageData(0, 0, cv.width, cv.height), d = img.data, m = F.m;
  for (let i = 0; i < d.length; i += 4) { const p = applyPixel(m, d[i], d[i + 1], d[i + 2]); d[i] = p[0]; d[i + 1] = p[1]; d[i + 2] = p[2]; }
  c.putImageData(img, 0, 0);
  return cv;
}

/** The live view: an SVG colour matrix on an element (the game's canvas). id 'none' takes it off. */
export function filterElement(el, id) {
  const F = FILTER_BY_ID[id];
  if (!el) return;
  if (!F || F.id === 'none') { el.style.filter = ''; return; }
  let svg = document.getElementById('rt-photo-svg');
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.id = 'rt-photo-svg';
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    svg.innerHTML = '<filter id="rt-photo-filter" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values=""/></filter>';
    document.body.append(svg);
  }
  // feColorMatrix rows are [r g b a offset]; ours leave alpha alone
  const vals = F.m.flatMap((r) => [r[0], r[1], r[2], 0, r[3]]).concat([0, 0, 0, 1, 0]);
  svg.querySelector('feColorMatrix').setAttribute('values', vals.map((v) => +v.toFixed(4)).join(' '));
  el.style.filter = ''; void el.offsetWidth; // (some browsers keep the old matrix until the filter is set afresh)
  el.style.filter = 'url(#rt-photo-filter)';
}
