// Fish viewer: a big, rotatable 3D look at a fish. Drag to turn it, scroll or pinch to zoom,
// double-click to reset. One small WebGL renderer is shared by every viewer that opens.
import * as THREE from 'three';
import { buildFish } from '../entities/fish.js';
import { SPECIES_BY_ID, TIER_INFO, tierOf } from '../data/species.js';
import { h } from './dom.js';

let renderer = null;
let open = null;

function getRenderer() {
  if (renderer) return renderer;
  renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

export function viewerOpen() { return !!open; }
export function closeViewer() { open?.close(); }

/** @param {{ speciesId: string, variant?: string, weight?: number, sub?: string, onClose?: () => void }} opts */
export function openFishViewer(root, opts) {
  closeViewer();
  const sp = SPECIES_BY_ID[opts.speciesId];
  if (!sp) return;
  const variant = opts.variant || 'normal';
  const tier = TIER_INFO[tierOf(sp)];
  const vname = variant === 'diamond' ? 'Diamond ' : variant === 'gold' ? 'Gold ' : '';

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#fff4e0', '#4a5a78', 1.5));
  const key = new THREE.DirectionalLight('#ffffff', 1.6);
  key.position.set(2, 3, 2.5);
  const rim = new THREE.DirectionalLight('#a8c8ff', 0.7);
  rim.position.set(-3, 1, -2);
  scene.add(key, rim);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 50);

  const mesh = buildFish(sp.id, variant);
  mesh.geometry.computeBoundingSphere();
  mesh.scale.setScalar(1 / mesh.geometry.boundingSphere.radius);
  const pivot = new THREE.Group();
  pivot.add(mesh);
  scene.add(pivot);

  const view = { yaw: -0.6, pitch: 0.18, dist: 2.8, spin: true };
  const reset = () => Object.assign(view, { yaw: -0.6, pitch: 0.18, dist: 2.8 });

  const r = getRenderer();
  const canvas = r.domElement;
  canvas.className = 'viewer-canvas';
  const stage = h('div.viewer-stage', canvas);
  const card = h('div.viewer.paper',
    h('div.banner', { style: { background: variant === 'diamond' ? '#3ab0d0' : variant === 'gold' ? '#d89a20' : tier.color } }, `${vname}${tier.name}`),
    h('button.viewer-x', { title: 'Close (Esc)', on: { click: () => close() } }, '×'),
    stage,
    h('h3', `${vname}${sp.name}`),
    h('div.stats', opts.weight ? h('span', `${opts.weight.toFixed(2)} lb`) : null, opts.sub ? h('span', opts.sub) : null),
    h('div.muted.viewer-help', 'Drag to turn · scroll to zoom · double-click to reset'));
  const scrim = h('div.scrim.viewer-scrim', { on: { click: () => close() } });
  root.append(scrim, card);

  // input
  const ptrs = new Map();
  let pinch = 0;
  canvas.onpointerdown = (e) => { ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); canvas.setPointerCapture?.(e.pointerId); view.spin = false; };
  canvas.onpointermove = (e) => {
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      const d0 = Math.hypot(a.x - b.x, a.y - b.y);
      p.x = e.clientX; p.y = e.clientY;
      const d1 = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) view.dist = Math.min(7, Math.max(1.4, view.dist * (d0 / Math.max(1, d1))));
      pinch = 1;
      return;
    }
    view.yaw -= (e.clientX - p.x) * 0.011;
    view.pitch = Math.max(-1.3, Math.min(1.3, view.pitch + (e.clientY - p.y) * 0.009));
    p.x = e.clientX; p.y = e.clientY;
  };
  const up = (e) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = 0; };
  canvas.onpointerup = up;
  canvas.onpointercancel = up;
  canvas.onwheel = (e) => { e.preventDefault(); view.dist = Math.min(7, Math.max(1.4, view.dist * (1 + Math.sign(e.deltaY) * 0.1))); view.spin = false; };
  canvas.ondblclick = () => { reset(); view.spin = true; };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  window.addEventListener('keydown', onKey, true);

  let raf = 0, last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const w = stage.clientWidth || 300, hgt = stage.clientHeight || 220;
    if (canvas.width !== Math.round(w * r.getPixelRatio()) || canvas.height !== Math.round(hgt * r.getPixelRatio())) {
      r.setSize(w, hgt, false);
      camera.aspect = w / hgt;
      camera.updateProjectionMatrix();
    }
    if (view.spin) view.yaw += dt * 0.5;
    const t = now / 1000;
    mesh.rotation.y = Math.sin(t * 2.2) * 0.06; // a lazy swim wiggle
    camera.position.set(Math.sin(view.yaw) * Math.cos(view.pitch) * view.dist, Math.sin(view.pitch) * view.dist, Math.cos(view.yaw) * Math.cos(view.pitch) * view.dist);
    camera.lookAt(0, 0, 0);
    r.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  function close() {
    if (!open) return;
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKey, true);
    card.remove(); scrim.remove();
    scene.remove(pivot);
    open = null;
    opts.onClose?.();
  }
  open = { close };
}
