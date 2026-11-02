// A bush plane on floats (art/src/snowgoose.py), built from its parts, each on its hinge: the propeller spins with the
// throttle, the ailerons, elevator and rudder move with the controls. Lettering is optional (a name on the tail, a registration).
import * as THREE from 'three';
import { SNOWGOOSE_MATS, SNOWGOOSE_NODES } from '../data/snowgooseMesh.js';
import { buildNode } from '../render/meshnode.js';

// hinge points (plane space: x starboard, y up, z toward the nose; origin on the float keels, midships)
export const HINGE = {
  prop: [0, 2.66, 3.32],
  aileron: [0, 3.73, 0.19],
  elevator: [0, 3.22, -5.35],
  rudder: [0, 3.2, -5.4],
};
export const PLANE = { span: 13.4, length: 9.5, cabin: { x: 0.0, y: 2.0, z: 0.8 }, door: { x: 1.6, z: 0.6 }, floatY: 0.0, waterline: 0.28 };

export const node = (name, opts) => buildNode(SNOWGOOSE_MATS, SNOWGOOSE_NODES, name, opts);

/** A name painted on the tail and the registration on the fuselage. */
function decal(text, w, h, color = '#efe7d2') {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = Math.round(256 * h / w);
  const c = cv.getContext('2d');
  c.fillStyle = color; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = `bold ${Math.round(cv.height * 0.75)}px "Baloo 2", Arial, sans-serif`;
  c.fillText(text, cv.width / 2, cv.height / 2 + 2);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
}

export class BushPlane {
  constructor({ name = null, reg = null } = {}) {
    const g = this.group = new THREE.Group(); g.name = 'bush-plane';
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
    // lettering: the name and the registration together on each side of the rear fuselage, turned to follow its taper
    for (const s of [-1, 1]) {
      const a = s * (Math.PI / 2 + 0.135);
      if (name) { const nm = decal(name, 1.25, 0.24, '#f6eedc'); nm.position.set(s * 0.625, 3.0, -2.6); nm.rotation.y = a; g.add(nm); }
      if (reg) { const rg = decal(reg, 1.0, 0.24); rg.position.set(s * 0.625, 2.68, -2.6); rg.rotation.y = a; g.add(rg); }
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
