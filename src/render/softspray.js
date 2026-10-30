// v1.17.2: soft spray for fast things: a pool of round, fading puffs that swell as they go (the jet ski's water, the snowmobile's
// snow). The little square sparks in game/fx.js are too small and hard for this. One draw call for the lot.
import * as THREE from 'three';

const MAX = 260;
const VS = `attribute vec2 aLife; attribute float aSize; varying float vK; uniform float uPx;
  void main() { float k = clamp(aLife.x / aLife.y, 0.0, 1.0); vK = aLife.y > 0.0 ? k : 0.0; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = min(90.0, aSize * (1.0 + (1.0 - k) * 1.7) * uPx / max(0.1, -mv.z)); }`;
const FS = `uniform vec3 uColor; varying float vK;
  void main() { if (vK <= 0.0) discard; vec2 q = gl_PointCoord - 0.5; float d = dot(q, q) * 4.0; if (d > 1.0) discard; gl_FragColor = vec4(uColor, (1.0 - d) * (1.0 - d) * vK * 0.72); }`;

export class SoftSpray {
  constructor(scene, color) {
    this.pos = new Float32Array(MAX * 3).fill(-999); this.life = new Float32Array(MAX * 2); this.size = new Float32Array(MAX); this.vel = new Float32Array(MAX * 3); this.next = 0; this.live = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('aLife', new THREE.BufferAttribute(this.life, 2)); g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, uniforms: { uColor: { value: new THREE.Color(color) }, uPx: { value: 500 } } });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.visible = false; this.points.renderOrder = 3; scene.add(this.points);
  }
  puff(x, y, z, vx, vy, vz, life, size) {
    const i = this.next; this.next = (i + 1) % MAX;
    this.pos.set([x, y, z], i * 3); this.vel.set([vx, vy, vz], i * 3); this.life[i * 2] = life; this.life[i * 2 + 1] = life; this.size[i] = size; this.points.visible = true; this.live = 3;
  }
  update(dt, renderer, grav = -8) {
    if (!this.points.visible) return;
    this.live -= dt; if (this.live <= 0) { this.points.visible = false; return; }
    this.mat.uniforms.uPx.value = (renderer?.domElement?.height || 700) * 1.1;
    for (let i = 0; i < MAX; i++) {
      if (this.life[i * 2] <= 0) continue;
      this.life[i * 2] -= dt; this.vel[i * 3 + 1] += grav * dt;
      for (let k = 0; k < 3; k++) this.pos[i * 3 + k] += this.vel[i * 3 + k] * dt;
    }
    const a = this.points.geometry.attributes; a.position.needsUpdate = true; a.aLife.needsUpdate = true; a.aSize.needsUpdate = true;
  }
}
