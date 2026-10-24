const UI_SFX = new Set(['click', 'hover', 'open', 'close', 'page', 'toggle']);
// Web Audio engine: buses, synthesized SFX, phase-driven ambience, generative lo-fi music (design doc section 12).
// Everything is synthesized, so there are no audio files to license. Sounds are addressed by id (see SFX below),
// so recorded files can replace any of them later without touching game code.

import { Music } from './music.js';

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.vol = { master: 0.6, music: 0.5, sfx: 0.8, ambience: 0.3, others: 0.5 };
    this.muted = false;
    this.focusMuted = false;
    this.duck = 1;
    this.phase = 'day';
    this.weather = 'clear';
    this.nearFire = 0;
    this.musicOn = true;
  }

  // Must be called from a user gesture.
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -18; this.comp.ratio.value = 3;
    this.master.connect(this.comp).connect(ctx.destination);
    const bus = () => { const g = ctx.createGain(); g.connect(this.master); return g; };
    this.bus = { music: bus(), sfx: bus(), ambience: bus(), others: bus() };
    this.musicDuck = ctx.createGain();
    this.musicDuck.connect(this.bus.music);
    // Shared noise buffers
    this.white = this.makeNoise('white');
    this.pink = this.makeNoise('pink');
    this.brown = this.makeNoise('brown');
    // Soft reverb for music + ambience
    this.verb = ctx.createConvolver();
    this.verb.buffer = this.makeImpulse(2.2);
    const verbOut = ctx.createGain(); verbOut.gain.value = 0.35;
    this.verb.connect(verbOut).connect(this.bus.music);
    this.applyVolumes();
    this.startAmbience();
    this.startMusic();
  }

  makeNoise(kind) {
    const ctx = this.ctx, len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w;
      else if (kind === 'pink') { b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0527; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; }
      else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    }
    return buf;
  }

  makeImpulse(sec) {
    const ctx = this.ctx, len = ctx.sampleRate * sec;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return buf;
  }

  setVolumes(v) { Object.assign(this.vol, v); this.applyVolumes(); }
  setMuted(m) { this.muted = m; this.applyVolumes(); }
  setFocusMuted(m) { this.focusMuted = m; this.applyVolumes(); }
  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const m = this.muted || this.focusMuted ? 0 : this.vol.master;
    this.master.gain.setTargetAtTime(m, t, 0.1);
    this.bus.music.gain.setTargetAtTime(this.vol.music * 0.55, t, 0.1);
    this.bus.sfx.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
    this.bus.ambience.gain.setTargetAtTime(this.vol.ambience * 0.6, t, 0.2);
    this.bus.others.gain.setTargetAtTime(this.vol.sfx * this.vol.others, t, 0.05);
  }

  setDuck(on) {
    if (!this.ctx) return;
    this.musicDuck.gain.setTargetAtTime(on ? 0.6 : 1, this.ctx.currentTime, 0.3);
  }

  // ---------- primitives ----------
  tone({ freq = 440, to = null, type = 'sine', dur = 0.2, vol = 0.3, attack = 0.005, out, when = 0, pan = 0, detune = 0 }) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t); o.detune.value = detune;
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o.connect(g);
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; node = node.connect(p); }
    node.connect(out || this.bus.sfx);
    o.start(t); o.stop(t + dur + 0.05);
  }

  noise({ dur = 0.2, vol = 0.3, type = 'lowpass', freq = 1000, to = null, q = 1, out, when = 0, buf = 'white', attack = 0.005, pan = 0 }) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource(); src.buffer = this[buf];
    src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = src.connect(f).connect(g);
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; node = node.connect(p); }
    node.connect(out || this.bus.sfx);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }

  bell(freq, { vol = 0.2, dur = 1.6, when = 0, out } = {}) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime + when;
    const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
    car.frequency.value = freq; mod.frequency.value = freq * 3.5; mg.gain.setValueAtTime(freq * 2, t); mg.gain.exponentialRampToValueAtTime(1, t + dur);
    mod.connect(mg).connect(car.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    car.connect(g).connect(out || this.bus.sfx);
    car.start(t); mod.start(t); car.stop(t + dur); mod.stop(t + dur);
  }

  marimba(freq, { vol = 0.25, when = 0, out } = {}) {
    this.tone({ freq, type: 'sine', dur: 0.5, vol, when, out });
    this.tone({ freq: freq * 4, type: 'sine', dur: 0.08, vol: vol * 0.3, when, out });
  }

  // ---------- SFX by id ----------
  get uiLast() { return this._uiLast || (this._uiLast = {}); }
  sfx(id, opts = {}) {
    // interface sounds play once even when several handlers ask for them at the same moment
    if (UI_SFX.has(id)) { const now = performance.now(); if (now - (this.uiLast[id] || 0) < 70) return; this.uiLast[id] = now; }
    this.onSound?.(id, opts);
    if (!this.ctx) return;
    const out = opts.remote ? this.bus.others : this.bus.sfx;
    const r = (a, b) => a + Math.random() * (b - a);
    switch (id) {
      case 'charge': this.tone({ freq: 160, to: 420, type: 'sawtooth', dur: 0.9, vol: 0.025, attack: 0.1, out }); break;
      case 'whoosh': this.noise({ dur: 0.35, vol: 0.22, type: 'bandpass', freq: 2400, to: 500, q: 1.4, attack: 0.03, out }); break;
      case 'plop': this.tone({ freq: r(520, 680), to: 180, dur: 0.12, vol: 0.3, out }); this.noise({ dur: 0.18, vol: 0.12, freq: 1200, to: 300, out }); break;
      case 'plip': this.tone({ freq: 900, to: 500, dur: 0.1, vol: 0.15, out }); break;
      case 'bite': this.noise({ dur: 0.3, vol: 0.3, freq: 900, to: 200, out }); this.tone({ freq: 1760, type: 'triangle', dur: 0.35, vol: 0.12, when: 0.02, out }); break;
      case 'hook': for (let i = 0; i < 6; i++) this.noise({ dur: 0.03, vol: 0.18, type: 'highpass', freq: 3000, when: i * 0.035, out }); break;
      case 'reelin': for (let i = 0; i < 8; i++) this.noise({ dur: 0.025, vol: 0.1, type: 'highpass', freq: 3500, when: i * 0.05, out }); break;
      case 'flop': this.noise({ dur: 0.12, vol: 0.35, freq: 700, to: 200, out }); this.noise({ dur: 0.1, vol: 0.25, freq: 600, to: 150, when: 0.16, out }); break;
      case 'miss': this.tone({ freq: 700, to: 350, dur: 0.18, vol: 0.12, out }); this.noise({ dur: 0.6, vol: 0.12, freq: 1500, to: 200, out }); break;
      case 'supercast': [784, 988, 1175, 1568].forEach((f, i) => { this.tone({ freq: f, type: 'triangle', dur: 0.32, vol: 0.06, when: i * 0.06, out }); this.tone({ freq: f * 2, dur: 0.2, vol: 0.015, when: i * 0.06 + 0.02, out }); }); this.noise({ dur: 0.5, vol: 0.03, type: 'highpass', freq: 6000, attack: 0.05, when: 0.1, out }); break;
      case 'superland': this.tone({ freq: 1568, to: 1480, dur: 0.9, vol: 0.05, attack: 0.005, out }); this.tone({ freq: 2093, dur: 0.6, vol: 0.025, when: 0.04, out }); break;
      case 'coin': this.tone({ freq: 1975, type: 'square', dur: 0.08, vol: 0.05, out }); this.tone({ freq: 2637, type: 'square', dur: 0.2, vol: 0.05, when: 0.07, out }); break;
      case 'dig': this.noise({ dur: 0.22, vol: 0.32, type: 'lowpass', freq: 900, to: 260, attack: 0.01, out }); this.tone({ freq: 95, to: 60, dur: 0.12, vol: 0.12, out }); this.noise({ dur: 0.14, vol: 0.08, type: 'highpass', freq: 2600, when: 0.04, out }); break;
      case 'dirt': this.noise({ dur: 0.3, vol: 0.12, type: 'bandpass', freq: 1400, to: 600, q: 0.8, attack: 0.02, out }); break;
      case 'shovelhit': this.tone({ freq: 620, type: 'triangle', dur: 0.25, vol: 0.12, out }); this.tone({ freq: 1240, type: 'sine', dur: 0.4, vol: 0.05, out }); this.noise({ dur: 0.08, vol: 0.2, freq: 1800, to: 500, out }); break;
      case 'creak': this.tone({ freq: 140, to: 210, type: 'sawtooth', dur: 0.55, vol: 0.035, attack: 0.08, out }); this.tone({ freq: 230, to: 170, type: 'sawtooth', dur: 0.35, vol: 0.02, when: 0.3, out }); break;
      case 'chestburst': this.noise({ dur: 0.4, vol: 0.18, type: 'bandpass', freq: 2200, to: 800, q: 0.7, out }); [1047, 1319, 1568, 2093, 2637].forEach((f, i) => this.tone({ freq: f, type: 'triangle', dur: 0.4, vol: 0.06, when: 0.05 + i * 0.07, out })); break;
      case 'coinpick': this.tone({ freq: opts.pearl ? 2349 : 1975 + Math.random() * 200, type: opts.pearl ? 'sine' : 'square', dur: 0.06, vol: 0.03, out }); break;
      case 'buff': [523, 659, 784, 1047].forEach((f, i) => this.tone({ freq: f, type: 'triangle', dur: 0.5, vol: 0.05, when: i * 0.05, out })); this.noise({ dur: 0.8, vol: 0.03, type: 'highpass', freq: 5000, attack: 0.2, out }); break;
      case 'purchase': this.noise({ dur: 0.15, vol: 0.2, freq: 500, to: 250, out }); this.sfx('coin'); break;
      case 'click': this.tone({ freq: 320, type: 'triangle', dur: 0.04, vol: 0.12, out }); this.noise({ dur: 0.02, vol: 0.06, type: 'highpass', freq: 2000, out }); break;
      case 'hover': this.tone({ freq: 1250, type: 'sine', dur: 0.025, vol: 0.022, out }); break;
      case 'toggle': this.tone({ freq: opts.on ? 660 : 440, type: 'triangle', dur: 0.05, vol: 0.09, out }); break;
      case 'page': this.noise({ dur: 0.18, vol: 0.08, type: 'bandpass', freq: 3000, to: 1200, attack: 0.04, out }); break;
      case 'open': this.tone({ freq: 520, type: 'triangle', dur: 0.06, vol: 0.1, out }); this.tone({ freq: 780, type: 'triangle', dur: 0.08, vol: 0.1, when: 0.05, out }); break;
      case 'close': this.tone({ freq: 780, type: 'triangle', dur: 0.06, vol: 0.08, out }); this.tone({ freq: 520, type: 'triangle', dur: 0.08, vol: 0.08, when: 0.05, out }); break;
      case 'row': this.noise({ dur: 0.35, vol: 0.12, freq: 700, to: 300, attack: 0.08, pan: opts.pan || 0, out }); break;
      case 'achievement': [1568, 2093, 2637].forEach((f, i) => this.tone({ freq: f, dur: 0.6, vol: 0.12, when: i * 0.13, out })); break;
      case 'levelup': [523, 659, 784, 1047, 1319].forEach((f, i) => this.marimba(f, { vol: 0.18, when: i * 0.08, out })); break;
      case 'reveal': {
        const tiers = { common: 3, uncommon: 4, rare: 5, epic: 6, legendary: 7, mythic: 8 };
        const n = tiers[opts.tier] || 3;
        const scale = [60, 64, 67, 72, 76, 79, 84, 88];
        for (let i = 0; i < n; i++) this.marimba(NOTE(scale[i] + 12), { vol: 0.16, when: i * 0.09, out });
        if (opts.variant === 'gold') for (let i = 0; i < 10; i++) this.tone({ freq: r(2500, 4500), type: 'triangle', dur: 0.15, vol: 0.04, when: 0.3 + i * 0.05, out });
        if (opts.variant === 'diamond') this.sfx('diamond', opts);
        break;
      }
      case 'diamond': {
        const notes = [84, 88, 91, 96, 100, 103, 108];
        notes.forEach((n, i) => this.bell(NOTE(n), { vol: 0.08, dur: 1.4, when: 0.25 + i * 0.11, out }));
        break;
      }
      case 'remoteGreat': this.bell(NOTE(91), { vol: 0.04, dur: 2, out: this.bus.others }); this.bell(NOTE(96), { vol: 0.03, dur: 2, when: 0.2, out: this.bus.others }); break;
      case 'bikebell': { const v = opts.vol ?? 1; this.bell(NOTE(88), { vol: 0.11 * v, dur: 0.9, out }); this.bell(NOTE(88), { vol: 0.09 * v, dur: 1.0, when: 0.14, out }); this.bell(NOTE(95), { vol: 0.03 * v, dur: 0.6, when: 0.14, out }); break; } // ding-ding!
      case 'bell': this.bell(NOTE(79), { vol: 0.18, dur: 2.2, out: this.bus.sfx }); this.bell(NOTE(79), { vol: 0.14, dur: 2.2, when: 0.45, out: this.bus.sfx }); break;
      case 'thunder': this.noise({ dur: 4.5, vol: 0.11, buf: 'brown', freq: 150, to: 50, attack: 0.9, out: this.bus.ambience, when: r(0.3, 1.5) }); break;
      case 'clap': for (let i = 0; i < 4; i++) this.noise({ dur: 0.05, vol: 0.2, type: 'bandpass', freq: 1500, q: 0.8, when: i * 0.18, out }); break;
      case 'whistle': this.tone({ freq: 1200, to: 1800, dur: 0.25, vol: 0.06, out }); this.tone({ freq: 1800, to: 1100, dur: 0.35, vol: 0.06, when: 0.28, out }); break;
      case 'yawn': this.tone({ freq: 300, to: 180, type: 'triangle', dur: 0.8, vol: 0.05, attack: 0.2, out }); break;
      case 'cheer': [660, 880, 990].forEach((f, i) => this.tone({ freq: f, type: 'triangle', dur: 0.15, vol: 0.06, when: i * 0.07, out })); break;
      case 'firework': this.tone({ freq: r(200, 400), to: r(1200, 2000), type: 'triangle', dur: 0.6, vol: 0.03, out: this.bus.ambience }); this.noise({ dur: 0.9, vol: 0.12, buf: 'brown', freq: 600, to: 120, when: 0.6, out: this.bus.ambience }); for (let i = 0; i < 8; i++) this.noise({ dur: 0.03, vol: 0.05, type: 'highpass', freq: 4000, when: 0.7 + i * 0.06, out: this.bus.ambience }); break;
      case 'meteor': this.noise({ dur: 1.1, vol: 0.05, type: 'bandpass', freq: 3000, to: 600, q: 2, attack: 0.2, out: this.bus.ambience }); break;
      case 'derby': this.tone({ freq: 392, type: 'sawtooth', dur: 0.35, vol: 0.05, out }); this.tone({ freq: 523, type: 'sawtooth', dur: 0.6, vol: 0.05, when: 0.3, out }); break;
      case 'step': this.step(opts.surface, opts.vol); break;
      case 'flap': for (let i = 0; i < 5; i++) this.noise({ dur: 0.06, vol: 0.06, type: 'bandpass', freq: 900, q: 0.7, when: i * 0.09, out: this.bus.ambience }); break;
      case 'honk': for (let i = 0; i < 3; i++) this.tone({ freq: 330 + i * 15, to: 280, type: 'sawtooth', dur: 0.16, vol: 0.012, when: i * 0.35 + Math.random() * 0.1, out: this.bus.ambience }); break;
      // v1.14.9 The Wild Woods
      case 'owl': { const v = opts.vol ?? 1; this.tone({ freq: 392, to: 370, type: 'sine', dur: 0.32, vol: 0.05 * v, attack: 0.06, out: this.bus.ambience }); this.tone({ freq: 392, to: 360, type: 'sine', dur: 0.5, vol: 0.06 * v, attack: 0.08, when: 0.45, out: this.bus.ambience }); this.tone({ freq: 330, to: 300, type: 'sine', dur: 0.6, vol: 0.045 * v, attack: 0.1, when: 1.05, out: this.bus.ambience }); break; }
      case 'shutter': this.noise({ dur: 0.04, vol: 0.2, type: 'highpass', freq: 2400, out }); this.tone({ freq: 600, type: 'square', dur: 0.03, vol: 0.05, out }); this.noise({ dur: 0.05, vol: 0.14, type: 'highpass', freq: 1800, when: 0.08, out }); break;
      case 'pop': this.tone({ freq: 520, to: 880, type: 'sine', dur: 0.08, vol: 0.12, out }); this.noise({ dur: 0.05, vol: 0.06, type: 'bandpass', freq: 1600, out }); break;
      case 'place': this.noise({ dur: 0.18, vol: 0.18, type: 'lowpass', freq: 600, to: 200, out }); this.tone({ freq: 140, to: 90, dur: 0.12, vol: 0.1, out }); break;
      case 'tick': this.tone({ freq: 1800 + Math.random() * 300, type: 'square', dur: 0.025, vol: 0.025, out }); break;
      case 'splashRemote': this.tone({ freq: r(400, 520), to: 160, dur: 0.12, vol: 0.12, out: this.bus.others }); break;
      default: break;
    }
  }

  // Ratchet loop while reeling.
  reelLoop(on, speed = 1) {
    if (!this.ctx) return;
    if (!on) { this.reelOn = false; return; }
    this.reelOn = true;
    const now = this.ctx.currentTime;
    if (!this.reelNext || this.reelNext < now) this.reelNext = now;
    while (this.reelNext < now + 0.15) {
      this.noise({ dur: 0.02, vol: 0.06 + speed * 0.04, type: 'highpass', freq: 3200, when: this.reelNext - now });
      this.reelNext += 0.11 / (0.5 + speed);
    }
  }

  // ---------- Footsteps by surface ----------
  step(surface = 'grass', vol = 1) {
    if (!this.ctx) return;
    const out = this.bus.sfx;
    const v = 0.06 * vol;
    if (surface === 'wood') { this.tone({ freq: 140 + Math.random() * 30, to: 90, type: 'triangle', dur: 0.08, vol: v * 1.3, out }); this.noise({ dur: 0.04, vol: v * 0.5, freq: 900, out }); }
    else if (surface === 'sand') this.noise({ dur: 0.09, vol: v * 0.8, type: 'bandpass', freq: 2600, q: 0.6, attack: 0.02, out });
    else if (surface === 'stone') { this.noise({ dur: 0.03, vol: v * 1.1, type: 'highpass', freq: 2200, out }); this.tone({ freq: 900 + Math.random() * 200, dur: 0.03, vol: v * 0.3, out }); }
    else if (surface === 'snow') this.noise({ dur: 0.12, vol: v, type: 'lowpass', freq: 1400, attack: 0.03, out });
    else this.noise({ dur: 0.07, vol: v * 0.7, type: 'bandpass', freq: 1500, q: 0.8, attack: 0.015, out });
  }

  // ---------- Ambience ----------
  startAmbience() {
    const ctx = this.ctx;
    const loop = (buf, type, freq, q = 0.7) => {
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(f).connect(g).connect(this.bus.ambience);
      src.start();
      return { g, f };
    };
    this.amb = {
      water: loop(this.brown, 'lowpass', 500),
      breeze: loop(this.pink, 'bandpass', 700, 0.5),
      // Rain is layered to soothe rather than hiss: a soft mid-band patter, a low hush of rain on the lake,
      // and (in ambienceTick) slow swells plus the odd gentle drop on leaves.
      rain: loop(this.pink, 'bandpass', 1300, 0.35),
      rainLow: loop(this.brown, 'lowpass', 380),
      fire: loop(this.brown, 'bandpass', 300, 0.8),
    };
    this.ambTimer = setInterval(() => this.ambienceTick(), 250);
  }

  setScene({ phase, weather, nearFire, nearFalls, region }) {
    // a new time of day (or rain) brings a new song: let the current one end at the next phrase
    const mood = weather === 'rain' || weather === 'storm' ? 'rain' : phase;
    this.mood = mood;
    this.phase = phase; this.weather = weather; this.nearFire = nearFire || 0; this.nearFalls = nearFalls || 0; this.region = region || '';
  }

  ambienceTick() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const { phase, weather } = this;
    const rain = weather === 'rain' ? 0.5 : weather === 'storm' ? 0.8 : 0;
    const set = (n, v) => this.amb[n].g.gain.setTargetAtTime(v, t, 1.5);
    set('water', 0.16 + Math.sin(t * 0.5) * 0.04 + (this.nearFalls || 0) * 0.25);
    set('breeze', phase === 'day' || phase === 'dawn' ? 0.08 + Math.sin(t * 0.13) * 0.04 : 0.03);
    const swell = 0.85 + Math.sin(t * 0.09) * 0.1 + Math.sin(t * 0.023) * 0.05;
    set('rain', rain * 0.12 * swell);
    set('rainLow', rain * 0.16 * swell);
    this.amb.rain.f.frequency.setTargetAtTime(1150 + Math.sin(t * 0.07) * 200, t, 2);
    if (rain && Math.random() < 0.35 * rain) this.raindrop();
    set('fire', this.nearFire * 0.18 * (0.8 + Math.random() * 0.4));
    const R = Math.random();
    const reg = this.region || '';
    // Each place has its own voice: loons on Frostpine, frogs in Lilymarsh, drips in the quarry,
    // babbling water along Willow River, chatter and an axe at the lodge.
    if (reg === 'Frostpine Lake') { set('breeze', 0.12 + Math.sin(t * 0.21) * 0.05); if (R > (phase === 'night' || phase === 'dawn' ? 0.97 : 0.988)) this.loon(); }
    else if (reg === 'Lilymarsh' || reg === 'Bog Hut') { if (R < (phase === 'night' || phase === 'dusk' ? 0.16 : 0.06)) this.frog(); if (phase === 'day' && R > 0.99) this.dragonfly(); }
    else if (reg === 'Old Quarry' || reg === 'Quarry Shed') { if (R < 0.05) this.drip(); }
    else if (reg === 'Willow River') set('water', 0.3 + Math.sin(t * 1.7) * 0.05);
    else if (reg === 'Pinewood Lodge' && phase !== 'night' && R > 0.992) this.axe();
    // birds by day, loons at dawn
    if ((phase === 'day' || phase === 'dawn') && !rain && R < 0.12) this.chirp();
    if (phase === 'dawn' && R > 0.985) this.loon();
    // crickets dusk/night
    if ((phase === 'dusk' || phase === 'night') && !rain && R < 0.35) this.cricket();
    if (phase === 'night' && R > 0.93 && R < 0.96) this.frog();
    if (phase === 'night' && R > 0.995) this.owl();
    if (this.nearFire > 0.3 && Math.random() < 0.5) this.noise({ dur: 0.03, vol: 0.05 * this.nearFire, type: 'highpass', freq: 2500, out: this.bus.ambience, when: Math.random() * 0.2 });
  }

  chirp() {
    const f = 2400 + Math.random() * 1800, n = 2 + Math.floor(Math.random() * 3);
    const pan = Math.random() * 1.6 - 0.8;
    for (let i = 0; i < n; i++) this.tone({ freq: f, to: f * (1.2 + Math.random() * 0.3), dur: 0.08, vol: 0.025, when: i * 0.12, out: this.bus.ambience, pan });
  }
  // a soft, rounded drop on a leaf or the boat: low and quiet, never a click
  raindrop() {
    const f = 520 + Math.random() * 380, pan = Math.random() * 1.4 - 0.7, w = Math.random() * 0.25;
    this.tone({ freq: f, to: f * 0.72, dur: 0.16, vol: 0.006 + Math.random() * 0.006, attack: 0.012, when: w, out: this.bus.ambience, pan });
  }
  drip() { this.onSound?.('drip'); const f = 1400 + Math.random() * 900; this.tone({ freq: f, to: f * 0.6, dur: 0.12, vol: 0.03, out: this.bus.ambience, pan: Math.random() - 0.5 }); this.tone({ freq: f * 0.8, to: f * 0.5, dur: 0.3, vol: 0.01, when: 0.15, out: this.bus.ambience }); }
  dragonfly() { this.tone({ freq: 180, type: 'sawtooth', dur: 0.7, vol: 0.006, attack: 0.2, out: this.bus.ambience, pan: Math.random() - 0.5 }); }
  axe() { for (let i = 0; i < 3; i++) this.tone({ freq: 220, to: 120, type: 'triangle', dur: 0.08, vol: 0.02, when: i * 0.9, out: this.bus.ambience, pan: -0.5 }); }
  loon() { this.onSound?.('loon'); this.tone({ freq: 620, to: 930, dur: 1.2, vol: 0.03, attack: 0.3, out: this.bus.ambience }); this.tone({ freq: 930, to: 700, dur: 1.4, vol: 0.025, attack: 0.2, when: 1.2, out: this.bus.ambience }); }
  cricket() {
    const pan = Math.random() * 1.6 - 0.8, f = 4200 + Math.random() * 600;
    for (let i = 0; i < 3; i++) this.tone({ freq: f, dur: 0.035, vol: 0.012, when: i * 0.05, out: this.bus.ambience, pan });
  }
  frog() { this.onSound?.('frog'); const pan = Math.random() * 1.2 - 0.6; this.tone({ freq: 140, to: 110, type: 'square', dur: 0.12, vol: 0.02, out: this.bus.ambience, pan }); this.tone({ freq: 160, to: 120, type: 'square', dur: 0.1, vol: 0.018, when: 0.16, out: this.bus.ambience, pan }); }
  owl() { this.onSound?.('owl'); this.tone({ freq: 380, to: 360, dur: 0.4, vol: 0.03, attack: 0.08, out: this.bus.ambience }); this.tone({ freq: 380, to: 350, dur: 0.6, vol: 0.03, attack: 0.08, when: 0.55, out: this.bus.ambience }); }

  // ---------- Music (v1.9): composed live by src/audio/music.js ----------
  startMusic() { this.music = new Music(this); }

  pad(freq, t, dur, vol, out) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.6);
    g.gain.setValueAtTime(vol, t + dur - 0.5);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.3);
    f.connect(g); g.connect(out); g.connect(this.verb);
    for (const d of [-6, 6]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq; o.detune.value = d;
      o.connect(f); o.start(t); o.stop(t + dur + 0.4);
    }
  }

  lead(kind, freq, t, lvl, out) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    const o = ctx.createOscillator();
    let dur = 0.6, vol = 0.05 * lvl;
    if (kind === 'kalimba') { o.type = 'sine'; dur = 0.7; vol = 0.07 * lvl; }
    else if (kind === 'guitar') { o.type = 'triangle'; dur = 0.5; vol = 0.05 * lvl; }
    else if (kind === 'rhodes') { o.type = 'sine'; dur = 1.1; vol = 0.06 * lvl; }
    else { o.type = 'triangle'; dur = 1.4; vol = 0.045 * lvl; }
    o.frequency.value = freq;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = kind === 'piano' ? 1400 : 2400;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g); g.connect(out); g.connect(this.verb);
    o.start(t); o.stop(t + dur + 0.05);
    if (kind === 'rhodes' || kind === 'kalimba') { // bell-ish overtone
      const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * (kind === 'kalimba' ? 5.4 : 2);
      const g2 = ctx.createGain(); g2.gain.setValueAtTime(vol * 0.25, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o2.connect(g2).connect(out); o2.start(t); o2.stop(t + 0.25);
    }
  }
}

function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
