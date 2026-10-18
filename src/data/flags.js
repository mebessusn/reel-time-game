// Country flags (v1.9.3), painted on a canvas at runtime: no images ship with the game.
// Each painter draws a simplified flag into a w x h box (3:2). Busy emblems are left out or
// reduced to a simple shape so they still read at the size of a pennant on a cairn.
// COUNTRIES is the list the creator offers; 'XX' is "Somewhere else" (a plain lake-blue pennant).

import { SPECIES_BY_ID } from './species.js';

const TAU = Math.PI * 2;

function bands(c, w, h, colors, dir = 'h', weights) {
  const ws = weights || colors.map(() => 1), tot = ws.reduce((a, b) => a + b, 0);
  let at = 0;
  colors.forEach((col, i) => {
    const s = ws[i] / tot;
    c.fillStyle = col;
    if (dir === 'h') c.fillRect(0, Math.floor(at * h), w, Math.ceil(s * h) + 1);
    else c.fillRect(Math.floor(at * w), 0, Math.ceil(s * w) + 1, h);
    at += s;
  });
}
function disc(c, x, y, r, col) { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
function ring(c, x, y, r, col, lw) { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke(); }
function star(c, x, y, r, col, n = 5, rot = -Math.PI / 2, inner = 0.4) {
  c.fillStyle = col; c.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = rot + (i * Math.PI) / n, rr = i % 2 ? r * inner : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath(); c.fill();
}
function poly(c, pts, col) { c.fillStyle = col; c.beginPath(); pts.forEach(([x, y]) => c.lineTo(x, y)); c.closePath(); c.fill(); }
function crescent(c, x, y, r, col, bg, off = 0.28) { disc(c, x, y, r, col); disc(c, x + r * off, y, r * 0.8, bg); }
/** A Scandinavian cross; inner = a narrower cross inside it (Norway, Iceland). */
function nordic(c, w, h, bg, col, inner) {
  c.fillStyle = bg; c.fillRect(0, 0, w, h);
  const t = h * 0.22, x = w * 0.36;
  c.fillStyle = col; c.fillRect(x - t / 2, 0, t, h); c.fillRect(0, h / 2 - t / 2, w, t);
  if (inner) { const t2 = t * 0.5; c.fillStyle = inner; c.fillRect(x - t2 / 2, 0, t2, h); c.fillRect(0, h / 2 - t2 / 2, w, t2); }
}
function union(c, x0, y0, w, h) {
  c.save(); c.beginPath(); c.rect(x0, y0, w, h); c.clip();
  c.fillStyle = '#1f3a7a'; c.fillRect(x0, y0, w, h);
  const line = (col, lw) => { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + w, y0 + h); c.moveTo(x0 + w, y0); c.lineTo(x0, y0 + h); c.stroke(); };
  line('#ffffff', h * 0.2); line('#c8202e', h * 0.07);
  c.fillStyle = '#ffffff'; c.fillRect(x0 + w / 2 - h * 0.17, y0, h * 0.34, h); c.fillRect(x0, y0 + h / 2 - h * 0.17, w, h * 0.34);
  c.fillStyle = '#c8202e'; c.fillRect(x0 + w / 2 - h * 0.1, y0, h * 0.2, h); c.fillRect(x0, y0 + h / 2 - h * 0.1, w, h * 0.2);
  c.restore();
}
function leaf(c, x, y, s, col) {
  // a simplified maple leaf
  const p = [[0, -1], [0.18, -0.62], [0.36, -0.7], [0.3, -0.3], [0.7, -0.5], [0.62, -0.3], [0.9, -0.15], [0.48, 0.18], [0.56, 0.36], [0.1, 0.3], [0.08, 0.75], [-0.08, 0.75], [-0.1, 0.3], [-0.56, 0.36], [-0.48, 0.18], [-0.9, -0.15], [-0.62, -0.3], [-0.7, -0.5], [-0.3, -0.3], [-0.36, -0.7], [-0.18, -0.62]];
  poly(c, p.map(([a, b]) => [x + a * s, y + b * s]), col);
}

const P = {
  US(c, w, h) {
    for (let i = 0; i < 13; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#c8282e'; c.fillRect(0, Math.floor((i * h) / 13), w, Math.ceil(h / 13) + 1); }
    const cw = w * 0.42, ch = (h * 7) / 13;
    c.fillStyle = '#2a3f8f'; c.fillRect(0, 0, cw, ch);
    for (let r = 0; r < 5; r++) for (let k = 0; k < 6; k++) star(c, (k + 0.5 + (r % 2) * 0.5 - 0.25) * (cw / 6.2), (r + 0.6) * (ch / 5.2), Math.max(1, ch * 0.055), '#ffffff');
  },
  GB(c, w, h) { union(c, 0, 0, w, h); },
  CA(c, w, h) { bands(c, w, h, ['#d52b1e', '#ffffff', '#d52b1e'], 'v', [1, 2, 1]); leaf(c, w / 2, h * 0.5, h * 0.36, '#d52b1e'); },
  MX(c, w, h) { bands(c, w, h, ['#006847', '#ffffff', '#ce1126'], 'v'); disc(c, w / 2, h / 2, h * 0.14, '#8a5a2a'); ring(c, w / 2, h / 2, h * 0.17, '#3a7a3a', h * 0.03); },
  BR(c, w, h) { c.fillStyle = '#009b3a'; c.fillRect(0, 0, w, h); poly(c, [[w * 0.08, h / 2], [w / 2, h * 0.1], [w * 0.92, h / 2], [w / 2, h * 0.9]], '#fedf00'); disc(c, w / 2, h / 2, h * 0.22, '#002776'); c.strokeStyle = '#ffffff'; c.lineWidth = h * 0.035; c.beginPath(); c.arc(w / 2 + h * 0.05, h * 0.75, h * 0.32, Math.PI * 1.15, Math.PI * 1.62); c.stroke(); },
  AR(c, w, h) { bands(c, w, h, ['#74acdf', '#ffffff', '#74acdf']); star(c, w / 2, h / 2, h * 0.13, '#f6b40e', 16, 0, 0.6); },
  CO(c, w, h) { bands(c, w, h, ['#fcd116', '#003893', '#ce1126'], 'h', [2, 1, 1]); },
  CL(c, w, h) { bands(c, w, h, ['#ffffff', '#d52b1e']); c.fillStyle = '#0039a6'; c.fillRect(0, 0, h / 2, h / 2); star(c, h / 4, h / 4, h * 0.12, '#ffffff'); },
  PE(c, w, h) { bands(c, w, h, ['#d91023', '#ffffff', '#d91023'], 'v'); },
  VE(c, w, h) { bands(c, w, h, ['#ffcc00', '#00247d', '#cf142b']); for (let i = 0; i < 8; i++) { const a = Math.PI * (1.15 + (i * 0.7) / 7); star(c, w / 2 + Math.cos(a) * h * 0.2, h * 0.62 + Math.sin(a) * h * 0.2, h * 0.04, '#ffffff'); } },
  CU(c, w, h) { for (let i = 0; i < 5; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#002a8f'; c.fillRect(0, (i * h) / 5, w, h / 5 + 1); } poly(c, [[0, 0], [w * 0.45, h / 2], [0, h]], '#cf142b'); star(c, w * 0.15, h / 2, h * 0.14, '#ffffff'); },
  PR(c, w, h) { for (let i = 0; i < 5; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#ed0000'; c.fillRect(0, (i * h) / 5, w, h / 5 + 1); } poly(c, [[0, 0], [w * 0.45, h / 2], [0, h]], '#0050f0'); star(c, w * 0.15, h / 2, h * 0.14, '#ffffff'); },
  JM(c, w, h) { c.fillStyle = '#009b3a'; c.fillRect(0, 0, w, h); poly(c, [[0, 0], [w / 2, h / 2], [0, h]], '#000000'); poly(c, [[w, 0], [w / 2, h / 2], [w, h]], '#000000'); c.strokeStyle = '#fed100'; c.lineWidth = h * 0.13; c.beginPath(); c.moveTo(0, 0); c.lineTo(w, h); c.moveTo(w, 0); c.lineTo(0, h); c.stroke(); },
  FR(c, w, h) { bands(c, w, h, ['#002395', '#ffffff', '#ed2939'], 'v'); },
  DE(c, w, h) { bands(c, w, h, ['#000000', '#dd0000', '#ffce00']); },
  IT(c, w, h) { bands(c, w, h, ['#009246', '#ffffff', '#ce2b37'], 'v'); },
  ES(c, w, h) { bands(c, w, h, ['#aa151b', '#f1bf00', '#aa151b'], 'h', [1, 2, 1]); c.fillStyle = '#aa151b'; c.fillRect(w * 0.24, h * 0.36, h * 0.16, h * 0.26); },
  PT(c, w, h) { bands(c, w, h, ['#006600', '#ff0000'], 'v', [2, 3]); ring(c, w * 0.4, h / 2, h * 0.18, '#ffcc00', h * 0.06); disc(c, w * 0.4, h / 2, h * 0.1, '#ffffff'); },
  IE(c, w, h) { bands(c, w, h, ['#169b62', '#ffffff', '#ff883e'], 'v'); },
  NL(c, w, h) { bands(c, w, h, ['#ae1c28', '#ffffff', '#21468b']); },
  BE(c, w, h) { bands(c, w, h, ['#000000', '#fae042', '#ed2939'], 'v'); },
  CH(c, w, h) { c.fillStyle = '#d52b1e'; c.fillRect(0, 0, w, h); const t = h * 0.18, l = h * 0.6; c.fillStyle = '#ffffff'; c.fillRect(w / 2 - t / 2, h / 2 - l / 2, t, l); c.fillRect(w / 2 - l / 2, h / 2 - t / 2, l, t); },
  AT(c, w, h) { bands(c, w, h, ['#ed2939', '#ffffff', '#ed2939']); },
  SE(c, w, h) { nordic(c, w, h, '#006aa7', '#fecc00'); },
  NO(c, w, h) { nordic(c, w, h, '#ba0c2f', '#ffffff', '#00205b'); },
  DK(c, w, h) { nordic(c, w, h, '#c8102e', '#ffffff'); },
  FI(c, w, h) { nordic(c, w, h, '#ffffff', '#003580'); },
  IS(c, w, h) { nordic(c, w, h, '#02529c', '#ffffff', '#dc1e35'); },
  PL(c, w, h) { bands(c, w, h, ['#ffffff', '#dc143c']); },
  CZ(c, w, h) { bands(c, w, h, ['#ffffff', '#d7141a']); poly(c, [[0, 0], [w / 2, h / 2], [0, h]], '#11457e'); },
  HU(c, w, h) { bands(c, w, h, ['#ce2939', '#ffffff', '#477050']); },
  RO(c, w, h) { bands(c, w, h, ['#002b7f', '#fcd116', '#ce1126'], 'v'); },
  UA(c, w, h) { bands(c, w, h, ['#0057b7', '#ffd700']); },
  GR(c, w, h) { for (let i = 0; i < 9; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#0d5eaf'; c.fillRect(0, (i * h) / 9, w, h / 9 + 1); } const s = (h * 5) / 9; c.fillStyle = '#0d5eaf'; c.fillRect(0, 0, s, s); c.fillStyle = '#ffffff'; c.fillRect(s * 0.4, 0, s * 0.2, s); c.fillRect(0, s * 0.4, s, s * 0.2); },
  TR(c, w, h) { c.fillStyle = '#e30a17'; c.fillRect(0, 0, w, h); crescent(c, w * 0.36, h / 2, h * 0.25, '#ffffff', '#e30a17', 0.25); star(c, w * 0.5, h / 2, h * 0.1, '#ffffff', 5, Math.PI); },
  IL(c, w, h) { c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); c.fillStyle = '#0038b8'; c.fillRect(0, h * 0.1, w, h * 0.14); c.fillRect(0, h * 0.76, w, h * 0.14); c.strokeStyle = '#0038b8'; c.lineWidth = h * 0.035; for (const s of [1, -1]) { c.beginPath(); for (let i = 0; i < 3; i++) { const a = -s * Math.PI / 2 + (i * TAU) / 3; c.lineTo(w / 2 + Math.cos(a) * h * 0.17, h / 2 + Math.sin(a) * h * 0.17); } c.closePath(); c.stroke(); } },
  EG(c, w, h) { bands(c, w, h, ['#ce1126', '#ffffff', '#000000']); disc(c, w / 2, h / 2, h * 0.08, '#c09300'); },
  MA(c, w, h) { c.fillStyle = '#c1272d'; c.fillRect(0, 0, w, h); c.strokeStyle = '#006233'; c.lineWidth = h * 0.04; c.beginPath(); for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5; c.lineTo(w / 2 + Math.cos(a) * h * 0.22, h / 2 + Math.sin(a) * h * 0.22); } c.stroke(); },
  NG(c, w, h) { bands(c, w, h, ['#008751', '#ffffff', '#008751'], 'v'); },
  GH(c, w, h) { bands(c, w, h, ['#ce1126', '#fcd116', '#006b3f']); star(c, w / 2, h / 2, h * 0.15, '#000000'); },
  KE(c, w, h) { bands(c, w, h, ['#000000', '#ffffff', '#bb0000', '#ffffff', '#006600'], 'h', [6, 1, 6, 1, 6]); c.fillStyle = '#bb0000'; c.beginPath(); c.ellipse(w / 2, h / 2, h * 0.12, h * 0.3, 0, 0, TAU); c.fill(); c.strokeStyle = '#000'; c.lineWidth = h * 0.02; c.stroke(); },
  ZA(c, w, h) {
    bands(c, w, h, ['#e03c31', '#001489']);
    c.lineCap = 'butt';
    const y = (col, lw) => { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.moveTo(0, 0); c.lineTo(w * 0.4, h / 2); c.lineTo(w, h / 2); c.moveTo(0, h); c.lineTo(w * 0.4, h / 2); c.stroke(); };
    y('#ffffff', h * 0.34); y('#007749', h * 0.2);
    poly(c, [[0, h * 0.16], [w * 0.26, h / 2], [0, h * 0.84]], '#ffb81c'); poly(c, [[0, h * 0.24], [w * 0.2, h / 2], [0, h * 0.76]], '#000000');
  },
  ET(c, w, h) { bands(c, w, h, ['#078930', '#fcdd09', '#da121a']); disc(c, w / 2, h / 2, h * 0.2, '#0f47af'); star(c, w / 2, h / 2, h * 0.15, '#fcdd09'); },
  IN(c, w, h) { bands(c, w, h, ['#ff9933', '#ffffff', '#138808']); ring(c, w / 2, h / 2, h * 0.12, '#000080', h * 0.025); for (let i = 0; i < 12; i++) { const a = (i * TAU) / 12; c.beginPath(); c.moveTo(w / 2, h / 2); c.lineTo(w / 2 + Math.cos(a) * h * 0.12, h / 2 + Math.sin(a) * h * 0.12); c.lineWidth = h * 0.012; c.stroke(); } },
  PK(c, w, h) { c.fillStyle = '#ffffff'; c.fillRect(0, 0, w / 4, h); c.fillStyle = '#01411c'; c.fillRect(w / 4, 0, w * 0.75, h); crescent(c, w * 0.6, h / 2, h * 0.26, '#ffffff', '#01411c', 0.3); star(c, w * 0.7, h * 0.4, h * 0.08, '#ffffff'); },
  BD(c, w, h) { c.fillStyle = '#006a4e'; c.fillRect(0, 0, w, h); disc(c, w * 0.45, h / 2, h * 0.3, '#f42a41'); },
  CN(c, w, h) { c.fillStyle = '#de2910'; c.fillRect(0, 0, w, h); star(c, w * 0.17, h * 0.27, h * 0.15, '#ffde00'); for (const [x, y] of [[0.33, 0.1], [0.4, 0.2], [0.4, 0.35], [0.33, 0.45]]) star(c, w * x, h * y, h * 0.05, '#ffde00'); },
  TW(c, w, h) { c.fillStyle = '#fe0000'; c.fillRect(0, 0, w, h); c.fillStyle = '#000095'; c.fillRect(0, 0, w / 2, h / 2); star(c, w / 4, h / 4, h * 0.16, '#ffffff', 12, 0, 0.6); disc(c, w / 4, h / 4, h * 0.08, '#000095'); disc(c, w / 4, h / 4, h * 0.065, '#ffffff'); },
  JP(c, w, h) { c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); disc(c, w / 2, h / 2, h * 0.3, '#bc002d'); },
  KR(c, w, h) {
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
    const r = h * 0.25, x = w / 2, y = h / 2;
    disc(c, x, y, r, '#0047a0'); c.fillStyle = '#cd2e3a'; c.beginPath(); c.arc(x, y, r, Math.PI, 0); c.fill();
    disc(c, x - r / 2, y, r / 2, '#cd2e3a'); disc(c, x + r / 2, y, r / 2, '#0047a0');
    c.fillStyle = '#000';
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { c.save(); c.translate(x + sx * w * 0.32, y + sy * h * 0.3); c.rotate(Math.atan2(sy * h * 0.3, sx * w * 0.32) + Math.PI / 2); for (let i = 0; i < 3; i++) c.fillRect(-h * 0.08, (i - 1) * h * 0.04, h * 0.16, h * 0.025); c.restore(); }
  },
  VN(c, w, h) { c.fillStyle = '#da251d'; c.fillRect(0, 0, w, h); star(c, w / 2, h / 2, h * 0.3, '#ffff00'); },
  TH(c, w, h) { bands(c, w, h, ['#a51931', '#f4f5f8', '#2d2a4a', '#f4f5f8', '#a51931'], 'h', [1, 1, 2, 1, 1]); },
  PH(c, w, h) { bands(c, w, h, ['#0038a8', '#ce1126']); poly(c, [[0, 0], [h * 0.87, h / 2], [0, h]], '#ffffff'); star(c, h * 0.3, h / 2, h * 0.11, '#fcd116', 8, 0, 0.5); },
  ID(c, w, h) { bands(c, w, h, ['#ce1126', '#ffffff']); },
  MY(c, w, h) { for (let i = 0; i < 14; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#cc0001'; c.fillRect(0, (i * h) / 14, w, h / 14 + 1); } c.fillStyle = '#010066'; c.fillRect(0, 0, w / 2, h / 2); crescent(c, w * 0.2, h / 4, h * 0.17, '#ffcc00', '#010066', 0.3); star(c, w * 0.33, h / 4, h * 0.1, '#ffcc00', 14, 0, 0.5); },
  SG(c, w, h) { bands(c, w, h, ['#ef3340', '#ffffff']); crescent(c, w * 0.17, h * 0.25, h * 0.15, '#ffffff', '#ef3340', 0.35); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * TAU) / 5; star(c, w * 0.27 + Math.cos(a) * h * 0.08, h * 0.25 + Math.sin(a) * h * 0.08, h * 0.03, '#ffffff'); } },
  AU(c, w, h) { c.fillStyle = '#012169'; c.fillRect(0, 0, w, h); union(c, 0, 0, w / 2, h / 2); star(c, w / 4, h * 0.75, h * 0.12, '#ffffff', 7); for (const [x, y] of [[0.75, 0.2], [0.62, 0.45], [0.87, 0.4], [0.75, 0.82]]) star(c, w * x, h * y, h * 0.06, '#ffffff', 7); },
  NZ(c, w, h) { c.fillStyle = '#012169'; c.fillRect(0, 0, w, h); union(c, 0, 0, w / 2, h / 2); for (const [x, y] of [[0.75, 0.2], [0.65, 0.45], [0.85, 0.42], [0.75, 0.8]]) { star(c, w * x, h * y, h * 0.075, '#ffffff'); star(c, w * x, h * y, h * 0.05, '#c8102e'); } },
  RU(c, w, h) { bands(c, w, h, ['#ffffff', '#0039a6', '#d52b1e']); },
  SA(c, w, h) { c.fillStyle = '#006c35'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffffff'; c.fillRect(w * 0.25, h * 0.66, w * 0.5, h * 0.04); for (let i = 0; i < 7; i++) c.fillRect(w * (0.27 + i * 0.07), h * 0.3, w * 0.025, h * 0.22); },
  AE(c, w, h) { bands(c, w, h, ['#00732f', '#ffffff', '#000000']); c.fillStyle = '#ff0000'; c.fillRect(0, 0, w / 4, h); },
  XX(c, w, h) { c.fillStyle = '#3f8fb8'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffffff'; c.globalAlpha = 0.85; for (let i = 0; i < 3; i++) { c.beginPath(); for (let x = 0; x <= w; x += 2) c.lineTo(x, h * (0.35 + i * 0.16) + Math.sin(x / w * TAU * 1.5) * h * 0.04); c.lineWidth = h * 0.04; c.strokeStyle = '#ffffff'; c.stroke(); } c.globalAlpha = 1; star(c, w * 0.82, h * 0.2, h * 0.1, '#ffe080'); },
};

/** The countries the creator offers (A-Z by name, with "Somewhere else" last). */
export const COUNTRIES = [
  ['AR', 'Argentina'], ['AU', 'Australia'], ['AT', 'Austria'], ['BD', 'Bangladesh'], ['BE', 'Belgium'], ['BR', 'Brazil'], ['CA', 'Canada'], ['CL', 'Chile'],
  ['CN', 'China'], ['CO', 'Colombia'], ['CU', 'Cuba'], ['CZ', 'Czechia'], ['DK', 'Denmark'], ['EG', 'Egypt'], ['ET', 'Ethiopia'], ['FI', 'Finland'],
  ['FR', 'France'], ['DE', 'Germany'], ['GH', 'Ghana'], ['GR', 'Greece'], ['HU', 'Hungary'], ['IS', 'Iceland'], ['IN', 'India'], ['ID', 'Indonesia'],
  ['IE', 'Ireland'], ['IL', 'Israel'], ['IT', 'Italy'], ['JM', 'Jamaica'], ['JP', 'Japan'], ['KE', 'Kenya'], ['MY', 'Malaysia'], ['MX', 'Mexico'],
  ['MA', 'Morocco'], ['NL', 'Netherlands'], ['NZ', 'New Zealand'], ['NG', 'Nigeria'], ['NO', 'Norway'], ['PK', 'Pakistan'], ['PE', 'Peru'], ['PH', 'Philippines'],
  ['PL', 'Poland'], ['PT', 'Portugal'], ['PR', 'Puerto Rico'], ['RO', 'Romania'], ['RU', 'Russia'], ['SA', 'Saudi Arabia'], ['SG', 'Singapore'], ['ZA', 'South Africa'],
  ['KR', 'South Korea'], ['ES', 'Spain'], ['SE', 'Sweden'], ['CH', 'Switzerland'], ['TW', 'Taiwan'], ['TH', 'Thailand'], ['TR', 'Türkiye'], ['UA', 'Ukraine'],
  ['AE', 'United Arab Emirates'], ['GB', 'United Kingdom'], ['US', 'United States'], ['VE', 'Venezuela'], ['VN', 'Vietnam'],
  ['XX', 'Somewhere else'],
].map(([code, name]) => ({ code, name }));
export const COUNTRY_BY_CODE = Object.fromEntries(COUNTRIES.map((c) => [c.code, c]));

/** A code we know, or null (other players' data is untrusted). */
export function cleanCountry(code) { return typeof code === 'string' && /^[A-Z]{2}$/.test(code) && Object.hasOwn(P, code) ? code : null; }

/** Paint a flag into a canvas 2D context, filling w x h at (0, 0). Unknown codes paint "Somewhere else". */
export function drawFlag(c, code, w, h) {
  c.save();
  c.clearRect(0, 0, w, h);
  (cleanCountry(code) ? P[code] : P.XX)(c, w, h);
  c.restore();
}

/** A small canvas with the flag on it (for menus). */
export function flagCanvas(code, w = 36, h = 24) {
  const cv = document.createElement('canvas');
  const s = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(w * s); cv.height = Math.round(h * s);
  cv.style.width = `${w}px`; cv.style.height = `${h}px`;
  cv.className = 'flag-cv';
  const c = cv.getContext('2d');
  c.scale(s, s);
  drawFlag(c, code, w, h);
  return cv;
}

/** Pure: the record holder among untrusted docs for a week, or null. */
export function flagHolder(docs, week) {
  let best = null;
  for (const d of docs || []) {
    if (!d || d.week !== week) continue;
    const w = Number(d.w);
    if (!(w > 0 && w < 5000)) continue;
    const at = Number(d.at) || 0;
    if (!best || w > best.w || (w === best.w && at < best.at)) best = { id: String(d.id || ''), w, sp: SPECIES_BY_ID[d.sp] ? d.sp : null, name: String(d.name || 'An angler').slice(0, 20), cc: cleanCountry(d.cc) || 'XX', at };
  }
  return best;
}

