// Frostmere: the Snow Goose, Skye Halloran's bush plane (art/src/snowgoose.py), and the bits of both airbases.
// The plane is built from its parts, each on its hinge: the propeller spins with the throttle, the ailerons, elevator
// and rudder move with the controls, and the whole thing banks, pitches and bobs.
import * as THREE from 'three';
import { SNOWGOOSE_MATS, SNOWGOOSE_NODES } from '../data/snowgooseMesh.js';
import { buildNode } from '../ocean/meshes.js';

// hinge points (plane space: x starboard, y up, z toward the nose; origin on the float keels, midships)
export const HINGE = {
  prop: [0, 2.66, 3.32],
  aileron: [0, 3.73, 0.19],
  elevator: [0, 3.22, -5.35],
  rudder: [0, 3.2, -5.4],
};
export const PLANE = { span: 13.4, length: 9.5, cabin: { x: 0.0, y: 2.0, z: 0.8 }, door: { x: 1.6, z: 0.6 }, floatY: 0.0, waterline: 0.28 };

export const node = (name, opts) => buildNode(SNOWGOOSE_MATS, SNOWGOOSE_NODES, name, opts);

/** A painted sign board (canvas) to hang on a hangar. */
export function signBoard(text, w = 5.2, h = 0.8, colors = { bg: '#efe2c4', fg: '#7a2420', edge: '#a8322c' }) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = Math.round(512 * h / w);
  const c = cv.getContext('2d');
  c.fillStyle = colors.bg; c.fillRect(0, 0, cv.width, cv.height);
  c.strokeStyle = colors.edge; c.lineWidth = 10; c.strokeRect(8, 8, cv.width - 16, cv.height - 16);
  c.fillStyle = colors.fg; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = `bold ${Math.round(cv.height * 0.5)}px "Baloo 2", Georgia, serif`;
  c.fillText(text, cv.width / 2, cv.height / 2 + 3);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: tex }));
  return m;
}

/** The plane's name painted on its tail ("SNOW GOOSE") and the registration on the fuselage. */
function decal(text, w, h, color = '#efe7d2') {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = Math.round(256 * h / w);
  const c = cv.getContext('2d');
  c.fillStyle = color; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = `bold ${Math.round(cv.height * 0.75)}px "Baloo 2", Arial, sans-serif`;
  c.fillText(text, cv.width / 2, cv.height / 2 + 2);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
}

export class SnowGoose {
  constructor() {
    const g = this.group = new THREE.Group(); g.name = 'snow-goose';
    this.body = node('sg_body');
    g.add(this.body);
    const at = (n, h) => { const o = node(n); const p = new THREE.Group(); p.position.set(...h); p.add(o); g.add(p); return p; };
    this.prop = at('sg_prop', HINGE.prop);
    this.ailR = at('sg_aileron_r', HINGE.aileron);
    this.ailL = at('sg_aileron_l', HINGE.aileron);
    this.elev = at('sg_elevator', HINGE.elevator);
    this.rud = at('sg_rudder', HINGE.rudder);
    // a blurred disc for the spinning prop (shown at speed, the blades hidden)
    this.disc = new THREE.Mesh(new THREE.CircleGeometry(1.32, 32), new THREE.MeshBasicMaterial({ color: '#2a2a2a', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
    this.disc.position.set(HINGE.prop[0], HINGE.prop[1], HINGE.prop[2] + 0.2);
    g.add(this.disc);
    // lettering: the registration on both sides, the name on the fin
    for (const s of [-1, 1]) {
      const reg = decal('C-GOSE', 1.4, 0.32); reg.position.set(s * 0.6, 2.58, -2.6); reg.rotation.y = s * Math.PI / 2 + (s < 0 ? 0 : 0); reg.scale.x = s > 0 ? 1 : 1;
      if (s < 0) reg.rotation.y = -Math.PI / 2; else reg.rotation.y = Math.PI / 2;
      g.add(reg);
      const nm = decal('SNOW GOOSE', 1.25, 0.22, '#f6eedc'); nm.position.set(s * 0.06, 4.15, -5.0); nm.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2;
      g.add(nm);
    }
    this.spin = 0; this.throttle = 0; this.rpm = 0;
    this.ctl = { roll: 0, pitch: 0, yaw: 0 };
    this.group.traverse((o) => { if (o.isMesh) { const flat = o.material.transparent; o.castShadow = !flat; o.receiveShadow = !flat; } }); // (the lettering and prop disc cast no square shadows)
  }
  /** Each frame: throttle 0..1 spins the prop; controls -1..1 move the surfaces. */
  animate(dt, { throttle = 0, roll = 0, pitch = 0, yaw = 0 } = {}) {
    this.rpm += (throttle - this.rpm) * Math.min(1, dt * (throttle > this.rpm ? 1.6 : 0.7));
    this.spin += dt * (2 + this.rpm * 70);
    this.prop.rotation.z = this.spin;
    const fast = this.rpm > 0.35;
    this.disc.visible = fast;
    this.prop.children[0].visible = !fast || this.rpm < 0.5; // (the blades blur into the disc at speed)
    this.disc.material.opacity = 0.1 + this.rpm * 0.12;
    const k = Math.min(1, dt * 8);
    this.ctl.roll += (roll - this.ctl.roll) * k; this.ctl.pitch += (pitch - this.ctl.pitch) * k; this.ctl.yaw += (yaw - this.ctl.yaw) * k;
    this.ailR.rotation.x = -this.ctl.roll * 0.35; this.ailL.rotation.x = this.ctl.roll * 0.35;
    this.elev.rotation.x = this.ctl.pitch * 0.4;
    this.rud.rotation.y = -this.ctl.yaw * 0.45;
  }
}

/** A windsock that swings to the wind and droops when it's calm. */
export class Windsock {
  constructor() {
    this.group = new THREE.Group(); this.group.name = 'windsock';
    this.group.add(node('ab_windsock_pole'));
    this.pivot = new THREE.Group(); this.pivot.position.set(0, 5.9, 0.2);
    this.sock = node('ab_windsock'); this.pivot.add(this.sock);
    this.group.add(this.pivot);
  }
  update(t, windYaw = 0.6, strength = 0.6) {
    this.pivot.rotation.y = windYaw - this.group.rotation.y + Math.sin(t * 0.7) * 0.15 * strength;
    this.pivot.rotation.x = (1 - strength) * 0.9 + Math.sin(t * 2.3) * 0.05;
  }
}
