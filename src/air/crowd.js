// Skye's Air Races (v1.17.1): the crowd. Spectators fill the grandstands and line the start straight: each one a
// little figure (shoes, trousers, shirt, arms, head, hair or a hat) that bobs, claps, waves both arms, pumps a fist,
// or waves a flag on a pole. They're instanced (one draw for the people, one for the flags) and all the movement is in
// the vertex shader: the race only sets how excited they are (the lights, the start, a close finish).
import * as THREE from 'three';
import { mulberry32 } from '../core/rng.js';

const SHIRTS = ['#d8402e', '#2a62b0', '#f2c21a', '#2f8a4a', '#f07a2a', '#f2f0ea', '#7a3ab0', '#1e2c48', '#e85a8a', '#3ab0b0', '#9a6a3a', '#5a5a62'];
const PANTS = ['#2a3448', '#3a3a40', '#5a4a3a', '#2a4a6a', '#6a6a62', '#1e2228'];
const SKIN = ['#f2d0b4', '#e0b090', '#c08a62', '#9a6440', '#6a4028', '#f6dcc8'];
const HAIR = ['#2a1c14', '#5a3a1e', '#c89a52', '#1a1a1a', '#8a3a1e', '#b0aca4'];
const HATS = ['#d8402e', '#f2c21a', '#2a62b0', '#f2f0ea', '#2f8a4a', '#1e2c48'];
const FLAGS = [['#d8402e', '#f2f0ea'], ['#2a62b0', '#f2c21a'], ['#f2c21a', '#1c1e22'], ['#2f8a4a', '#f2f0ea'], ['#f07a2a', '#2a62b0'], ['#7a3ab0', '#f2c21a'], ['#f2f0ea', '#d8402e']];

// one figure, feet at the origin, facing +z, 1.72 m. aPart: 0 still, 1 left arm, 2 right arm, 3 head (turns a little).
// aMat: which colour a vertex takes: 0 shirt, 1 skin, 2 trousers, 3 hair, 4 shoes, 5 hat
function figureGeometry() {
  const pos = [], nrm = [], part = [], matA = [];
  const box = (cx, cy, cz, sx, sy, sz, p, m, taper = 1) => {
    const g = new THREE.BoxGeometry(sx, sy, sz); const a = g.attributes.position, n = g.attributes.normal, ix = g.index.array;
    for (const i of ix) {
      let x = a.getX(i), y = a.getY(i), z = a.getZ(i);
      if (y > 0) { x *= taper; z *= taper; }
      pos.push(cx + x, cy + y, cz + z); nrm.push(n.getX(i), n.getY(i), n.getZ(i)); part.push(p); matA.push(m);
    }
  };
  box(-0.1, 0.05, 0.03, 0.12, 0.1, 0.24, 0, 4); box(0.1, 0.05, 0.03, 0.12, 0.1, 0.24, 0, 4); // shoes
  box(-0.1, 0.48, 0, 0.13, 0.78, 0.15, 0, 2); box(0.1, 0.48, 0, 0.13, 0.78, 0.15, 0, 2); // legs
  box(0, 0.9, 0, 0.36, 0.14, 0.2, 0, 2); // hips
  box(0, 1.2, 0, 0.4, 0.5, 0.22, 0, 0, 1.05); // chest (a little broader at the shoulders)
  box(0, 1.47, 0, 0.1, 0.06, 0.1, 0, 1); // neck
  box(0, 1.6, 0.01, 0.22, 0.24, 0.22, 3, 1); // head
  box(0, 1.73, -0.02, 0.24, 0.07, 0.24, 3, 3); // hair (or a hat's crown, recoloured)
  box(0, 1.7, -0.1, 0.23, 0.14, 0.05, 3, 3);
  box(0, 1.69, 0.11, 0.26, 0.025, 0.12, 3, 5); // a cap's brim (hidden unless they've a hat)
  for (const [s, p] of [[-1, 1], [1, 2]]) { // arms: hanging from the shoulder at (±0.25, 1.42)
    box(s * 0.26, 1.22, 0, 0.1, 0.36, 0.11, p, 0); box(s * 0.26, 0.97, 0, 0.09, 0.2, 0.1, p, 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1)); g.setAttribute('aMat', new THREE.Float32BufferAttribute(matA, 1));
  return g;
}
// a flag on a pole: the pole from the hand up, the cloth at its top (uv.x 0 at the pole, 1 at the fly)
function flagGeometry() {
  const pole = new THREE.CylinderGeometry(0.018, 0.018, 1.5, 5); pole.translate(0, 0.75, 0);
  const cloth = new THREE.PlaneGeometry(0.9, 0.55, 10, 2); cloth.translate(0.45, 1.2, 0);
  const g = new THREE.BufferGeometry(), P = [], N = [], U = [], K = [];
  for (const [src, k] of [[pole.toNonIndexed(), 0], [cloth.toNonIndexed(), 1]]) {
    const a = src.attributes;
    for (let i = 0; i < a.position.count; i++) { P.push(a.position.getX(i), a.position.getY(i), a.position.getZ(i)); N.push(a.normal.getX(i), a.normal.getY(i), a.normal.getZ(i)); U.push(a.uv.getX(i), a.uv.getY(i)); K.push(k); }
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setAttribute('aCloth', new THREE.Float32BufferAttribute(K, 1));
  return g;
}

// the shared motion: how a figure bobs and what its arms do (kind: 0 clap, 1 wave both arms, 2 flag, 3 fist pump)
const MOTION = /* glsl */`
  uniform float uT; uniform float uEx;
  float bob(float ph, float kind) { return max(0.0, sin(uT * 7.0 + ph)) * (0.03 + 0.13 * uEx) * (kind == 2.0 ? 0.6 : 1.0); }
  mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
  mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
  // the arm's rotation about its shoulder
  mat3 armRot(float side, float kind, float ph) {
    float e = uEx, w = uT * 6.5 + ph;
    if (kind == 1.0) return rotZ(side * (mix(0.15, 2.6, e) + sin(w + side) * mix(0.1, 0.45, e)));           // both arms up, waving
    if (kind == 2.0 && side > 0.0) return rotZ(2.75 + sin(uT * 2.2 + ph) * 0.12);                              // holding the flag up
    if (kind == 3.0 && side > 0.0) return rotZ(mix(0.4, 2.5, e) + max(0.0, sin(w * 1.3)) * 0.5 * e);           // a fist pump
    float clap = sin(uT * mix(3.0, 11.0, e) + ph);                                                              // clapping, hands in front
    return rotZ(-side * mix(0.0, 0.42, e) * (0.6 + 0.4 * clap)) * rotX(-mix(0.25, 1.35, e));
  }`;

export class Crowd {
  constructor() { this.people = []; this.flags = []; this.uni = { uT: { value: 0 }, uEx: { value: 0.3 } }; this.ex = 0.3; this.want = 0.3; this.rng = mulberry32(4242); }
  /** One spectator at (x, y, z) in `parent`'s space, facing yaw. */
  add(parent, x, y, z, yaw, kindBias = 0, scale = 1) {
    const r = this.rng, k = r(), kind = k < 0.38 - kindBias ? 0 : k < 0.68 ? 1 : k < 0.84 + kindBias ? 2 : 3;
    this.people.push({ parent, x, y, z, yaw: yaw + (r() - 0.5) * 0.5, kind, ph: r() * 6.28, s: (0.92 + r() * 0.16) * scale, hat: r() < 0.3, shirt: SHIRTS[Math.floor(r() * SHIRTS.length)], pants: PANTS[Math.floor(r() * PANTS.length)], skin: SKIN[Math.floor(r() * SKIN.length)], hair: HAIR[Math.floor(r() * HAIR.length)], hatc: HATS[Math.floor(r() * HATS.length)], flag: FLAGS[Math.floor(r() * FLAGS.length)] });
  }
  /** Fill the 6 tiers of an ar_grandstand (its own space: 24 seats a row, rows stepping back and up). */
  fillStand(stand) {
    const sc = 1 / (stand.scale.x || 1); // (the stand's scaled up in the world: the people mustn't be)
    for (let k = 0; k < 6; k++) for (let i = 0; i < 24; i++) { if (this.rng() < 0.08 || [5, 11, 18].includes(i)) continue; this.add(stand, -14 + i * 1.22 + (this.rng() - 0.5) * 0.3, 1.0 + k * 1.0, -k * 1.4 + 0.05, 0, 0, sc); }
  }
  /** A standing crowd on the ground: n people in a strip `w` wide and `d` deep centred on c, facing along `face`. */
  fillGround(parent, c, right, face, n, w, d, heightAt) {
    const yaw = Math.atan2(face.x, face.z);
    for (let i = 0; i < n; i++) {
      const a = (this.rng() - 0.5) * w, b = this.rng() * d, x = c.x + right.x * a - face.x * b, z = c.z + right.z * a - face.z * b;
      this.add(parent, x, heightAt(x, z), z, yaw, 0.08);
    }
  }
  /** Build the instanced meshes (one per parent, so each stand's people ride with it). */
  build() {
    const byParent = new Map();
    for (const p of this.people) { if (!byParent.has(p.parent)) byParent.set(p.parent, []); byParent.get(p.parent).push(p); }
    const fig = figureGeometry(), flag = flagGeometry();
    const fogU = THREE.UniformsLib.fog;
    this.mat = new THREE.ShaderMaterial({
      fog: true, uniforms: THREE.UniformsUtils.merge([fogU, {}]),
      vertexShader: /* glsl */`
        #include <common>
        #include <fog_pars_vertex>
        attribute float aPart; attribute float aMat; attribute vec4 iMisc; attribute vec3 iShirt; attribute vec3 iSkin; attribute vec3 iPants; attribute vec3 iHair;
        varying vec3 vCol; varying float vLight;
        ${MOTION}
        void main() {
          float ph = iMisc.x, kind = iMisc.y, hat = iMisc.z;
          vec3 p = position, n = normal;
          if (aPart == 1.0 || aPart == 2.0) { float side = aPart == 1.0 ? -1.0 : 1.0; vec3 sh = vec3(side * 0.26, 1.42, 0.0); mat3 R = armRot(side, kind, ph); p = sh + R * (p - sh); n = R * n; }
          if (aPart == 3.0) { float a = sin(uT * 0.7 + ph * 3.0) * 0.35; mat3 R = mat3(cos(a), 0.0, -sin(a), 0.0, 1.0, 0.0, sin(a), 0.0, cos(a)); p = vec3(0.0, 1.5, 0.0) + R * (p - vec3(0.0, 1.5, 0.0)); n = R * n; }
          p.y += bob(ph, kind);
          vec3 c = aMat == 0.0 ? iShirt : aMat == 1.0 ? iSkin : aMat == 2.0 ? iPants : aMat == 4.0 ? vec3(0.16, 0.14, 0.13) : iHair; // (hair, or the hat's colour)
          if (aMat == 5.0 && hat < 0.5) p = vec3(0.0, 1.6, 0.0); // (no hat: the brim folds away into the head)
          vCol = c;
          vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
          vec3 wn = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * n);
          vLight = 0.55 + 0.5 * max(0.0, dot(wn, normalize(vec3(0.4, 0.85, 0.3))));
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */`
        #include <common>
        #include <fog_pars_fragment>
        varying vec3 vCol; varying float vLight;
        void main() { gl_FragColor = vec4(vCol * vLight, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
    this.mat.uniforms.uT = this.uni.uT; this.mat.uniforms.uEx = this.uni.uEx;
    this.fmat = new THREE.ShaderMaterial({
      fog: true, side: THREE.DoubleSide, uniforms: THREE.UniformsUtils.merge([fogU, {}]),
      vertexShader: /* glsl */`
        #include <common>
        #include <fog_pars_vertex>
        attribute float aCloth; attribute vec4 iMisc; attribute vec3 iA; attribute vec3 iB;
        varying vec3 vCol; varying float vLight;
        ${MOTION}
        void main() {
          float ph = iMisc.x;
          vec3 p = position;
          if (aCloth > 0.5) { float u = uv.x; p.z += sin(u * 5.0 - uT * (5.0 + 5.0 * uEx) + ph) * 0.11 * u; p.y -= u * u * 0.06 * (1.0 - uEx); }
          // the pole sits in the right hand, the hand at the top of the raised arm
          mat3 R = armRot(1.0, 2.0, ph); vec3 sh = vec3(0.26, 1.42, 0.0), hand = sh + R * vec3(0.0, -0.52, 0.0);
          float a = sin(uT * 2.2 + ph) * 0.12; mat3 S = mat3(cos(a), sin(a), 0.0, -sin(a), cos(a), 0.0, 0.0, 0.0, 1.0);
          p = hand + S * (p - vec3(0.0, 0.2, 0.0));
          p.y += bob(ph, 2.0);
          vCol = aCloth < 0.5 ? vec3(0.55, 0.5, 0.42) : (fract(uv.y * 1.5) < 0.5 ? iA : iB);
          vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
          vLight = aCloth > 0.5 ? 0.8 + 0.2 * sin(uv.x * 5.0 - uT * 6.0 + ph) : 0.9;
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */`
        #include <common>
        #include <fog_pars_fragment>
        varying vec3 vCol; varying float vLight;
        void main() { gl_FragColor = vec4(vCol * vLight, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
    this.fmat.uniforms.uT = this.uni.uT; this.fmat.uniforms.uEx = this.uni.uEx;
    this.meshes = [];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
    const lin = (hex) => { c.set(hex); return [c.r, c.g, c.b]; };
    for (const [parent, list] of byParent) {
      const geo = fig.clone(), n = list.length;
      const misc = new Float32Array(n * 4), sh = new Float32Array(n * 3), sk = new Float32Array(n * 3), pa = new Float32Array(n * 3), ha = new Float32Array(n * 3);
      const mesh = new THREE.InstancedMesh(geo, this.mat, n); mesh.frustumCulled = false; mesh.name = 'air-crowd';
      const flaggers = list.filter((p) => p.kind === 2), fgeo = flag.clone();
      const fm = new Float32Array(flaggers.length * 4), fa = new Float32Array(flaggers.length * 3), fb = new Float32Array(flaggers.length * 3);
      const fmesh = flaggers.length ? new THREE.InstancedMesh(fgeo, this.fmat, flaggers.length) : null;
      list.forEach((p, i) => {
        q.setFromAxisAngle(up, p.yaw); m4.compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(p.s, p.s, p.s)); mesh.setMatrixAt(i, m4);
        misc.set([p.ph, p.kind, p.hat ? 1 : 0, 0], i * 4); sh.set(lin(p.shirt), i * 3); sk.set(lin(p.skin), i * 3); pa.set(lin(p.pants), i * 3); ha.set(lin(p.hat ? p.hatc : p.hair), i * 3);
      });
      flaggers.forEach((p, i) => {
        q.setFromAxisAngle(up, p.yaw); m4.compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(p.s, p.s, p.s)); fmesh.setMatrixAt(i, m4);
        fm.set([p.ph, 2, 0, 0], i * 4); fa.set(lin(p.flag[0]), i * 3); fb.set(lin(p.flag[1]), i * 3);
      });
      geo.setAttribute('iMisc', new THREE.InstancedBufferAttribute(misc, 4)); geo.setAttribute('iShirt', new THREE.InstancedBufferAttribute(sh, 3));
      geo.setAttribute('iSkin', new THREE.InstancedBufferAttribute(sk, 3)); geo.setAttribute('iPants', new THREE.InstancedBufferAttribute(pa, 3)); geo.setAttribute('iHair', new THREE.InstancedBufferAttribute(ha, 3));
      parent.add(mesh); this.meshes.push(mesh);
      if (fmesh) {
        fgeo.setAttribute('iMisc', new THREE.InstancedBufferAttribute(fm, 4)); fgeo.setAttribute('iA', new THREE.InstancedBufferAttribute(fa, 3)); fgeo.setAttribute('iB', new THREE.InstancedBufferAttribute(fb, 3));
        fmesh.frustumCulled = false; fmesh.name = 'air-crowd-flags'; parent.add(fmesh); this.meshes.push(fmesh);
      }
    }
    fig.dispose(); flag.dispose();
    return this.people.length;
  }
  /** Get them going: 1 is on their feet and roaring; it settles back by itself. */
  cheer(k = 1) { this.want = Math.max(this.want, k); }
  update(dt, t) {
    this.uni.uT.value = t;
    this.ex += (this.want - this.ex) * Math.min(1, dt * (this.want > this.ex ? 4 : 0.8));
    this.want += (0.3 - this.want) * Math.min(1, dt * 0.35);
    this.uni.uEx.value = this.ex;
  }
}
