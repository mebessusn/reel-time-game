// v1.14.10: a polaroid from the Field Guide camera. shoot() renders what you're pointing the camera at (from your own
// eye, you out of the way), prints it on instant film like the selfie camera does, keeps it in the photo album, and
// shows the print on screen for a few seconds while it "develops".
import * as THREE from 'three';
import { h } from './dom.js';
import { album } from './selfie.js';

const PHOTO = 512;
let cam = null;

/** Render from (eye) toward (at) and return a square canvas with the instant-film look. */
export function renderFrom(game, eye, at) {
  const eng = game.engine, src = eng.renderer.domElement;
  if (!cam) cam = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
  cam.aspect = src.width / Math.max(1, src.height); cam.updateProjectionMatrix();
  cam.position.copy(eye); cam.lookAt(at);
  const me = game.actor?.root, was = me?.visible;
  if (me) me.visible = false;
  eng.renderer.render(eng.scene, cam);
  if (me) me.visible = was;
  const s = Math.min(src.width, src.height), photo = document.createElement('canvas');
  photo.width = photo.height = PHOTO;
  const p = photo.getContext('2d');
  p.drawImage(src, (src.width - s) / 2, (src.height - s) / 2, s, s, 0, 0, PHOTO, PHOTO);
  p.globalCompositeOperation = 'soft-light'; p.fillStyle = 'rgba(255,190,120,0.35)'; p.fillRect(0, 0, PHOTO, PHOTO);
  p.globalCompositeOperation = 'lighten'; p.fillStyle = 'rgba(40,30,40,1)'; p.fillRect(0, 0, PHOTO, PHOTO);
  p.globalCompositeOperation = 'source-over';
  const vg = p.createRadialGradient(PHOTO / 2, PHOTO / 2, PHOTO * 0.35, PHOTO / 2, PHOTO / 2, PHOTO * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(30,15,0,0.38)');
  p.fillStyle = vg; p.fillRect(0, 0, PHOTO, PHOTO);
  return photo;
}

/** A photo on a polaroid with two hand-written lines. Returns a JPEG data URL. */
export function print(photo, line1, line2) {
  const W = PHOTO + 64, H = PHOTO + 170, pc = document.createElement('canvas');
  pc.width = W; pc.height = H;
  const c = pc.getContext('2d');
  c.fillStyle = '#f7f3ea'; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(120,100,70,${Math.random() * 0.05})`; c.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
  c.drawImage(photo, 32, 32);
  c.strokeStyle = 'rgba(0,0,0,0.12)'; c.lineWidth = 2; c.strokeRect(32, 32, PHOTO, PHOTO);
  c.textAlign = 'center';
  c.fillStyle = '#2e3a6a'; c.font = 'italic 800 34px Nunito, "Segoe Print", "Comic Sans MS", cursive'; c.fillText(line1, W / 2, PHOTO + 100, W - 60);
  c.fillStyle = '#6a5a4a'; c.font = '600 21px Nunito, system-ui, sans-serif'; c.fillText(line2, W / 2, PHOTO + 136, W - 60);
  c.font = '16px Silkscreen, monospace'; c.fillStyle = '#b8a888'; c.fillText('REEL TIME · FIELD GUIDE', W / 2, H - 14);
  return pc.toDataURL('image/jpeg', 0.86);
}

/** The print slides in, develops from white, sits for a moment and slides away. */
export function showPrint(game, url, caption, ms = 3600) {
  document.querySelector('.snap-print')?.remove();
  const el = h('div.snap-print', { role: 'img', 'aria-label': caption }, h('img', { src: url, alt: caption }), h('div.snap-dev'));
  game.ui.root.append(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { el.classList.remove('in'); el.classList.add('out'); setTimeout(() => el.remove(), 500); }, ms);
}

/** Shoot, print, keep and show: everything the Field Guide camera does. */
export function shoot(game, eye, at, line1, line2) {
  const photo = renderFrom(game, eye, at);
  const url = print(photo, line1, line2), caption = `${line1} — ${line2}`;
  album.add({ id: Date.now().toString(36), url, caption, ts: Date.now() });
  showPrint(game, url, caption);
  return url;
}
