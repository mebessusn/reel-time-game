// Your waypoint: a tall soft beam of light where you dropped it on the map, plus a HUD chip with the
// distance and an arrow pointing the way. It clears itself when you arrive.
import * as THREE from 'three';
import { heightAt, WATER_Y } from '../world/terrain.js';

export class Waypoint {
  constructor(game) {
    this.game = game;
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { uT: { value: 0 } },
      vertexShader: 'varying float vY; void main() { vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uT; varying float vY; void main() { float a = (1.0 - vY) * (0.55 + 0.15 * sin(uT * 3.0 - vY * 12.0)); gl_FragColor = vec4(vec3(1.0, 0.82, 0.38) * a, a); }',
    });
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 36, 14, 1, true), mat);
    this.beam.geometry.translate(0, 18, 0);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.25, 28), new THREE.MeshBasicMaterial({ color: '#ffd46a', transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    this.ring.rotation.x = -Math.PI / 2;
    this.group = new THREE.Group();
    this.group.add(this.beam, this.ring);
    this.group.visible = false;
    game.engine.scene.add(this.group);
    this.mat = mat;
  }

  get wp() { return this.game.ext?.d?.waypoint || null; }

  sync() {
    const wp = this.wp;
    this.group.visible = !!wp;
    if (wp) this.group.position.set(wp.x, Math.max(WATER_Y, heightAt(Math.floor(wp.x), Math.floor(wp.z))) + 0.05, wp.z);
  }

  update(dt, t) {
    const wp = this.wp;
    if (!wp) { if (this.group.visible) this.group.visible = false; return null; }
    if (!this.group.visible) this.sync();
    this.mat.uniforms.uT.value = t;
    this.ring.scale.setScalar(1 + Math.sin(t * 3) * 0.08);
    const p = this.game.player.pos;
    const d = Math.hypot(wp.x - p.x, wp.z - p.z);
    if (d < 3.5) {
      this.game.ext.change((x) => { x.waypoint = null; });
      this.sync();
      this.game.ui.toast(wp.name, { title: 'You made it', icon: 'flag' });
      this.game.audio.sfx('achievement');
      return null;
    }
    // direction on screen: relative to where the camera looks (camera looks toward -(sin yaw, cos yaw))
    const ang = Math.atan2(wp.x - p.x, wp.z - p.z);
    const camLook = Math.atan2(-Math.sin(this.game.engine.cam.yaw), -Math.cos(this.game.engine.cam.yaw));
    return { name: wp.name, dist: Math.round(d), rel: ang - camLook };
  }
}
