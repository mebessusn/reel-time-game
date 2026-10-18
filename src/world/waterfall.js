// The waterfall over the cove's north-east cliff:
//   - a stream running across the cliff top to the lip, so the water comes from somewhere
//   - a curved, layered curtain that arcs out over the lip and drops, with streaks rushing down,
//     ragged edges and whiter water where it breaks
//   - a churning foam pool where it lands, with rings spreading out across the lake, plus spray
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { surfaceY as heightAt, WATER_Y, FALLS_C } from './terrain.js'; // the smooth ground everywhere here

const NOISE = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.1 + 3.7; a *= 0.5; } return s; }
`;

function curtainMaterial(speed, tint, alphaMul) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uLight: { value: new THREE.Color(1, 1, 1) }, uSpeed: { value: speed }, uTint: { value: new THREE.Color(tint) }, uAlpha: { value: alphaMul } }]),
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      #include <fog_pars_vertex>
      void main() { vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uLight; uniform float uSpeed; uniform vec3 uTint; uniform float uAlpha;
      varying vec2 vUv;
      #include <fog_pars_fragment>
      ${NOISE}
      void main() {
        vec2 q = floor(vUv * vec2(48.0, 160.0)) / vec2(48.0, 160.0); // pixel steps like the rest of the world
        // streaks rushing down (v runs 0 at the lip to 1 at the pool)
        float s = fbm(vec2(q.x * 9.0, q.y * 2.2 - uTime * uSpeed));
        float s2 = vnoise(vec2(q.x * 26.0, q.y * 7.0 - uTime * uSpeed * 1.6));
        float white = smoothstep(0.45, 0.85, s * 0.75 + s2 * 0.4);
        white = max(white, smoothstep(0.18, 0.0, q.y) * 0.8);                       // the lip breaks white
        white = max(white, smoothstep(0.72, 1.0, q.y) * (0.55 + 0.45 * s2));          // spray at the bottom
        vec3 col = mix(uTint, vec3(0.94, 0.98, 1.0), white);
        col *= 0.88 + 0.12 * s;
        // ragged edges that flicker
        float edge = smoothstep(0.0, 0.07 + 0.04 * s2, q.x) * smoothstep(1.0, 0.93 - 0.04 * s, q.x);
        float alpha = edge * (0.8 + 0.2 * white) * uAlpha;
        gl_FragColor = vec4(col * uLight, alpha);
        #include <fog_fragment>
      }`,
  });
}

function poolMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uLight: { value: new THREE.Color(1, 1, 1) } }]),
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      #include <fog_pars_vertex>
      void main() { vUv = uv * 2.0 - 1.0; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uLight;
      varying vec2 vUv;
      #include <fog_pars_fragment>
      ${NOISE}
      void main() {
        vec2 p = floor(vUv * 48.0) / 48.0;
        float r = length(p);
        if (r > 1.0) discard;
        float a = atan(p.y, p.x);
        // churning foam: noise carried outward from the impact point
        float churn = fbm(vec2(a * 2.2, r * 5.0 - uTime * 1.4)) + 0.5 * vnoise(p * 9.0 + uTime * 0.7);
        float foam = smoothstep(0.55, 1.0, churn) * smoothstep(1.0, 0.15, r) + smoothstep(0.35, 0.0, r) * 0.8;
        // rings spreading out
        float rings = smoothstep(0.06, 0.0, abs(fract(r * 2.6 - uTime * 0.55) - 0.5) - 0.42) * smoothstep(1.0, 0.3, r) * 0.55;
        float alpha = clamp(foam + rings, 0.0, 0.92) * smoothstep(1.0, 0.75, r);
        gl_FragColor = vec4(vec3(0.95, 0.98, 1.0) * uLight, alpha);
        #include <fog_fragment>
      }`,
  });
}

function streamMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uLight: { value: new THREE.Color(1, 1, 1) } }]),
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      #include <fog_pars_vertex>
      void main() { vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uLight;
      varying vec2 vUv;
      #include <fog_pars_fragment>
      ${NOISE}
      void main() {
        vec2 q = floor(vUv * vec2(24.0, 64.0)) / vec2(24.0, 64.0);
        float s = fbm(vec2(q.x * 6.0, q.y * 3.0 - uTime * 1.3));
        vec3 col = mix(vec3(0.25, 0.55, 0.75), vec3(0.85, 0.95, 1.0), smoothstep(0.55, 0.85, s) + smoothstep(0.85, 1.0, q.y) * 0.6);
        float edge = smoothstep(0.0, 0.12, q.x) * smoothstep(1.0, 0.88, q.x);
        gl_FragColor = vec4(col * uLight, (0.75 + 0.2 * s) * edge);
        #include <fog_fragment>
      }`,
  });
}

/** Build the waterfall. Returns a group with userData.update(t, dt, light) and userData.foam (the pool). */
export function buildWaterfall() {
  const group = new THREE.Group();
  group.name = 'falls';
  // the cliff faces the lake to the south-west; "into" points into the cliff
  const out = new THREE.Vector3(-1, 0, 1).normalize();
  const into = out.clone().negate();
  const along = new THREE.Vector3(1, 0, 1).normalize();
  const base = new THREE.Vector3(FALLS_C.x + 3.5, WATER_Y, FALLS_C.z - 3.5);
  // find the lip: walk into the cliff until the ground is high
  let lip = base.clone();
  for (let i = 0; i < 20; i++) { const p = base.clone().addScaledVector(into, i * 0.5); if (heightAt(p.x, p.z) >= 7.2) { lip = p; break; } }
  const top = heightAt(lip.x, lip.z) + 0.15;
  const W = 3.2;

  // curtain: a curved sheet, arcing out over the lip then dropping
  const makeCurtain = (width, push, speed, tint, alpha, offset) => {
    const SX = 8, SY = 28;
    const geo = new THREE.BufferGeometry();
    const pos = [], uv = [], idx = [];
    // how far out the stepped cliff reaches at each height: the sheet must always fall in front of it
    let reach = -0.35;
    for (let j = 0; j <= SY; j++) {
      const v = j / SY;
      const y = top - (top - WATER_Y) * v;
      for (const a of [-0.5, 0, 0.5]) {
        for (let d = Math.max(0, reach); d < 12; d += 0.25) {
          const q = lip.clone().addScaledVector(along, a * width).addScaledVector(out, d);
          if (heightAt(q.x, q.z) < y - 0.05) { reach = Math.max(reach, d); break; }
        }
      }
      const outD = Math.max(offset + push * Math.sqrt(v) * 1.2 - 0.35 + Math.sin(v * Math.PI) * 0.15, reach + 0.3 + offset);
      for (let i = 0; i <= SX; i++) {
        const u = i / SX;
        const p = lip.clone().addScaledVector(along, (u - 0.5) * width * (1 + v * 0.12)).addScaledVector(out, outD);
        pos.push(p.x, y, p.z); uv.push(u, v);
      }
    }
    for (let j = 0; j < SY; j++) for (let i = 0; i < SX; i++) { const a = j * (SX + 1) + i, b = a + SX + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const m = new THREE.Mesh(geo, curtainMaterial(speed, tint, alpha));
    m.renderOrder = 4;
    return m;
  };
  const back = makeCurtain(W, 0.9, 1.6, '#4f9cc8', 0.85, 0.0);
  const front = makeCurtain(W * 0.94, 1.15, 2.3, '#8cc8e8', 0.75, 0.18);
  group.add(back, front);

  // stream across the cliff top, flowing to the lip
  const streamLen = 7;
  const sGeo = new THREE.PlaneGeometry(W * 0.9, streamLen, 1, 1);
  sGeo.rotateX(-Math.PI / 2);
  const stream = new THREE.Mesh(sGeo, streamMaterial());
  const mid = lip.clone().addScaledVector(into, streamLen / 2 - 0.2);
  stream.position.set(mid.x, top + 0.02, mid.z);
  stream.rotation.y = Math.atan2(into.x, into.z);
  stream.renderOrder = 4;
  group.add(stream);

  // foam pool where it lands
  const land = lip.clone().addScaledVector(out, 1.0);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(7, 7).rotateX(-Math.PI / 2), poolMaterial());
  pool.position.set(land.x, WATER_Y + 0.05, land.z);
  pool.renderOrder = 4;
  group.add(pool);

  // Boulders: the stream runs out of a rocky cleft and over a rock lip, with rocks at the foot too,
  // so the water never looks like it pours out of bare dirt.
  const rocks = buildBoulders([
    // flanking the lip
    [lip.clone().addScaledVector(along, -(W * 0.62 + 0.45)).addScaledVector(out, 0.15), top + 0.35, 1.5, 1],
    [lip.clone().addScaledVector(along, W * 0.62 + 0.5).addScaledVector(out, 0.1), top + 0.3, 1.35, 2],
    [lip.clone().addScaledVector(along, -(W * 0.62 + 1.6)).addScaledVector(into, 0.6), top + 0.2, 1.1, 3],
    [lip.clone().addScaledVector(along, W * 0.62 + 1.7).addScaledVector(into, 0.8), top + 0.15, 1.0, 4],
    // the rock shelf the water tips over
    [lip.clone().addScaledVector(out, -0.05).addScaledVector(along, -0.9), top - 0.35, 0.75, 5],
    [lip.clone().addScaledVector(out, -0.05).addScaledVector(along, 1.0), top - 0.4, 0.7, 6],
    // along the stream banks
    [lip.clone().addScaledVector(into, 2.4).addScaledVector(along, -(W * 0.5 + 0.55)), top + 0.2, 1.05, 7],
    [lip.clone().addScaledVector(into, 2.8).addScaledVector(along, W * 0.5 + 0.5), top + 0.2, 1.15, 8],
    [lip.clone().addScaledVector(into, 4.6).addScaledVector(along, -(W * 0.5 + 0.4)), top + 0.25, 1.0, 9],
    [lip.clone().addScaledVector(into, 4.9).addScaledVector(along, W * 0.5 + 0.45), top + 0.25, 1.0, 10],
    // the cleft the stream comes out of
    [lip.clone().addScaledVector(into, streamLen - 0.4), top + 0.7, 2.0, 11],
    [lip.clone().addScaledVector(into, streamLen - 1.2).addScaledVector(along, -1.4), top + 0.45, 1.4, 12],
    [lip.clone().addScaledVector(into, streamLen - 1.1).addScaledVector(along, 1.5), top + 0.45, 1.5, 13],
    // at the foot of the falls
    [base.clone().addScaledVector(along, -(W * 0.55 + 0.6)).addScaledVector(out, 0.2), WATER_Y + 0.15, 0.95, 14],
    [base.clone().addScaledVector(along, W * 0.55 + 0.7).addScaledVector(out, 0.5), WATER_Y + 0.1, 0.8, 15],
    [base.clone().addScaledVector(along, W * 0.55 + 1.5).addScaledVector(out, 1.4), WATER_Y, 0.55, 16],
  ]);
  group.add(rocks);

  const mats = [back.material, front.material, stream.material, pool.material];
  group.userData = {
    foam: new THREE.Vector3(land.x, WATER_Y + 0.2, land.z),
    land,
    update(t, light) {
      for (const m of mats) { m.uniforms.uTime.value = t; if (light) m.uniforms.uLight.value.copy(light); }
    },
  };
  return group;
}

// Mossy boulders: lumpy icosahedrons, flat shaded, grey stone with moss on the tops (vertex colours).
function buildBoulders(list) {
  const geos = [];
  const stone = new THREE.Color('#a29e95'), stoneD = new THREE.Color('#878379'), moss = new THREE.Color('#7aa356');
  for (const [p, yHint, size, seed] of list) {
    const ground = heightAt(p.x, p.z);
    const y = yHint <= WATER_Y + 0.2 ? yHint : ground + size * 0.2; // bedded into the slope
    const geo = new THREE.IcosahedronGeometry(size, 1); // already non-indexed
    const pos = geo.attributes.position;
    const r = (k) => { const v = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
    // lump it, then squash a little
    const map = new Map();
    for (let i = 0; i < pos.count; i++) {
      const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
      if (!map.has(key)) map.set(key, 0.82 + r(map.size) * 0.32);
      const f = map.get(key);
      pos.setXYZ(i, pos.getX(i) * f * 1.1, pos.getY(i) * f * 0.72, pos.getZ(i) * f);
    }
    geo.computeVertexNormals();
    const col = [];
    const n = geo.attributes.normal;
    for (let i = 0; i < pos.count; i += 3) {
      const up = (n.getY(i) + n.getY(i + 1) + n.getY(i + 2)) / 3;
      const c = up > 0.55 ? moss.clone().lerp(stone, r(i) * 0.35) : stone.clone().lerp(stoneD, r(i + 7) * 0.8);
      for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.rotateY(r(99) * Math.PI * 2);
    geo.translate(p.x, y, p.z);
    geos.push(geo);
  }
  const merged = mergeGeometries(geos);
  const m = new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  m.castShadow = true; m.receiveShadow = true;
  m.name = 'falls-boulders';
  return m;
}
