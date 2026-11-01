// Avatar creator with a live turntable preview (design doc section 7).
import * as THREE from 'three';
import { h, clear } from './dom.js';
import { icon } from './icons.js';
import { buildAvatar, animateAvatar } from '../entities/avatar2.js';
import * as O from '../data/avatarOptions.js';
import { COUNTRIES, COUNTRY_BY_CODE, flagCanvas } from '../data/flags.js';
import { optionThumb } from './thumbs.js';

const CATS = [
  { id: 'body', label: 'Body', icon: 'user' }, { id: 'hair', label: 'Hair', icon: 'sparkles' }, { id: 'face', label: 'Face', icon: 'smile' },
  { id: 'top', label: 'Top', icon: 'shirt' }, { id: 'bottom', label: 'Bottom', icon: 'tag' }, { id: 'country', label: 'Country', icon: 'flag' },
];

/** v1.9.3: the country grid (your flag flies over Frostpine when you hold its record). */
export function countryGrid(current, onPick) {
  let q = '';
  const grid = h('div.flag-grid');
  const fill = () => {
    clear(grid);
    for (const c of COUNTRIES) {
      if (q && !c.name.toLowerCase().includes(q)) continue;
      grid.append(h(`button.flag-btn${current === c.code ? '.on' : ''}`, { 'aria-pressed': String(current === c.code), title: c.name, on: { click: () => { current = c.code; onPick(c.code); fill(); } } }, flagCanvas(c.code), h('span', c.name)));
    }
  };
  const search = h('input.flag-search', { type: 'search', placeholder: 'Search countries', 'aria-label': 'Search countries', on: { input: (e) => { q = e.target.value.trim().toLowerCase(); fill(); } } });
  fill();
  return h('div.flag-pick', search, grid);
}

export function openCreator(root, { avatar, owned = [], name = '', firstRun = false, audio } = {}) {
  return new Promise((resolve) => {
    let cfg = { ...(avatar || O.defaultAvatar('nonbinary')) };
    const history = [];
    const own = new Set(owned);
    let cat = 'body';
    let turn = -0.4, night = false, undoBtn = null;

    const canvasWrap = h('div.preview');
    const opts = h('div.opts');
    const cats = h('div.cats');
    const el = h('div.creator',
      canvasWrap,
      h('div.panel', cats, opts),
      h('div.foot',
        h('div', { style: { display: 'flex', gap: '6px' } },
          h('button.btn.ghost.on-dark', { on: { click: () => { push(); cfg = { ...O.randomAvatar(Math.random, own), country: cfg.country }; audio?.sfx('click'); rebuild(); } } }, icon('shuffle'), 'Randomize'),
          (undoBtn = h('button.btn.ghost.on-dark', { disabled: true, on: { click: () => { if (history.length) { cfg = history.pop(); audio?.sfx('click'); rebuild(); } } } }, icon('undo'), 'Undo'))),
        h('div', { style: { display: 'flex', gap: '6px' } },
          firstRun ? null : h('button.btn.ghost.on-dark', { on: { click: () => done(null) } }, 'Cancel'),
          h('button.btn.primary', { on: { click: () => { if (!cfg.country) { cat = 'country'; audio?.sfx('miss'); renderOpts(); opts.querySelector('.flag-need')?.classList.add('shake'); return; } done(cfg); } } }, icon('check'), firstRun ? "Let's fish" : 'Save look'))));
    root.append(el);

    // Preview renderer
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    canvasWrap.append(renderer.domElement);
    canvasWrap.append(
      h('div.drag-hint', 'Drag to turn'),
      h('div.rot',
        h('button.btn.ghost.on-dark.small', { 'aria-label': 'Turn left', on: { click: () => { turn -= 0.6; } } }, icon('rotL')),
        h('button.btn.ghost.on-dark.small', { 'aria-label': 'Turn right', on: { click: () => { turn += 0.6; } } }, icon('rotR')),
        h('button.btn.ghost.on-dark.small', { 'aria-pressed': 'false', on: { click: (e) => { night = !night; const b = e.currentTarget; clear(b).append(icon(night ? 'sun' : 'moon'), night ? 'Day' : 'Night'); b.setAttribute('aria-pressed', String(night)); } } }, icon('moon'), 'Night')),
    );
    // drag the preview to spin your angler
    let dragX = null;
    canvasWrap.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; dragX = e.clientX; canvasWrap.setPointerCapture?.(e.pointerId); });
    canvasWrap.addEventListener('pointermove', (e) => { if (dragX == null) return; turn += (e.clientX - dragX) * 0.012; holder.rotation.y = turn; dragX = e.clientX; });
    const endDrag = () => { dragX = null; };
    canvasWrap.addEventListener('pointerup', endDrag); canvasWrap.addEventListener('pointercancel', endDrag);
    if (name) canvasWrap.append(h('div.nm.chip.plank', name));
    const scene = new THREE.Scene();
    const hemi = new THREE.HemisphereLight('#ffffff', '#6a5a4a', 1.0);
    const sun = new THREE.DirectionalLight('#fff4e0', 1.2);
    sun.position.set(2, 3, 4);
    scene.add(hemi, sun);
    const ground = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.12, 16), new THREE.MeshLambertMaterial({ color: '#7bb661' }));
    ground.position.y = -0.06;
    scene.add(ground);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    let av = null;
    const holder = new THREE.Group();
    scene.add(holder);

    function rebuild() {
      if (av) { holder.remove(av.group); av.dispose?.(); }
      av = buildAvatar(cfg);
      holder.add(av.group);
      renderOpts();
    }
    function push() { history.push({ ...cfg, extras: [...(cfg.extras || [])] }); if (history.length > 30) history.shift(); }
    function set(k, v) { push(); cfg = { ...cfg, [k]: v }; audio?.sfx('click'); rebuild(); }

    function resize() {
      const w = canvasWrap.clientWidth, hh = canvasWrap.clientHeight;
      renderer.setSize(w, hh, false);
      camera.aspect = w / hh;
      // frame the whole angler: back off on tall, narrow previews
      const dist = 5.3 / Math.min(1, camera.aspect / 0.75);
      camera.position.set(0, 1.15, dist);
      camera.lookAt(0, 0.82, 0);
      camera.updateProjectionMatrix();
    }
    let alive = true;
    let t = 0;
    function loop() {
      if (!alive) return;
      requestAnimationFrame(loop);
      t += 1 / 60;
      holder.rotation.y += (turn - holder.rotation.y) * 0.15;
      if (av) animateAvatar(av, 'idle', t);
      hemi.intensity = night ? 0.45 : 1.0; sun.intensity = night ? 0.25 : 1.2;
      hemi.color.set(night ? '#8090d0' : '#ffffff');
      renderer.render(scene, camera);
    }
    window.addEventListener('resize', resize);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;
    ro?.observe(canvasWrap);

    // v1.10: every option shows a little picture of your angler wearing it (rendered a few at a time)
    let thumbJobs = [], thumbTimer = 0;
    const pump = () => {
      thumbTimer = 0;
      const t0 = performance.now();
      while (thumbJobs.length && performance.now() - t0 < 12) { const [img, c, r] = thumbJobs.shift(); if (img.isConnected) img.src = optionThumb(c, r); }
      if (thumbJobs.length) thumbTimer = requestAnimationFrame(pump);
    };
    const thumb = (c, region) => {
      const img = h('img.opt-pic', { alt: '', draggable: false });
      thumbJobs.push([img, c, region]);
      if (!thumbTimer) thumbTimer = requestAnimationFrame(pump);
      return img;
    };
    const REGION = { gender: 'full', frame: 'full', height: 'tall', hair: 'head', eyes: 'head', brows: 'head', mouth: 'head', facialHair: 'head', eyewear: 'head', hat: 'head', shirt: 'torso', accessory: 'torso', pants: 'legs', shoes: 'feet' };
    const optBtn = (on, label, pic, extra = {}) => h(`button.opt${on ? '.on' : ''}`, { 'aria-pressed': String(on), ...extra }, h('span.opt-frame', pic), h('span.opt-name', label));
    const chooser = (key, list) => h('div.chooser.opt-grid', list.map((o) => {
      const locked = o.item && !own.has(o.item);
      return optBtn(cfg[key] === o.id, locked ? [icon('lock'), ` ${o.name}`] : o.name, thumb({ ...cfg, [key]: o.id, ...(key === 'hair' ? { hat: 'none' } : {}) }, REGION[key] || 'full'),
        { disabled: locked, title: locked ? 'Unlock in the shop or with an achievement' : o.name, on: { click: () => set(key, o.id) } });
    }));
    const swatches = (key, colors) => h('div.swatches', colors.map((c, i) => h(`button${(cfg[key] ?? 0) === i ? '.on' : ''}`, { style: { background: c === 'default' ? 'repeating-linear-gradient(45deg,#e8dcc0 0 5px,#b8a888 5px 10px)' : c }, title: c === 'default' ? 'Original colour' : '', 'aria-label': c === 'default' ? 'Original colour' : `Color ${i + 1}`, on: { click: () => set(key, i) } })));

    function renderOpts() {
      thumbJobs = [];
      const keepScroll = opts.scrollTop;
      requestAnimationFrame(() => { opts.scrollTop = keepScroll; });
      clear(cats);
      for (const c of CATS) cats.append(h(`button${cat === c.id ? '.on' : ''}`, { role: 'tab', 'aria-selected': String(cat === c.id), on: { click: () => { cat = c.id; audio?.sfx('page'); renderOpts(); } } }, icon(c.icon), c.label));
      if (undoBtn) undoBtn.disabled = !history.length;
      clear(opts);
      const H = (t) => h('h4', t);
      switch (cat) {
        case 'body':
          opts.append(H('Gender'), h('div.chooser.opt-grid', O.GENDERS.map((g) => optBtn(cfg.gender === g.id, g.name, thumb({ ...cfg, ...(firstRun && !history.length ? O.DEFAULT_AVATARS[g.id] : {}), gender: g.id, frame: g.id === 'female' ? 'slim' : 'standard', country: cfg.country }, 'full'), { on: { click: () => { push(); cfg = { ...cfg, gender: g.id, frame: g.id === 'female' ? 'slim' : 'standard' }; if (firstRun && !history.slice(0, -1).length) Object.assign(cfg, O.DEFAULT_AVATARS[g.id]); audio?.sfx('click'); rebuild(); } } }))),
            h('div.muted', { style: { margin: '4px 0' } }, 'Every hair, face and outfit option is open to everyone.'),
            H('Body frame'), chooser('frame', O.FRAMES), H('Height'), chooser('height', O.HEIGHTS), H('Skin tone'), swatches('skin', O.SKINS));
          break;
        case 'hair':
          opts.append(H('Hair style'), chooser('hair', O.HAIR_STYLES), H('Hair color'), swatches('hairColor', O.HAIR_COLORS));
          break;
        case 'face': {
          const extras = new Set(cfg.extras || []);
          opts.append(H('Eyes'), chooser('eyes', O.EYES), H('Eye color'), swatches('eyeColor', O.EYE_COLORS), H('Brows'), chooser('brows', O.BROWS),
            H('Mouth'), chooser('mouth', O.MOUTHS), H('Facial hair'), chooser('facialHair', O.FACIAL_HAIR),
            H('Eyewear'), chooser('eyewear', O.EYEWEAR),
            H('Extras'), h('div.chooser.opt-grid', O.EXTRAS.map((x) => optBtn(extras.has(x.id), x.name, thumb({ ...cfg, extras: [...new Set([...(cfg.extras || []).filter((e) => !(x.id.startsWith('glasses') && e.startsWith('glasses'))), x.id])] }, 'head'), { on: { click: () => {
              push();
              const next = new Set(cfg.extras || []);
              if (next.has(x.id)) next.delete(x.id); else {
                if (x.id.startsWith('glasses')) { next.delete('glassesRound'); next.delete('glassesSquare'); }
                next.add(x.id);
              }
              cfg = { ...cfg, extras: [...next] }; audio?.sfx('click'); rebuild();
            } } }))));
          break;
        }
        case 'top':
          opts.append(H('Hat'), chooser('hat', O.HATS), ...(cfg.hat && cfg.hat !== 'none' && cfg.hat !== 'hat_crown' && cfg.hat !== 'hat_captain' ? [H('Hat color'), swatches('hatColor', O.HAT_COLORS)] : []), H('Shirt'), chooser('shirt', O.SHIRTS), H(cfg.shirt === 'sundress' ? 'Dress color' : cfg.shirt === 'denim' ? 'Inner shirt color' : 'Shirt color'), swatches('shirtColor', O.CLOTH_COLORS), H('Accessory'), chooser('accessory', O.ACCESSORIES));
          break;
        case 'bottom':
          opts.append(H('Pants'), chooser('pants', O.PANTS), H('Pants color'), swatches('pantsColor', O.PANT_COLORS), H('Shoes'), chooser('shoes', O.SHOES));
          break;
        case 'country':
          opts.append(H('Country of origin'),
            h(`div.muted${cfg.country ? '' : '.flag-need'}`, { style: { margin: '4px 0 8px' } }, cfg.country ? `${COUNTRY_BY_CODE[cfg.country]?.name || ''}. The angler holding the Frostpine Lake record each week gets their flag on the cairn there.` : 'Pick your country before you head out. Whoever holds the Frostpine Lake record each week gets their flag planted on the cairn there.'),
            countryGrid(cfg.country, (code) => { push(); cfg = { ...cfg, country: code }; audio?.sfx('click'); const m = opts.querySelector('.muted'); if (m) { m.classList.remove('flag-need'); m.textContent = `${COUNTRY_BY_CODE[code].name}. The angler holding the Frostpine Lake record each week gets their flag on the cairn there.`; } if (undoBtn) undoBtn.disabled = false; }));
          break;
        default: break;
      }
    }

    function done(result) {
      alive = false;
      thumbJobs = []; if (thumbTimer) cancelAnimationFrame(thumbTimer);
      window.removeEventListener('resize', resize);
      ro?.disconnect();
      renderer.dispose();
      el.remove();
      audio?.sfx(result ? 'open' : 'close');
      resolve(result);
    }

    rebuild();
    requestAnimationFrame(() => { resize(); loop(); });
  });
}

/** v1.9.3: anglers from before countries pick one once (a small sheet over the title screen). */
export function openCountryPicker(root, { audio } = {}) {
  return new Promise((resolve) => {
    let pick = null;
    const go = h('button.btn.primary', { disabled: true, on: { click: () => { el.remove(); audio?.sfx('open'); resolve(pick); } } }, icon('check'), "Let's fish");
    const el = h('div.country-sheet', h('div.plank.country-card', { role: 'dialog', 'aria-label': 'Pick your country' },
      h('h3', 'Where are you fishing from?'),
      h('div.muted', 'New at Frostpine Lake: whoever holds the lake record each week gets their flag planted on the cairn. Pick your country to join in. You can change it any time under Customize angler.'),
      countryGrid(null, (code) => { pick = code; go.disabled = false; audio?.sfx('click'); }),
      h('div.country-foot', go)));
    root.append(el);
  });
}
