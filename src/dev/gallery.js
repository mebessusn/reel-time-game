// Dev-only asset gallery: /gallery.html?set=avatars|fish|boats|props&yaw=-0.5&cols=6
// Lays models out on a grid under the game's lighting so restyled assets can be reviewed side by side.
import * as THREE from 'three';

const q = new URLSearchParams(location.search);
const set = q.get('set') || 'avatars';
const W = +(q.get('w') || 1400), H = +(q.get('h') || 900);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
document.body.append(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#cfc4ad');
scene.add(new THREE.HemisphereLight('#fff4e0', '#5a6a80', 1.4));
const sun = new THREE.DirectionalLight('#fff2dc', 2.0);
sun.position.set(-4, 8, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12 });
scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.18 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

async function items() {
  if (set === 'avatars') {
    const { buildAvatar } = await import('../entities/avatar2.js');
    const { randomAvatar } = await import('../data/avatarOptions.js');
    const { SAMPLES } = await import('./samples.js');
    let seed = +(q.get('seed') || 7);
    const r = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const vary = q.get('vary');
    if (vary) {
      const O = await import('../data/avatarOptions.js');
      const lists = { hair: O.HAIR_STYLES, hat: O.HATS, shirt: O.SHIRTS, pants: O.PANTS, eyes: O.EYES, mouth: O.MOUTHS, facialHair: O.FACIAL_HAIR, extras: O.EXTRAS, accessory: O.ACCESSORIES, shoes: O.SHOES, brows: O.BROWS, frame: O.FRAMES, height: O.HEIGHTS };
      const base = { ...SAMPLES[+(q.get('base') || 0)] };
      return lists[vary].map((o) => {
        const c = { ...base, [vary]: vary === 'extras' ? [o.id] : o.id };
        if (vary === 'hair') c.hat = 'none';
        const a = buildAvatar(c); return { obj: a.group, label: o.id };
      });
    }
    const cfgs = [...SAMPLES];
    while (cfgs.length < +(q.get('n') || 12)) cfgs.push(randomAvatar(r, new Set(['hat_straw', 'hat_bucket_tan', 'hat_captain', 'hat_crown', 'shirt_raincoat_yellow', 'acc_vest', 'acc_scarf', 'acc_backpack', 'acc_cat'])));
    return cfgs.map((c) => { const a = buildAvatar(c); return { obj: a.group, label: `${c.hair}/${c.shirt}/${c.pants}/${c.hat}` }; });
  }
  if (set === 'fish') {
    const { buildFish } = await import('../entities/fish.js');
    const { SPECIES } = await import('../data/species.js');
    const v = q.get('variant') || 'normal';
    const only = q.get('only')?.split(',');
    return SPECIES.filter((sp) => !only || only.includes(sp.id)).map((sp) => { const m = buildFish(sp.id, v); m.geometry?.computeBoundingSphere?.(); m.scale.setScalar(1); const g = new THREE.Group(); g.add(m); fit(g, 0.9); return { obj: g, label: sp.id }; });
  }
  if (set === 'gus') {
    const { buildGus } = await import('../entities/gus.js');
    return [-0.3, 1.2, 2.6].map((yy) => { const g = buildGus(); g.rotation.y = yy; return { obj: g, label: 'gus', keepYaw: true }; });
  }
  if (set === 'boats') {
    const { buildBoat } = await import('../entities/gear.js');
    const { ITEMS } = await import('../data/items.js');
    return ITEMS.filter((i) => i.kind === 'boat').map((b) => ({ obj: buildBoat(b.id), label: b.id }));
  }
  return [];
}

function fit(obj, size) {
  const box = new THREE.Box3().setFromObject(obj);
  const s = box.getSize(new THREE.Vector3());
  const k = size / Math.max(s.x, s.y, s.z);
  obj.scale.multiplyScalar(k);
  const c = new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3());
  obj.children.forEach((ch) => ch.position.sub(new THREE.Vector3(c.x, 0, c.z).divideScalar(k)));
}

const list = await items();
const cols = +(q.get('cols') || Math.ceil(Math.sqrt(list.length * 1.6)));
const gap = +(q.get('gap') || (set === 'boats' ? 4.4 : set === 'fish' ? 1.3 : 1.25));
const yaw = +(q.get('yaw') || -0.45);
list.forEach((it, i) => {
  const r = Math.floor(i / cols), c = i % cols;
  it.obj.position.set((c - (cols - 1) / 2) * gap, set === 'fish' ? 0.5 : 0, r * gap * (set === 'fish' ? 0.8 : 1.15));
  if (!it.keepYaw) it.obj.rotation.y = set === 'fish' ? -Math.PI / 2 + yaw + 1.2 : yaw;
  it.obj.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  scene.add(it.obj);
});
const rows = Math.ceil(list.length / cols);
const cam = new THREE.PerspectiveCamera(+(q.get('fov') || 30), W / H, 0.1, 200);
const rowStep = gap * (set === 'fish' ? 0.8 : 1.15);
const zc = ((rows - 1) * rowStep) / 2;
const hfov = 2 * Math.atan(Math.tan((cam.fov * Math.PI) / 360) * cam.aspect);
const needW = cols * gap * 1.08, needD = rows * rowStep + 1.5;
const dist = (1 / +(q.get('zoom') || 1)) * Math.max((needW / 2) / Math.tan(hfov / 2), (needD / 2) / Math.tan((cam.fov * Math.PI) / 360) * 1.3);
const pitch = +(q.get('pitch') || 0.42);
const target = new THREE.Vector3(0, set === 'avatars' ? 0.7 : 0.4, zc);
cam.position.set(0, target.y + Math.sin(pitch) * dist, zc + Math.cos(pitch) * dist);
cam.lookAt(target);
// labels
for (const it of list) {
  const p = it.obj.position.clone(); p.y -= 0.05; p.z += 0.4; p.project(cam);
  const el = document.createElement('div');
  el.textContent = it.label;
  Object.assign(el.style, { position: 'absolute', left: `${(p.x * 0.5 + 0.5) * W}px`, top: `${(-p.y * 0.5 + 0.5) * H}px`, transform: 'translateX(-50%)', color: '#3b2a1e', fontWeight: 'bold' });
  document.body.append(el);
}
renderer.render(scene, cam);
window.__galleryDone = true;
