// Day/night cycle, weather, sky objects (sun, moon, stars, clouds), fireflies, rain, lightning.
import * as THREE from 'three';
import { nightWindows } from './nightwindows.js';
import { softDot } from '../render/softdot.js';
import { worldTime } from '../core/clock.js';
import { HALF, heightAt, isWater, scatterSpots } from './terrain.js';
import { buildClouds, updateClouds, buildStars, Moon, buildGroundFog, fogAmount, updateGroundFog, sunTexture } from './skyfx.js';

const KEYS = [
  { f: 0.0, sky: '#1b2646', fog: '#1b2646', sun: 0.0, amb: 0.42, ambCol: '#7f8fd0', light: [0.42, 0.48, 0.72] },
  { f: 0.19, sky: '#2a3060', fog: '#2a3060', sun: 0.0, amb: 0.45, ambCol: '#8a90d0', light: [0.48, 0.5, 0.75] },
  { f: 0.24, sky: '#f0a8a0', fog: '#e8b0a8', sun: 0.35, amb: 0.55, ambCol: '#f0c0b0', light: [0.95, 0.78, 0.75] },
  { f: 0.3, sky: '#a8d4f0', fog: '#c0dcec', sun: 0.85, amb: 0.65, ambCol: '#e0ecff', light: [1.0, 0.96, 0.9] },
  { f: 0.5, sky: '#8fc9f0', fog: '#b4dcf0', sun: 1.0, amb: 0.7, ambCol: '#ffffff', light: [1.0, 1.0, 1.0] },
  { f: 0.68, sky: '#9ccff0', fog: '#bcdcec', sun: 0.9, amb: 0.66, ambCol: '#fff4e0', light: [1.0, 0.97, 0.92] },
  { f: 0.75, sky: '#f4a26b', fog: '#e8a880', sun: 0.4, amb: 0.55, ambCol: '#ffc090', light: [1.0, 0.75, 0.6] },
  { f: 0.8, sky: '#5a4a7a', fog: '#5a4a7a', sun: 0.0, amb: 0.48, ambCol: '#a090d0', light: [0.6, 0.55, 0.8] },
  { f: 1.0, sky: '#1b2646', fog: '#1b2646', sun: 0.0, amb: 0.42, ambCol: '#7f8fd0', light: [0.42, 0.48, 0.72] },
];

const cA = new THREE.Color(), cB = new THREE.Color();
function sampleKeys(f) {
  let i = 0;
  while (i < KEYS.length - 2 && f > KEYS[i + 1].f) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const t = Math.min(1, Math.max(0, (f - a.f) / (b.f - a.f)));
  const s = t * t * (3 - 2 * t);
  const mix = (x, y) => cA.set(x).lerp(cB.set(y), s).clone();
  return {
    sky: mix(a.sky, b.sky), fog: mix(a.fog, b.fog), ambCol: mix(a.ambCol, b.ambCol),
    sun: a.sun + (b.sun - a.sun) * s, amb: a.amb + (b.amb - a.amb) * s,
    light: a.light.map((v, k) => v + (b.light[k] - v) * s),
  };
}

export class Sky {
  constructor(scene, renderer) {
    this.scene = scene;
    this.hemi = new THREE.HemisphereLight('#ffffff', '#5a6a4a', 0.7);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff4e0', 1.0);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera;
    sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 160;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.03;
    scene.add(this.sun, this.sun.target);
    this.moonLight = new THREE.DirectionalLight('#9fb0ff', 0.0);
    scene.add(this.moonLight);
    this.dockLight = new THREE.PointLight('#ffc070', 0, 14, 1.6);
    this.dockLight.position.set(0.5, 3, 28);
    this.fireLight = new THREE.PointLight('#ff9040', 0, 10, 1.8);
    this.fireLight2 = new THREE.PointLight('#ff9040', 0, 10, 1.8);
    scene.add(this.dockLight, this.fireLight, this.fireLight2);

    scene.fog = new THREE.Fog('#b4dcf0', 40, 140);
    scene.background = new THREE.Color('#8fc9f0');

    // v1.8.2: a smooth glowing sun (was a pixel square) with a wide soft halo behind it
    this.sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTexture(), fog: false, depthWrite: false, transparent: true }));
    this.sunSprite.scale.set(24, 24, 1);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTexture(), fog: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending, opacity: 0.35 }));
    halo.scale.set(3.2, 3.2, 1); // relative to the sun sprite
    halo.renderOrder = -1;
    this.sunSprite.add(halo);
    scene.add(this.sunSprite);
    this.moon = new Moon(scene);
    this.stars = buildStars();
    scene.add(this.stars);
    this.starMat = this.stars.material;
    this.clouds = buildClouds();
    scene.add(this.clouds);
    this.groundFog = buildGroundFog();
    scene.add(this.groundFog);
    this.renderer = renderer;

    // Fireflies
    const ff = scatterSpots(888, 70, (x, z) => { const h = heightAt(x, z); return h >= 1 && h < 6 && Math.hypot(x, z) < 48; });
    const ffPos = new Float32Array(ff.length * 3);
    this.ffBase = ff.map((p, i) => ({ x: p.x + 0.5, y: heightAt(p.x, p.z) + 1 + (p.r % 3) * 0.5, z: p.z + 0.5, ph: i * 1.7 }));
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
    this.ffMat = new THREE.PointsMaterial({ map: softDot(), color: '#f8f080', size: 7, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    this.fireflies = new THREE.Points(fg, this.ffMat);
    scene.add(this.fireflies);

    // Rain
    const RN = 1400;
    const rp = new Float32Array(RN * 6);
    this.rainSeed = Array.from({ length: RN }, () => [Math.random() * 60 - 30, Math.random() * 30, Math.random() * 60 - 30, 0.8 + Math.random() * 0.4]);
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    this.rainMat = new THREE.LineBasicMaterial({ color: '#c8d8f0', transparent: true, opacity: 0, depthWrite: false });
    this.rain = new THREE.LineSegments(rg, this.rainMat);
    this.rain.frustumCulled = false;
    scene.add(this.rain);

    this.flash = 0;
    this.nextFlash = 5;
    this.state = worldTime();
  }

  /** v1.13.1: a lightning bolt, 70-130 m away (toward boltDir when set, e.g. the way the camera looks). */
  strike(focus) {
    if (!this.boltMat) {
      this.boltMat = new THREE.MeshBasicMaterial({ color: '#eef4ff', transparent: true, opacity: 1, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
      this.boltGlowMat = new THREE.MeshBasicMaterial({ color: '#9ab8ff', transparent: true, opacity: 0.35, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
    }
    if (this.bolt) { this.scene.remove(this.bolt); this.bolt.traverse((o) => o.geometry?.dispose()); }
    const a = this.boltDir != null ? this.boltDir + (Math.random() - 0.5) * 0.6 : Math.random() * Math.PI * 2;
    const d = 70 + Math.random() * 60;
    const top = new THREE.Vector3(focus.x + Math.sin(a) * d, 70 + Math.random() * 15, focus.z + Math.cos(a) * d);
    const g = new THREE.Group();
    const path = (from, len, steps, spread) => {
      const pts = [from.clone()]; const p = from.clone();
      for (let i = 0; i < steps; i++) { p.y -= len / steps; p.x += (Math.random() - 0.5) * spread; p.z += (Math.random() - 0.5) * spread; pts.push(p.clone()); }
      return pts;
    };
    const tube = (pts, r) => {
      const c = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(c, pts.length * 3, r, 4), this.boltMat));
      g.add(new THREE.Mesh(new THREE.TubeGeometry(c, pts.length * 3, r * 4, 5), this.boltGlowMat));
    };
    const main = path(top, top.y - 1, 14, 9);
    tube(main, 0.35);
    for (let b = 0; b < 2; b++) { const at = main[3 + Math.floor(Math.random() * 6)]; tube(path(at, 12 + Math.random() * 14, 6, 7), 0.18); }
    this.bolt = g; this.scene.add(g);
  }

  update(dt, t, focus, water, props) {
    const wt = worldTime();
    this.state = wt;
    const k = sampleKeys(wt.f);
    const wx = wt.weather;
    const gloom = wx === 'overcast' ? 0.35 : wx === 'rain' ? 0.72 : wx === 'storm' ? 0.8 : 0; // v1.13.1: rain greys the sky a little more
    const grey = new THREE.Color(wx === 'rain' || wx === 'storm' ? '#7c838b' : '#8a94a0').multiplyScalar(0.4 + k.sun * 0.6);
    const sky = k.sky.clone().lerp(grey, gloom);
    const fog = k.fog.clone().lerp(grey, gloom);

    // Lightning (v1.13.1: a real bolt in the sky, and a double flicker like the real thing)
    if (wx === 'storm') {
      this.nextFlash -= dt;
      if (this.nextFlash <= 0) { this.flash = 1; this.reflash = 0.11; this.nextFlash = 8 + Math.random() * 14; this.strike(focus); this.onThunder?.(); }
    }
    if (this.reflash > 0) { this.reflash -= dt; if (this.reflash <= 0) this.flash = Math.max(this.flash, 0.85); }
    this.flash = Math.min(1, Math.max(0, this.flash - dt * 3.2));
    const flash = this.flash * 0.5;
    if (this.bolt) { this.bolt.visible = this.flash > 0.25 && !this.hideSky; this.boltMat.opacity = Math.min(1, this.flash * 1.4); }

    // Blood Moon: the night sky and the haze take on a deep red cast
    const night0 = 1 - Math.min(1, k.sun * 3);
    const blood = wt.bloodMoon ? night0 : 0;
    this.blood = blood;
    if (blood > 0) { sky.lerp(new THREE.Color('#5a0610'), blood * 0.92); fog.lerp(new THREE.Color('#560a14'), blood * 0.85); } // v1.9: properly red
    this.scene.background.copy(sky).addScalar(flash);
    this.scene.fog.color.copy(fog).addScalar(flash);
    // The valley is big: let the far mountains show through a soft haze on clear days.
    this.scene.fog.near = 40 + (1 - gloom) * 40;
    this.scene.fog.far = 150 + (1 - gloom) * 120;

    const ang = (wt.f - 0.25) * Math.PI * 2;
    const sunDir = new THREE.Vector3(Math.cos(ang), Math.sin(ang), -0.35).normalize();
    const R = 200;
    this.sunSprite.position.copy(focus).addScaledVector(sunDir, R);
    this.sunSprite.visible = sunDir.y > -0.1 && gloom < 0.6 && !this.hideSky;
    this.stars.visible = !this.hideSky; this.clouds.visible = !this.hideSky;
    const night = 1 - Math.min(1, k.sun * 3);
    this.night = night * (1 - gloom * 0.3) + gloom * 0.5; // how dark it is, 0..1 (used by personal lights)
    this.moon.update(focus, wt.f, wt.moon, night > 0.05 && gloom < 0.75 && !this.hideSky, gloom, blood);
    this.stars.position.copy(focus);
    this.starMat.uniforms.uOpacity.value = night * (1 - gloom * 0.9);
    this.starMat.uniforms.uTime.value = t;
    this.starMat.uniforms.uPx.value = this.renderer?.getPixelRatio?.() || 1;

    this.sun.intensity = k.sun * 1.25 * (1 - gloom * 0.7);
    if (this.shadowNow !== false) { // only when the shadow map is redrawn this frame (engine.js), so the two always agree
      this.sun.position.copy(focus).addScaledVector(sunDir.y > 0 ? sunDir : new THREE.Vector3(0, 1, 0), 80);
      this.sun.target.position.copy(focus);
    }
    this.sun.color.copy(k.light[1] < 0.9 ? new THREE.Color('#ffd0a0') : new THREE.Color('#fff4e0'));
    this.moonLight.intensity = night * 0.35 * (1 - gloom * 0.5) * (1 + blood * 1.6);
    this.moonLight.color.set(blood > 0 ? '#ff2a1a' : '#9fb0ff');
    this.moonLight.position.copy(focus).addScaledVector(this.moon.dir || new THREE.Vector3(0, 1, -1), 80);
    this.hemi.intensity = k.amb * (1 - gloom * 0.25) + flash * 3;
    this.hemi.color.copy(k.ambCol);
    this.hemi.groundColor.set(night > 0.5 ? '#202838' : '#6a6a50');
    if (blood > 0) { this.hemi.color.lerp(new THREE.Color('#c0202a'), blood * 0.8); this.hemi.groundColor.lerp(new THREE.Color('#3a0810'), blood * 0.8); this.hemi.intensity *= 1 + blood * 0.4; }

    const lampsOn = wt.f > 0.72 || wt.f < 0.27 || gloom > 0.45;
    this.lampsOn = lampsOn;
    this.dockLight.intensity = lampsOn ? 2.2 : 0;
    this.fireLight.intensity = (lampsOn ? 2.4 : 0.8) * (0.85 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.07);
    if (props?.campfire) this.fireLight.position.copy(props.campfire).setY(props.campfire.y + 1);
    if (props?.campfire2) { // (one light serves whichever of the far campfires you're nearest)
      const f2 = props.campfire3 && props.campfire3.distanceTo(focus) < props.campfire2.distanceTo(focus) ? props.campfire3 : props.campfire2;
      this.fireLight2.position.copy(f2).setY(f2.y + 1); this.fireLight2.intensity = f2.distanceTo(focus) < 40 ? this.fireLight.intensity : 0;
    }
    for (const f of props?.fires || []) if (f.position.distanceTo(focus) < 60) f.userData.update(t, dt, night, 0.3);
    props?.lodgeLamps?.update(dt, t, lampsOn, focus);
    nightWindows.update(dt, lampsOn); // v1.13.7
    if (props?.lanternGlow) { props.lanternGlow.opacity = lampsOn ? 1 : 0.35; const hm = props.lanternGlow.userData.halo; if (hm) hm.opacity += ((lampsOn ? 0.85 : 0) - hm.opacity) * Math.min(1, dt * 2); }
    if (props?.lighthouse) {
      const lh = props.lighthouse;
      const ang = t * 0.5;
      lh.beam.visible = lampsOn;
      lh.beam.rotation.y = ang;
      lh.lampMat.color.set(lampsOn ? '#fffaf0' : '#d8d0b0');
      if (lh.beamMat.uniforms) { lh.beamMat.uniforms.uOn.value += ((lampsOn ? 1 : 0) - lh.beamMat.uniforms.uOn.value) * Math.min(1, dt * 1.5); lh.beamMat.uniforms.uTime.value = t; }
      // which way the beams point (local -x after the spin), and how squarely one faces the camera
      const bx = -Math.cos(ang), bz = Math.sin(ang);
      if (lh.sweep) { lh.sweep.intensity = lampsOn ? 40 : 0; lh.sweep.target.position.set(lh.lamp.position.x + bx * 30, 0.8, lh.lamp.position.z + bz * 30); lh.sweep.target.updateMatrixWorld(); }
      if (lh.flare && this.camera) {
        const cx = this.camera.position.x - lh.lamp.position.x, cz = this.camera.position.z - lh.lamp.position.z, cl = Math.hypot(cx, cz) || 1;
        const face = Math.abs((bx * cx + bz * cz) / cl); // both beams: either one swinging past
        const glow = lampsOn ? 0.22 + 0.78 * Math.pow(face, 14) : 0;
        lh.flare.material.opacity = glow;
        const dist = this.camera.position.distanceTo(lh.lamp.position);
        lh.flare.scale.setScalar((0.8 + Math.pow(face, 14) * 3.5) * Math.max(1, dist / 40)); // v1.9.6: half the size it was
      }
    }
    props?.falls?.userData.update?.(t, water?.uniforms.uLight.value);

    // Clouds drift; ground fog pools at dawn, wisps at dusk and night
    const tint = sky.clone().lerp(new THREE.Color('#ffffff'), 0.55 + k.sun * 0.4).lerp(new THREE.Color('#9aa2ae'), gloom * 0.5);
    updateClouds(this.clouds, dt, { tint, sun: k.sun, gloom, night });
    const fogCol = fog.clone().lerp(new THREE.Color('#ffffff'), 0.35 + k.sun * 0.3);
    if (this.camera) updateGroundFog(this.groundFog, t, fogAmount(wt.f, wx), fogCol, this.camera.position);

    // Fireflies
    const ffOn = (wt.phase === 'night' || wt.phase === 'dusk') && wx !== 'rain' && wx !== 'storm';
    this.ffMat.opacity += ((ffOn ? 0.95 : 0) - this.ffMat.opacity) * Math.min(1, dt);
    if (this.ffMat.opacity > 0.01) {
      const arr = this.fireflies.geometry.attributes.position.array;
      this.ffBase.forEach((b, i) => {
        arr[i * 3] = b.x + Math.sin(t * 0.5 + b.ph) * 1.2;
        arr[i * 3 + 1] = b.y + Math.sin(t * 1.3 + b.ph * 2) * 0.4;
        arr[i * 3 + 2] = b.z + Math.cos(t * 0.4 + b.ph) * 1.2;
      });
      this.fireflies.geometry.attributes.position.needsUpdate = true;
      this.ffMat.size = 3 + Math.sin(t * 3) * 1;
    }

    // Rain
    const rainAmt = wx === 'rain' ? 0.7 : wx === 'storm' ? 1 : 0;
    this.rainMat.opacity += ((rainAmt * 0.55) - this.rainMat.opacity) * Math.min(1, dt);
    this.rain.visible = this.rainMat.opacity > 0.01;
    if (this.rain.visible) {
      const arr = this.rain.geometry.attributes.position.array;
      this.rainSeed.forEach((d, i) => {
        d[1] -= dt * 22 * d[3];
        if (d[1] < -2) d[1] += 30;
        const x = focus.x + d[0], y = focus.y + d[1], z = focus.z + d[2];
        arr.set([x, y, z, x + 0.1, y + 0.7, z], i * 6);
      });
      this.rain.geometry.attributes.position.needsUpdate = true;
    }

    // Water tint follows the light
    if (water) {
      const L = k.light;
      const lightMul = 1 - gloom * 0.3;
      water.uniforms.uLight.value.setRGB(L[0] * lightMul + flash, L[1] * lightMul + flash, L[2] * lightMul + flash);
      water.uniforms.uSkyTint.value.copy(sky);
      water.uniforms.uGlitter.value = (k.sun > 0.2 ? 1 : night * 0.6) * (1 - gloom);
      water.uniforms.uRain.value = rainAmt * 0.6;
      // the glitter path follows the sun by day and the moon by night
      water.uniforms.uSunDir.value.copy(night > 0.5 && this.moon.dir ? this.moon.dir : sunDir);
    }
    return { wt, night, lampsOn, rainAmt };
  }
}
