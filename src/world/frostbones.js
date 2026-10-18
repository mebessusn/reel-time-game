// The Frozen Leviathan (v1.9.11): the skeleton of an enormous ancient fish lying frozen on the north shore of
// Frostpine Lake, its ribs arching high enough to walk under, the tail locked in a block of clear ice and the
// great largemouth-bass skull gaping, toothy jaw propped on heaped ice. Modelled in Blender (art/frostbones.blend -> art/frostbones.glb ->
// src/data/frostbonesMesh.js via scripts/glb-to-js.mjs). The icy look is painted here: a world-space
// (triplanar) frost texture on the bones with snow settling on their tops, and glassy, cracked, glinting ice.
import * as THREE from 'three';
import { FROSTBONES_MATS, FROSTBONES_NODES } from '../data/frostbonesMesh.js';
import { WATER_Y } from './terrain.js';
import { addCircle } from './colliders.js';
import { mulberry32 } from '../core/rng.js';

/** Where it lies: model +X (the skull) points along yaw. */
export const LEVIATHAN = { x: -143, z: -140, yaw: 3.0 - Math.PI, len: 46, wide: 12 }; // v1.9.13: mid-lake; v1.10: turned 180°, skull to the east
const ux = Math.cos(LEVIATHAN.yaw), uz = -Math.sin(LEVIATHAN.yaw);
/** Model-local (x along the fish, y across it) to world x/z. */
export function leviathanWorld(lx, ly) { return { x: LEVIATHAN.x + ux * lx - uz * ly, z: LEVIATHAN.z + uz * lx + ux * ly }; }
/** True when (x, z) lies within the skeleton's footprint (plus pad): trees, grass and dressing keep off. */
export function leviathanAt(x, z, pad = 0) {
  const dx = x - LEVIATHAN.x, dz = z - LEVIATHAN.z;
  const lx = dx * ux + dz * uz, ly = -dx * uz + dz * ux;
  return Math.abs(lx - 1) < 26.5 + pad && Math.abs(ly) < LEVIATHAN.wide + pad;
}

// ---------------- painted ice and frost (canvas textures, no image files)
let frostTex = null, crackTex = null;
function frost() {
  if (frostTex) return frostTex;
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const c = cv.getContext('2d'), r = mulberry32(31);
  c.fillStyle = '#e9edef'; c.fillRect(0, 0, S, S);
  for (let k = 0; k < 1400; k++) { c.fillStyle = r() < 0.5 ? `rgba(160,180,195,${0.08 + r() * 0.12})` : `rgba(255,255,255,${0.2 + r() * 0.3})`; c.fillRect(r() * S, r() * S, 1 + r() * 3, 1 + r() * 3); }
  // hairline cracks and grain in the old bone
  c.strokeStyle = 'rgba(120,135,150,0.35)'; c.lineWidth = 1;
  for (let k = 0; k < 40; k++) { c.beginPath(); let x = r() * S, y = r() * S; c.moveTo(x, y); for (let s = 0; s < 6; s++) { x += (r() - 0.5) * 24; y += (r() - 0.3) * 18; c.lineTo(x, y); } c.stroke(); }
  // feathery frost crystals
  c.strokeStyle = 'rgba(255,255,255,0.7)';
  for (let k = 0; k < 70; k++) { const x = r() * S, y = r() * S, L = 3 + r() * 6; for (let a = 0; a < 6; a++) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); c.stroke(); } }
  frostTex = new THREE.CanvasTexture(cv); frostTex.wrapS = frostTex.wrapT = THREE.RepeatWrapping; frostTex.colorSpace = THREE.SRGBColorSpace; frostTex.anisotropy = 4;
  return frostTex;
}
function cracks() {
  if (crackTex) return crackTex;
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const c = cv.getContext('2d'), r = mulberry32(57);
  const g = c.createLinearGradient(0, 0, S, S); g.addColorStop(0, '#d4eef8'); g.addColorStop(0.5, '#eaf8ff'); g.addColorStop(1, '#c6e4f2');
  c.fillStyle = g; c.fillRect(0, 0, S, S);
  // trapped bubbles
  for (let k = 0; k < 160; k++) { c.fillStyle = `rgba(255,255,255,${0.25 + r() * 0.4})`; c.beginPath(); c.arc(r() * S, r() * S, 0.6 + r() * 2.2, 0, 6.3); c.fill(); }
  // fracture lines: long white cracks branching through the ice
  for (let k = 0; k < 18; k++) {
    let x = r() * S, y = r() * S, a = r() * 6.3;
    c.strokeStyle = `rgba(255,255,255,${0.5 + r() * 0.4})`; c.lineWidth = 0.8 + r() * 1.2;
    c.beginPath(); c.moveTo(x, y);
    for (let s = 0; s < 8; s++) { a += (r() - 0.5) * 1.1; x += Math.cos(a) * 14; y += Math.sin(a) * 14; c.lineTo(x, y); }
    c.stroke();
  }
  crackTex = new THREE.CanvasTexture(cv); crackTex.wrapS = crackTex.wrapT = THREE.RepeatWrapping; crackTex.colorSpace = THREE.SRGBColorSpace; crackTex.anisotropy = 4;
  return crackTex;
}
// triplanar sampling shared by the materials: uv from world position, blended by the normal
const TRI_V = ['#include <common>', '#include <common>\nvarying vec3 vTWP; varying vec3 vTWN;'];
const TRI_P = ['#include <project_vertex>', '#include <project_vertex>\nvTWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vTWN = normalize(mat3(modelMatrix) * objectNormal);'];
const TRI = (tex, s) => `vec3 tbw = pow(abs(vTWN), vec3(4.0)); tbw /= (tbw.x + tbw.y + tbw.z + 1e-4);
  vec3 tri = texture2D(${tex}, vTWP.zy * ${s}).rgb * tbw.x + texture2D(${tex}, vTWP.xz * ${s}).rgb * tbw.y + texture2D(${tex}, vTWP.xy * ${s}).rgb * tbw.z;`;
function boneMat(color = '#eef2f4') {
  const m = new THREE.MeshLambertMaterial({ color, emissive: new THREE.Color('#1b2833') });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.tFrost = { value: frost() };
    sh.vertexShader = sh.vertexShader.replace(...TRI_V).replace(...TRI_P);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tFrost; varying vec3 vTWP; varying vec3 vTWN;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        ${TRI('tFrost', '0.6')}
        diffuseColor.rgb *= tri;
        // snow and hoarfrost settle on everything facing up; the undersides go a cold blue-grey
        float up = smoothstep(0.35, 0.85, vTWN.y);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.97, 0.99, 1.0), up * 0.8);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.55, 0.66, 0.76), smoothstep(-0.2, -0.9, vTWN.y) * 0.45);`);
  };
  m.customProgramCacheKey = () => 'leviathan-bone';
  return m;
}
/** The deep hollows of the eye sockets: near-black, a faint cold blue, no frost. */
function hollowMat() {
  const m = new THREE.MeshLambertMaterial({ color: '#141b22', emissive: new THREE.Color('#05090d') });
  return m;
}
function iceMat() {
  const m = new THREE.MeshPhongMaterial({ color: '#a8dcf2', specular: '#ffffff', shininess: 140, emissive: new THREE.Color('#0e3448'), transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: true }); // v1.9.13: writes depth and draws before the lake (renderOrder 1), so the water covers the slab's submerged skirt and not its top
  m.onBeforeCompile = (sh) => {
    sh.uniforms.tCrack = { value: cracks() };
    sh.vertexShader = sh.vertexShader.replace(...TRI_V).replace(...TRI_P);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tCrack; varying vec3 vTWP; varying vec3 vTWN;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        ${TRI('tCrack', '0.35')}
        diffuseColor.rgb *= tri;`)
      .replace('#include <opaque_fragment>', `// glassy edges: brighter and more solid where you look across the surface
        vec3 vdir = normalize(cameraPosition - vTWP);
        float fr = pow(1.0 - abs(dot(vdir, normalize(vTWN))), 2.5);
        outgoingLight += vec3(0.55, 0.8, 0.95) * fr * 0.6;
        diffuseColor.a = clamp(diffuseColor.a + fr * 0.25, 0.0, 1.0);
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'leviathan-ice';
  return m;
}
function snowMat() {
  const m = new THREE.MeshLambertMaterial({ color: '#f4f8fb', emissive: new THREE.Color('#121a22') });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.tFrost = { value: frost() };
    sh.vertexShader = sh.vertexShader.replace(...TRI_V).replace(...TRI_P);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tFrost; varying vec3 vTWP; varying vec3 vTWN;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        ${TRI('tFrost', '0.9')}
        diffuseColor.rgb *= mix(vec3(1.0), tri, 0.35);`);
  };
  m.customProgramCacheKey = () => 'leviathan-snow';
  return m;
}

export function buildLeviathan(scene) {
  const mats = FROSTBONES_MATS.map((m) => (m.name === 'ice' ? iceMat() : m.name === 'snow' ? snowMat() : m.name === 'hollow' ? hollowMat() : m.name === 'bone_dark' ? boneMat('#b4bec6') : boneMat()));
  const g = new THREE.Group();
  g.name = 'frozen-leviathan';
  for (const n of FROSTBONES_NODES) {
    const node = new THREE.Group();
    node.position.fromArray(n.t); node.quaternion.fromArray(n.r); node.scale.fromArray(n.s);
    for (const p of n.prims) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p.pos), 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(p.nrm), 3, true));
      geo.setIndex(Math.max(...p.idx) > 65535 ? new THREE.Uint32BufferAttribute(p.idx, 1) : new THREE.Uint16BufferAttribute(p.idx, 1));
      const mat = mats[p.m];
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = !mat.transparent; mesh.receiveShadow = true;
      if (mat.transparent) mesh.renderOrder = 1;
      node.add(mesh);
    }
    g.add(node);
  }
  // float it: the ice slab's top stands a hand's breadth above the lake, its skirt reaching down into the water
  const y = WATER_Y + 0.6;
  g.position.set(LEVIATHAN.x, y, LEVIATHAN.z);
  g.rotation.y = LEVIATHAN.yaw;
  scene.add(g);
  // solid where it stands on the ground: the rib feet, the skull, the frozen tail and the jaw's ice
  const xs = Array.from({ length: 38 }, (_, i) => -19 + 0.85 * i).slice(10, 31).filter((_, i) => i % 2 === 0);
  for (const x of xs) {
    const span = 4.6 + 1.6 * Math.sin(Math.PI * (x + 10) / 22);
    for (const sd of [1, -1]) { const w = leviathanWorld(x - 1.4, sd * span * 0.92); addCircle(w.x, w.z, 0.55); }
  }
  // boats bump into the ice slab (circles down its length, as wide as the slab there) and the chin's ice heap
  for (let lx = -24; lx <= 24; lx += 3) {
    const r = 11.8 * Math.sqrt(Math.max(0, 1 - ((lx + 2) / 27.5) ** 2));
    if (r > 1) { const w = leviathanWorld(lx, 0); addCircle(w.x, w.z, r, { water: true }); }
  }
  { const w = leviathanWorld(24.7, 0); addCircle(w.x, w.z, 2.8, { water: true }); }
  for (const [lx, ly, r] of [[18.6, 0, 3.4], [14.6, 0, 2.6], [22.2, 0, 2.4], [24.7, 0, 2.3], [-19.5, 0, 3.1], [-16.8, 0.3, 1.9], [-22, 0, 2.2]]) { const w = leviathanWorld(lx, ly); addCircle(w.x, w.z, r); }
  return g;
}
