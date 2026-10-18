// Renderer, scene, camera rig, input and the main loop.
import * as THREE from 'three';
import { buildTerrainMesh, SPAWN, WATER_Y } from '../world/terrain.js';
import { buildWater } from '../world/water.js';
import { buildProps } from '../world/props.js';
import { Sky } from '../world/sky.js';
import { updateLightBudget, precompile } from '../render/lightbudget.js';

const QUALITY = {
  low: { scale: 0.55, shadows: false },
  medium: { scale: 0.75, shadows: true },
  high: { scale: 1.0, shadows: true },
};

export class Engine {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 520);
    this.cam = { yaw: 0, pitch: 0.52, dist: 11, target: new THREE.Vector3(SPAWN.x, 2, SPAWN.z), zoom: 1 };

    this.terrain = buildTerrainMesh();
    this.scene.add(this.terrain);
    this.water = buildWater();
    this.scene.add(this.water.mesh);
    this.props = buildProps(this.scene);
    this.sky = new Sky(this.scene, this.renderer);
    this.sky.camera = this.camera;

    this.raycaster = new THREE.Raycaster();
    this.waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -WATER_Y);
    this.updaters = [];
    this.time = 0;
    this.quality = 'medium';
    this.setQuality('medium');
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.hidden = false;
    document.addEventListener('visibilitychange', () => { this.hidden = document.hidden; });
  }

  setQuality(q) {
    this.quality = QUALITY[q] ? q : 'medium';
    const Q = QUALITY[this.quality];
    this.resScale = 1; // automatic resolution (v1.13.19) starts back at the quality's own setting
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2) * Q.scale);
    this.renderer.shadowMap.enabled = Q.shadows;
    this.sky.sun.castShadow = Q.shadows;
    this.props?.groundCover?.setQuality(this.quality);
    this.resize();
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Narrow side panels get a wider vertical FOV so the lake still fits.
    this.camera.fov = w / h < 0.8 ? 58 : 48;
    this.camera.updateProjectionMatrix();
    this.width = w; this.height = h;
    this.overlay?.resize?.(w, h);
  }

  updateCamera(dt, focus) {
    const c = this.cam;
    c.target.lerp(focus, Math.min(1, dt * 4));
    // juice: a zoom pulse eases back to 1, and a decaying shake jitters the camera
    c.pulse = (c.pulse ?? 1) + (1 - (c.pulse ?? 1)) * Math.min(1, dt * 5);
    // Pitch below LOW_PITCH means "look up": the camera settles in low behind your shoulder and tilts
    // up toward the sky (all the way to nearly straight up), for stars and meteor showers.
    const LOW = 0.15;
    const look = Math.max(0, LOW - c.pitch); // 0 .. ~1.4
    const orbitPitch = Math.max(LOW, c.pitch);
    const dist = c.dist * c.zoom * c.pulse * (1 - Math.min(0.55, look * 0.45));
    let x = c.target.x + Math.sin(c.yaw) * Math.cos(orbitPitch) * dist;
    let z = c.target.z + Math.cos(c.yaw) * Math.cos(orbitPitch) * dist;
    let y = c.target.y + Math.sin(orbitPitch) * dist;
    // v1.8.1: tight spaces (the cavern) pull the camera in rather than letting it clip through rock;
    // it comes in quickly and eases back out
    if (this.camFit) {
      const want = this.camFit(c.target.x, c.target.y + 0.6, c.target.z, x, y, z);
      c.fit = want < (c.fit ?? 1) ? want : (c.fit ?? 1) + (want - (c.fit ?? 1)) * Math.min(1, dt * 2.5);
      if (c.fit < 0.999) { x = c.target.x + (x - c.target.x) * c.fit; y = c.target.y + (y - c.target.y) * c.fit; z = c.target.z + (z - c.target.z) * c.fit; }
    }
    this.camera.position.set(x, Math.max(y, WATER_Y + 1.2), z);
    if (look > 0) {
      const tilt = Math.min(1.45, look * 1.1);
      const hx = c.target.x - x, hz = c.target.z - z, hl = Math.hypot(hx, hz) || 1;
      this.camera.lookAt(x + hx / hl, this.camera.position.y + Math.tan(tilt), z + hz / hl);
    } else this.camera.lookAt(c.target.x, c.target.y + 0.6, c.target.z);
    if (this.shake > 0.001) {
      const k = this.shake * this.shake;
      this.camera.position.x += (Math.random() - 0.5) * k * 0.8;
      this.camera.position.y += (Math.random() - 0.5) * k * 0.6;
      this.camera.rotation.z += (Math.random() - 0.5) * k * 0.06;
      this.shake = Math.max(0, this.shake - dt * 2.6);
    }
    // Labels over heads are projected right after this; without fresh matrices they would use last
    // frame's camera and wobble against the world while you move.
    this.camera.updateMatrixWorld();
  }

  // Ray from screen point (client px) to the scene. Returns { point, kind: 'water'|'ground'|null }
  pick(clientX, clientY, objects) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(objects || [...this.terrain.children, ...this.deckMeshes()], false);
    const wp = new THREE.Vector3();
    const waterHit = this.raycaster.ray.intersectPlane(this.waterPlane, wp);
    const t = hits[0];
    if (t && (!waterHit || t.distance < this.raycaster.ray.origin.distanceTo(wp) + 0.01)) return { point: t.point, kind: 'ground', object: t.object };
    if (waterHit) return { point: wp, kind: 'water' };
    return null;
  }

  dockMesh() { return this.scene.getObjectByName('dock'); }
  deckMeshes() { return ['dock', 'jetties', 'bridge'].map((n) => this.scene.getObjectByName(n)).filter(Boolean); }

  // World position -> screen px
  toScreen(v) {
    const p = (this._ts || (this._ts = new THREE.Vector3())).set(v.x, v.y, v.z).project(this.camera);
    if (p.z > 1) return null;
    return { x: (p.x * 0.5 + 0.5) * this.width, y: (-p.y * 0.5 + 0.5) * this.height };
  }

  // v1.13.19: automatic resolution. Frame times are averaged; after a few slow seconds (under ~40 fps) the game draws
  // at a slightly lower resolution, down to 70% of the quality's own; after a long smooth stretch it steps back up.
  autoResolution(dt) {
    if (!this.autoRes) { if (this.resScale !== 1) this.applyResScale(1); return; }
    if (dt <= 0 || dt >= 0.1) return; // stalls (tab switches, loading) say nothing about steady speed
    this.ftAvg = this.ftAvg == null ? dt : this.ftAvg + (dt - this.ftAvg) * 0.05;
    this.resT = (this.resT || 0) + dt;
    if (this.ftAvg > 1 / 40 && this.resT > 3 && this.resScale > 0.7) { this.applyResScale(Math.max(0.7, this.resScale - 0.1)); this.resT = 0; }
    else if (this.ftAvg < 1 / 55 && this.resT > 8 && this.resScale < 1) { this.applyResScale(Math.min(1, this.resScale + 0.1)); this.resT = 0; }
  }

  applyResScale(k) {
    this.resScale = k;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2) * QUALITY[this.quality].scale * k);
    this.resize();
  }

  /** Compile every shader up front (loading screen), for both light set-ups. */
  precompile() { return precompile(this.renderer, this.scene, this.camera); }

  // Swap the per-frame update without restarting the loop.
  setUpdate(fn) { this.updateFn = fn; }

  start(update) {
    this.updateFn = update;
    if (this.running) return;
    this.running = true;
    let last = performance.now();
    let acc = 0;
    const loop = (now) => {
      requestAnimationFrame(loop);
      // rAF timestamps can trail performance.now(): never let a step go negative.
      let dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
      if (this.hidden) {
        acc += dt; last = now;
        if (acc < 1) return; // ~1 Hz while hidden
        dt = Math.max(0, Math.min(1, acc)); acc = 0;
      }
      last = now;
      this.time += dt;
      if (!this.hidden) this.autoResolution(dt);
      // v1.13.19: the sun's shadow map is redrawn every frame on high, every other frame on medium (about a third of
      // the frame went on it). The sun only follows you on those frames (sky.js), so shadows of still things never
      // slip; moving things' shadows simply update at half rate.
      this.frameNo = (this.frameNo || 0) + 1;
      const shadowNow = this.quality === 'high' || this.frameNo % 2 === 0;
      this.renderer.shadowMap.autoUpdate = false;
      this.renderer.shadowMap.needsUpdate = shadowNow;
      this.sky.shadowNow = shadowNow;
      this.water.update(this.time);
      this.updateFn(dt, this.time);
      // An overlay scene (your cabin) replaces the lake view while it is open.
      updateLightBudget(dt, this.scene, this.cam.target, this.sky.night ?? 1); // after every system has set its lights' brightness
      const ov = this.overlay;
      if (ov) { ov.update?.(dt, this.time); if (!this.hidden) this.renderer.render(ov.scene, ov.camera); }
      else if (!this.hidden) this.renderer.render(this.scene, this.camera);
    };
    requestAnimationFrame(loop);
  }
}
