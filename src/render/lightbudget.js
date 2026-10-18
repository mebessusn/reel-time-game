// v1.13.19: a budget for point lights. Three.js puts every visible light into every lit shader, even at intensity 0,
// so the valley's 11 lamp/fire/cave lights cost every pixel all day long. Now only K of them are visible at once,
// the ones that matter most near you; when none is lit (most of the day) none is visible. Spare slots are padded with
// dark dummy lights, so the shaders only ever see two set-ups, 0 or K point lights (plus the lighthouse spot with the
// K), and both are compiled on the loading screen (precompile below), so dusk never hitches.
import * as THREE from 'three';

export const K = 4;
let lights = [], scanT = 0, dummies = null, spots = [];
let on = false;

function scan(scene) {
  lights = []; spots = [];
  scene.traverse((o) => {
    if (o.userData.lbDummy) return;
    if (o.isPointLight) lights.push(o);
    else if (o.isSpotLight) spots.push(o);
  });
}

function ensureDummies(scene) {
  if (dummies && dummies[0].parent === scene) return;
  dummies = Array.from({ length: K }, () => { const l = new THREE.PointLight('#000000', 0, 1, 2); l.userData.lbDummy = true; l.position.set(0, -500, 0); scene.add(l); return l; });
}

const v = new THREE.Vector3();
/** Pick which lights are visible this frame. focus: the player's position. */
export function updateLightBudget(dt, scene, focus, dark = 1) { // dark: 0 broad day .. 1 night (sky.night)
  scanT -= dt;
  if (scanT <= 0 || !lights.length) { scanT = 2; scan(scene); }
  ensureDummies(scene);
  const lit = [];
  for (const l of lights) {
    if (l.intensity <= 0.001 || !inScene(l)) { l.visible = false; continue; }
    l.getWorldPosition(v);
    const d = Math.hypot(v.x - focus.x, v.y - focus.y, v.z - focus.z);
    const reach = (l.distance || 30) + 20; // lights well beyond their reach can't touch anything you see
    if (d > reach) { l.visible = false; continue; }
    // in daylight a lamp or the campfire adds nothing you can see; the cavern's lights (lbAlways) are in the dark anyway
    const k = l.userData.lbAlways ? 1 : Math.max(0, (dark - 0.15) / 0.35);
    const score = l.intensity * Math.min(1, k) * (1 - d / reach);
    if (score < 0.02) { l.visible = false; continue; }
    lit.push([l, score]);
  }
  lit.sort((a, b) => b[1] - a[1]);
  on = lit.length > 0;
  lit.forEach(([l], i) => { l.visible = i < K; });
  const pad = on ? Math.max(0, K - lit.length) : 0;
  dummies.forEach((d, i) => { d.visible = i < pad; });
  for (const s of spots) s.visible = on && inScene(s); // the lighthouse sweep rides with the lamps (one set-up, not two)
}

function inScene(o) { // a light whose parent chain is hidden (the cavern's group out of view) doesn't count
  for (let p = o.parent; p; p = p.parent) if (!p.visible) return false;
  return true;
}

/** Compile every material for both light set-ups (none, and K + the spot), with everything shown, so neither
 *  dusk nor reaching a new area for the first time stops to compile shaders. */
export async function precompile(renderer, scene, camera) {
  scan(scene); ensureDummies(scene);
  const hidden = [];
  scene.traverse((o) => { if (!o.visible) { hidden.push(o); o.visible = true; } });
  const setup = (lit) => {
    lights.forEach((l) => { l.visible = false; });
    dummies.forEach((d) => { d.visible = lit; });
    spots.forEach((s) => { s.visible = lit; });
  };
  try {
    for (const lit of [false, true]) {
      setup(lit);
      if (renderer.compileAsync) await renderer.compileAsync(scene, camera); else renderer.compile(scene, camera);
    }
  } finally {
    hidden.forEach((o) => { o.visible = false; });
    setup(false);
  }
}
