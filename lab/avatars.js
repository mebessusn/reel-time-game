// Dev-only lab: renders a grid of avatars (one per option) from front, side and back so hair, hats and
// clothes can be checked at a glance. Open /lab/avatars.html?set=hair (or hats, shirts, pants, acc).
import * as THREE from 'three';
import { buildAvatar, animateAvatar } from '../src/entities/avatar2.js';
import * as O from '../src/data/avatarOptions.js';

const q = new URLSearchParams(location.search);
const set = q.get('set') || 'hair';
const base = { ...O.defaultAvatar('female'), hairColor: +(q.get('hc') ?? 3), skin: 2, hat: 'none', shirt: 'tee', shirtColor: 2 };
const lists = {
  hair: O.HAIR_STYLES.map((h) => ({ ...base, hair: h.id, label: h.name })),
  hats: O.HATS.map((h) => ({ ...base, hair: q.get('hair') || 'long', hat: h.id, label: h.name })),
  shirts: O.SHIRTS.map((h, i) => ({ ...base, pants: 'cargo', pantsColor: 1, shirt: h.id, shirtColor: [0, 9, 1, 11, 5, 3, 8, 10, 2, 13, 12, 14, 7, 1, 15, 0][i % 16], label: h.name })),
  pants: O.PANTS.map((h, i) => ({ ...base, shirt: 'tee', shirtColor: 13, pants: h.id, pantsColor: i % 10, label: h.name })),
  acc: O.ACCESSORIES.map((h) => ({ ...base, accessory: h.id, label: h.name })),
  hairhat: O.HAIR_STYLES.map((h) => ({ ...base, hair: h.id, hat: q.get('hat') || 'sunhat', label: h.name })),
  eyewear: O.EYEWEAR.map((h) => ({ ...base, hair: 'bob', eyewear: h.id, label: h.name })),
  outfit: [
    { ...base, label: 'Sundress + sun hat', shirt: 'sundress', shirtColor: 9, hat: 'sunhat', eyewear: 'bigsunnies', hair: 'wavy', shoes: 'sandals' },
    { ...base, label: 'Piggy hat', shirt: 'sundress', shirtColor: 8, hat: 'pighat', eyewear: 'heart', hair: 'pigtails', shoes: 'sandals' },
    { ...base, label: 'Angler', shirt: 'flannel', hat: 'boonie', pants: 'waders', accessory: 'net', eyewear: 'aviators' },
    { ...base, label: 'Beach', shirt: 'hawaiian', shirtColor: 10, pants: 'shorts', accessory: 'lei', eyewear: 'roundshades', hat: 'boater' },
    { ...base, label: 'Long skirt', shirt: 'cardigan', shirtColor: 12, pants: 'longskirt', pantsColor: 7, hat: 'beret', accessory: 'satchel' },
    { ...base, label: 'Dapper', shirt: 'polo', hat: 'hat_tophat', accessory: 'bowtie', pants: 'wideleg', pantsColor: 6 },
  ],
  eyes: O.EYES.map((h) => ({ ...base, hair: 'crop', eyes: h.id, eyeColor: 2, label: h.name })),
  brows: O.BROWS.map((h) => ({ ...base, hair: 'crop', brows: h.id, label: h.name })),
  mouths: O.MOUTHS.map((h) => ({ ...base, hair: 'crop', mouth: h.id, label: h.name })),
  dress: ['slim', 'standard', 'broad'].flatMap((fr) => ['short', 'medium', 'tall'].map((ht) => ({ ...base, frame: fr, height: ht, shirt: 'sundress', shirtColor: 8, pants: 'joggers', label: `${fr} ${ht}` }))),
  extras: O.EXTRAS.map((h) => ({ ...base, extras: [h.id], label: h.name })),
};
const items = lists[set] || lists.hair;
const angles = (q.get('angles') || '0,1.57,3.14').split(',').map(Number);
const cols = Math.min(items.length, +(q.get('cols') || 6));
const rows = Math.ceil(items.length / cols);
const CW = 200, CH = 220;
const W = cols * CW, H = rows * CH * angles.length;
const r = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
r.setSize(W, H); r.setScissorTest(true);
document.body.append(r.domElement);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight('#ffffff', '#6a5a4a', 1.1));
const sun = new THREE.DirectionalLight('#fff4e0', 1.1); sun.position.set(2, 3, 4); scene.add(sun);
const cam = new THREE.PerspectiveCamera(30, CW / CH, 0.1, 20);
const label = document.createElement('canvas'); label.width = W; label.height = H;
Object.assign(label.style, { position: 'absolute', left: 0, top: 0, pointerEvents: 'none' });
document.body.append(label);
const lx = label.getContext('2d'); lx.font = 'bold 13px sans-serif'; lx.fillStyle = '#fff';
items.forEach((cfg, i) => {
  const av = buildAvatar(cfg);
  animateAvatar(av, 'idle', 0);
  scene.add(av.group);
  angles.forEach((a, k) => {
    av.group.rotation.y = a;
    const cx = (i % cols) * CW, cy = (Math.floor(i / cols) * angles.length + k) * CH;
    cam.position.set(0, +(q.get('cy') ?? 1.25), +(q.get('cd') ?? 3.6)); cam.lookAt(0, +(q.get('ly') ?? 0.95), 0);
    r.setViewport(cx, H - cy - CH, CW, CH); r.setScissor(cx, H - cy - CH, CW, CH);
    r.setClearColor(k % 2 ? '#2f5a50' : '#2a4a42'); r.clear();
    r.render(scene, cam);
    if (k === 0) lx.fillText(cfg.label, cx + 6, cy + 16);
  });
  scene.remove(av.group);
});
window.__done = true;
