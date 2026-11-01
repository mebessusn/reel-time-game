// Square-pixel particle system: splashes, bubbles, sparkles, smoke, petals, embers, wakes.
import * as THREE from 'three';
import { softDot } from '../render/softdot.js';

const MAX = 900;

export class FX {
  constructor(scene) {
    this.pos = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 3);
    this.p = Array.from({ length: MAX }, () => ({ life: 0 }));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.mat = new THREE.PointsMaterial({ map: softDot(), size: 0.26, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true, alphaTest: 0.02 });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
    scene.add(this.points);
    this.next = 0;
    this.c = new THREE.Color();
    this.emitters = [];
  }

  spawn(x, y, z, vx, vy, vz, color, life, grav = -9, drag = 0) {
    const i = this.next++ % MAX;
    const p = this.p[i];
    Object.assign(p, { x, y, z, vx, vy, vz, life, max: life, grav, drag });
    this.c.set(color);
    p.r = this.c.r; p.g = this.c.g; p.b = this.c.b;
  }

  splash(at, big = 1) {
    const n = Math.round(14 * big);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = (0.6 + Math.random()) * big;
      this.spawn(at.x, at.y + 0.05, at.z, Math.cos(a) * s, 2 + Math.random() * 2.5 * big, Math.sin(a) * s, i % 3 ? '#e8f6ff' : '#9fd4f0', 0.6 + Math.random() * 0.3);
    }
  }
  bubbles(at) {
    for (let i = 0; i < 3; i++) this.spawn(at.x + (Math.random() - 0.5) * 0.3, at.y, at.z + (Math.random() - 0.5) * 0.3, 0, 0.6 + Math.random() * 0.3, 0, '#d8f0ff', 0.5, 0);
  }
  ring(at, color = '#ffd84a', n = 28) {
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; this.spawn(at.x, at.y + 0.08, at.z, Math.cos(a) * 3.2, 0.6, Math.sin(a) * 3.2, color, 0.7, -1, 1.6); }
  }
  sparkle(at, color = '#ffffff', n = 18, spread = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI - Math.PI / 2, s = (0.8 + Math.random() * 1.5) * spread;
      this.spawn(at.x, at.y, at.z, Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s + 1, Math.sin(a) * Math.cos(e) * s, Math.random() < 0.5 ? color : '#ffffff', 0.9 + Math.random() * 0.6, -1.5, 1.5);
    }
  }
  column(at, color) { // sparkle column for diamond / mythic catches seen across the lake
    for (let i = 0; i < 50; i++) this.spawn(at.x + (Math.random() - 0.5) * 0.6, at.y + Math.random() * 0.5, at.z + (Math.random() - 0.5) * 0.6, 0, 2 + Math.random() * 4, 0, i % 2 ? color : '#ffffff', 1.4 + Math.random(), 0, 0.3);
  }
  smoke(at) { this.spawn(at.x + (Math.random() - 0.5) * 0.3, at.y, at.z + (Math.random() - 0.5) * 0.3, 0.25 + Math.random() * 0.15, 0.7 + Math.random() * 0.3, 0.05, Math.random() < 0.5 ? '#c8c8c4' : '#a8a8a4', 3.5, 0.05, 0.1); }
  ember(at) { this.spawn(at.x + (Math.random() - 0.5) * 0.4, at.y, at.z + (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.3, 1 + Math.random(), (Math.random() - 0.5) * 0.3, Math.random() < 0.5 ? '#ffb040' : '#ff6020', 1, 0.2); }
  petal(at) { this.spawn(at.x, at.y, at.z, (Math.random() - 0.5) * 0.6, 0.2, (Math.random() - 0.5) * 0.6, Math.random() < 0.5 ? '#f8b0c8' : '#ffd8e8', 1.6, -0.6, 0.4); }
  wake(at, dir) { this.spawn(at.x + (Math.random() - 0.5) * 0.5, at.y, at.z + (Math.random() - 0.5) * 0.5, -dir.x * 0.3 + (Math.random() - 0.5) * 0.4, 0.3, -dir.z * 0.3 + (Math.random() - 0.5) * 0.4, '#e8f6ff', 0.5, -2); }
  mist(at) { this.spawn(at.x + (Math.random() - 0.5) * 2.5, at.y, at.z + (Math.random() - 0.5) * 2.5, (Math.random() - 0.5) * 0.4, 0.4 + Math.random() * 0.4, (Math.random() - 0.5) * 0.4, '#e8f4ff', 1.4, 0, 0.2); }

  update(dt) {
    for (let i = 0; i < MAX; i++) {
      const p = this.p[i];
      if (p.life <= 0) { this.pos[i * 3 + 1] = -999; continue; }
      p.life -= dt;
      p.vy += p.grav * dt;
      if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; p.vz *= k; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const fade = Math.min(1, p.life / (p.max * 0.4));
      this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
      this.col[i * 3] = p.r * fade + (1 - fade) * 0.3; this.col[i * 3 + 1] = p.g * fade + (1 - fade) * 0.3; this.col[i * 3 + 2] = p.b * fade + (1 - fade) * 0.3;
      if (fade < 0.05) this.pos[i * 3 + 1] = -999;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}
