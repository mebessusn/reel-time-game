// 16x16 pixel-art icons drawn from strings. '.' = transparent.
const PAL = {
  k: '#2a1a10', w: '#ffffff', y: '#f2c040', Y: '#c08a20', o: '#e8784a', r: '#c8503a', R: '#8a2a1a', g: '#5eae3e', G: '#2e6a1e',
  b: '#4a90e2', B: '#1e4a7a', c: '#a8e8f8', C: '#4ab8d8', s: '#c8c8c8', S: '#8a8a8a', t: '#b07a48', T: '#6a4024', p: '#f0a0c0', P: '#e8eef8',
  n: '#3b2a1e', m: '#f6ebd3', v: '#9b59d0', e: '#f8e8a0',
};

const ICONS = {
  bike: [
    '................', '................', '................', '..........kkk...', '.....kkk...r....', '......r....r....', '......rrrrrr....', '......r...rr....',
    '.kkkkk...rkkrkk.', 'kk...rk.rkk.r.kk', 'k...r.kr.k..r..k', 'k..srrrr.k..s..k', 'k.....k..k.....k', 'kk...kk..kk...kk', '.kkkkk....kkkkk.', '................'],
  coin: [
    '................', '.....kkkkkk.....', '...kkyyyyyykk...', '..kyyeeyyyyyyk..', '..kyeyyYYYyyyk..', '.kyyeyYyyyYyyyk.', '.kyyyyYyyyyyyyk.', '.kyyyyYYYyyyyyk.',
    '.kyyyyyyyYyyyyk.', '.kyyyyYyyyYyyyk.', '.kyyyyyYYYyyyyk.', '..kyyyyyyyyyyk..', '..kYyyyyyyyyYk..', '...kkYYYYYYkk...', '.....kkkkkk.....', '................'],
  pearl: [
    '................', '................', '......kkkk......', '....kkPPPPkk....', '...kPwwPPPPPk...', '...kPwPPPPPPk...', '..kPPPPPPPPPPk..', '..kPPPPPPPPcPk..',
    '..kPPPPPPPcPPk..', '..kPPPPPPcPPPk..', '...kPPPPPPPPk...', '...kcPPPPPPck...', '....kkccccrk....', '......kkkk......', '................', '................'],
  sun: [
    '.......y........', '.......y........', '..y....y....y...', '...y.......y....', '.....kkkkk......', '....kyyyyyk.....', 'yy.kyyeyyyyk.yy.', '...kyeyyyyyk....',
    '...kyyyyyyyk....', '...kyyyyyyyk....', '....kyyyyyk.....', '.....kkkkk......', '...y.......y....', '..y....y....y...', '.......y........', '.......y........'],
  moon: [
    '................', '......kkkk......', '....kkPPPPk.....', '...kPPPPPk......', '..kPPSPPk.......', '..kPPPPPk.......', '.kPPPPPk........', '.kPPSPPk........',
    '.kPPPPPk........', '.kPPPPPPk.......', '..kPPPSPPk......', '..kPPPPPPPkk....', '...kPPPPPPPPk...', '....kkPPPPkk....', '......kkkk......', '................'],
  dawn: [
    '................', '................', '................', '................', '................', '......kkkk......', '....kkooookk....', '...kooyyyyook...',
    '..kooyyeeyyook..', '..kyyyyyyyyyyk..', 'pppppppppppppppp', 'bbbbbbbbbbbbbbbb', 'BbbBbbbBbbbBbbbB', 'bbbbbbbbbbbbbbbb', 'BBBBBBBBBBBBBBBB', '................'],
  cloud: [
    '................', '................', '................', '......kkkk......', '.....kwwwwk.....', '...kkwwwwwwkk...', '..kwwwwwwwwwwk..', '.kwwwwwwwwwwwwk.',
    '.kwwwwwwwwwwwwk.', '.ksswwwwwwwwssk.', '..kssssssssssk..', '...kkkkkkkkkk...', '................', '................', '................', '................'],
  rain: [
    '................', '......kkkk......', '.....kssssk.....', '...kksssssskk...', '..ksssssssssk...', '.kssssssssssssk.', '.kSSssssssssSSk.', '..kkkkkkkkkkkk..',
    '................', '...b...b...b....', '..b...b...b.....', '................', '....b...b...b...', '...b...b...b....', '................', '................'],
  storm: [
    '................', '......kkkk......', '.....kSSSSk.....', '...kkSSSSSSkk...', '..kSSSSSSSSSk...', '.kSSSSSSSSSSSSk.', '.kSSSSSSSSSSSSk.', '..kkkkkykkkkkk..',
    '......yy........', '.....yy.........', '....yyyyy.......', '......yy........', '.....yy.........', '....y...........', '................', '................'],
  creel: [
    '................', '....kkkkkkkk....', '...k........k...', '..k..........k..', '.kkkkkkkkkkkkkk.', '.kttTttTttTttTk.', '.kTttTttTttTttk.', '.kttTttTttTttTk.',
    '.kTttTttTttTttk.', '.kttTttTttTttTk.', '..kTttTttTttTk..', '..kttTttTttTtk..', '...kTttTttTtk...', '....kkkkkkkk....', '................', '................'],
  book: [
    '................', '..kkkkkkkkkkkk..', '..kbbbbbbbbbbk..', '..kbmmmmmmmmbk..', '..kbmyyyyyymbk..', '..kbmmmmmmmmbk..', '..kbbbbbbbbbbk..', '..kbbbbbbbbbbk..',
    '..kbbbcccbbbbk..', '..kbbcbbbcbbbk..', '..kbbbcccbbcbk..', '..kbbbbbbbbbbk..', '..kmmmmmmmmmmk..', '..kkkkkkkkkkkk..', '................', '................'],
  shop: [
    '................', '.....kkkkkk.....', '....k......k....', '....k......k....', '..kkkkkkkkkkkk..', '..kyyyyyyyyyyk..', '..kyyyyyyyyyyk..', '..kyyykkkyyyyk..',
    '..kyyk...kyyyk..', '..kyyyk.kyyyyk..', '..kyyyykyyyyyk..', '..kYYYYYYYYYYk..', '..kYYYYYYYYYYk..', '..kkkkkkkkkkkk..', '................', '................'],
  trophy: [
    '................', '..kkkkkkkkkkkk..', '.kykyyyyyyyykyk.', '.kyk.yyeyyyykyk.', '.kyk.yyeyyyykyk.', '..kykyyyyyyyky..', '...kkyyyyyykk...', '.....kyyyyk.....',
    '......kyyk......', '......kyyk......', '.....kkyykk.....', '....kYYYYYYk....', '....kYyyyyYk....', '....kkkkkkkk....', '................', '................'],
  gear: [
    '................', '......kkkk......', '...kk.kssk.kk...', '..kssksssskssk..', '..ksssssssssk...', '...kssskksssk...', '.kksssk..kssskk.', '.ksssk....ksssk.',
    '.ksssk....ksssk.', '.kksssk..kssskk.', '...kssskksssk...', '..ksssssssssk...', '..kssksssskssk..', '...kk.kssk.kk...', '......kkkk......', '................'],
  smile: [
    '................', '.....kkkkkk.....', '...kkyyyyyykk...', '..kyyyyyyyyyyk..', '.kyyykyyyykyyyk.', '.kyyykyyyykyyyk.', '.kyyyyyyyyyyyyk.', '.kyyyyyyyyyyyyk.',
    '.kyykyyyyyykyyk.', '.kyyykyyyykyyyk.', '..kyyykkkkyyyk..', '..kyyyyyyyyyyk..', '...kkyyyyyykk...', '.....kkkkkk.....', '................', '................'],
  boat: [
    '................', '.......k........', '.......kw.......', '.......kww......', '.......kwww.....', '.......kwwww....', '.......k........', '..kkkkkkkkkkkk..',
    '..kttttttttttk..', '...kTtttttttk...', '....kkkkkkkk....', 'bbbbbbbbbbbbbbbb', '.BbbbBbbbbBbbbB.', '................', '................', '................'],
  star: [
    '................', '.......kk.......', '.......yk.......', '......kyyk......', '......kyyk......', 'kkkkkkyyyykkkkkk', '.kyyyyyyyyyyyyk.', '..kyyyyyyyyyyk..',
    '...kyyyyyyyyk...', '...kyyyyyyyyk...', '..kyyyykkyyyyk..', '..kyyk....kyyk..', '.kyk........kyk.', '.kk..........kk.', '................', '................'],
  bell: [
    '................', '.......kk.......', '......kyyk......', '.....kyyyyk.....', '....kyyeyyyk....', '....kyeyyyyk....', '....kyyyyyyk....', '...kyyyyyyyyk...',
    '...kyyyyyyyyk...', '..kyyyyyyyyyyk..', '..kkkkkkkkkkkk..', '......kyyk......', '.......kk.......', '................', '................', '................'],
  user: [
    '................', '.....kkkkkk.....', '....kttttttk....', '....ktmmmmtk....', '....kmkmmkmk....', '....kmmmmmmk....', '....kmmkkmmk....', '.....kmmmmk.....',
    '...kkkkkkkkkk...', '..kbbbbbbbbbbk..', '..kbbbbbbbbbbk..', '..kbbbbbbbbbbk..', '..kbbbbbbbbbbk..', '..kkkkkkkkkkkk..', '................', '................'],
  lock: [
    '................', '......kkkk......', '.....kSSSSk.....', '....kS....Sk....', '....kS....Sk....', '...kkkkkkkkkk...', '...kyyyyyyyyk...', '...kyyykkyyyk...',
    '...kyyykkyyyk...', '...kyyyykyyyk...', '...kyyyyyyyyk...', '...kkkkkkkkkk...', '................', '................', '................', '................'],
  camera: [
    '................', '................', '.....kkkk.......', '....kSSSSk......', '.kkkkkkkkkkkkkk.', 'kssssssssssskwsk', 'ksssskkkkkssssk.', 'kssskBbbbBksssk.',
    'ksskBbcbbbBkssk.', 'ksskBbbbbbBkssk.', 'ksskBbbbbbBkssk.', 'kssskBbbbBksssk.', 'ksssskkkkkssssk.', '.kkkkkkkkkkkkkk.', '................', '................'],
  rod: [
    '..............k.', '.............kSk', '............kSk.', '...........kTk..', '..........kTk...', '.........kTk....', '........kTk.....', '.......kTk......',
    '......kTk.......', '..kkkkTk........', '.kSSkTk.........', '.kSckk..........', '.kSSk...........', '..kk............', '................', '................'],
  map: [
    '................', '.kkkkk.kkkk.kkk.', 'kmmmmkkeeekkmmmk', 'kmgmmkeeeeekmmgk', 'kmggmkebbeekmggk', 'kmmgmkebbbekmgmk', 'kmmmmkeebbekmmmk', 'kmrmmkeeebekmmmk',
    'kmmmmkeeeeekmmmk', 'kmmgmkeeyeekmmgk', 'kmggmkeeeeekmggk', 'kmmmmkkeeekkmmmk', '.kkkkk.kkkk.kkk.', '................', '................', '................'],
  chat: [
    '................', '.kkkkkkkkkkkkkk.', 'kmmmmmmmmmmmmmmk', 'kmmmmmmmmmmmmmmk', 'kmmnnmmnnmmnnmmk', 'kmmnnmmnnmmnnmmk', 'kmmmmmmmmmmmmmmk', 'kcmmmmmmmmmmmmck',
    '.kkkkmmkkkkkkkk.', '....kmk.........', '....kk..........', '................', '................', '................', '................', '................'],
  home: [
    '................', '.......kk.......', '......kRRk......', '.....kRRRRk.....', '....kRRRRRRk....', '...kRRRRRRRRk...', '..kRRRRRRRRRRk..', '.kkkkkkkkkkkkkk.',
    '..kttttttttttk..', '..ktcctttkkttk..', '..ktcctttkTtk...', '..kttttttkTttk..', '..kttttttkTttk..', '..kkkkkkkkkkkk..', '................', '................'],
  scroll: [
    '................', '..kkkkkkkkkkk...', '.kmeeeeeeeeemk..', '.kkmmmmmmmmmkk..', '..kmnnnnnnnmk...', '..kmmmmmmmmmk...', '..kmnnnnnmmmk...', '..kmmmmmmmmmk...',
    '..kmnnnnnnnmk...', '..kmmmmmmmmmk...', '..kmnnnnmmmmk...', '..kmmmmmmmmmk...', '.kkmmmmmmmmmkk..', '.kmeeeeeeeeemk..', '..kkkkkkkkkkk...', '................'],
  worm: [
    '................', '................', '................', '..........kkk...', '.........kpppk..', '........kpPpk...', '.......kppk.....', '..kkk.kppk......',
    '.kpppkppk.......', 'kppPppppk.......', 'kpk.kppk........', '.k...kk.........', '................', '................', '................', '................'],
  flag: [
    '................', '..kk............', '..kSkkkkkkk.....', '..kSkrrrrrrkk...', '..kSkrrrrrrrrk..', '..kSkrrrrrrrrk..', '..kSkrrrrrrrk...', '..kSkkkkkkkk....',
    '..kSk...........', '..kSk...........', '..kSk...........', '..kSk...........', '..kSk...........', '.kkkkk..........', '................', '................'],
  fish: [
    '................', '................', '................', '................', '......kkkkkk....', '.k..kkbbbbbbkk..', '.kkkbbbbbbbbwkk.', '.kbbbbbbbbbbkbk.',
    '.kkkbbbbbbbbbbk.', '.k..kkcccccckk..', '......kkkkkk....', '................', '................', '................', '................', '................'],
};

// ---------------------------------------------------------------- the UI icon set
// One consistent set (Lucide line icons, 2px stroke, round caps) for every interface icon, drawn in
// currentColor so they take the colour of the text around them. Coins and pearls are the only filled,
// coloured icons: money should read at a glance. The pixel icons above stay available as pixelIcon().
import {
  ShoppingBasket, BookOpen, Store, Trophy, Settings, Smile, Sailboat, Star, Bell, User, Lock, LockOpen, Camera, FishingRod, Map as MapIcon,
  MessageCircle, House, ScrollText, Worm, Flag, Fish, Sun, Moon, Sunrise, Cloud, CloudRain, CloudLightning, X, Check, Play, Pause, Volume2,
  Monitor, Keyboard, Gamepad2, Eye, Info, ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, Search, ArrowUpDown, ListFilter, ZoomIn, ZoomOut,
  Compass, LogOut, Users, Sparkles, Flame, Gift, Mail, Newspaper, Crown, Medal, Target, Shuffle, Undo2, RotateCcw, RotateCw, Shirt, Link, Copy,
  Accessibility, SlidersHorizontal, MapPin, Plus, Minus, Package, Tent, PawPrint, Clock, Award, CircleHelp, Menu, Ellipsis, Navigation, Type, Music, Anchor,
  Dog, Gem, Waves, Tag, Archive, Leaf, Snowflake, Heart, FishingHook, Wrench, History, Bike, Backpack, ShieldCheck, Ban, Gavel, Hourglass, UserX, ScrollText as Rules, Shovel, Hand, PartyPopper, Meh, Bed, Citrus, ChevronUp, Bug, Download, Upload,
} from 'lucide';

const LINE = {
  download: Download, upload: Upload, // v1.14.6: save export / import
  creel: ShoppingBasket, book: BookOpen, shop: Store, trophy: Trophy, gear: Settings, smile: Smile, boat: Sailboat, star: Star, bell: Bell, user: User,
  lock: Lock, unlock: LockOpen, camera: Camera, rod: FishingRod, map: MapIcon, chat: MessageCircle, home: House, scroll: ScrollText, worm: Worm, flag: Flag,
  fish: Fish, sun: Sun, moon: Moon, dawn: Sunrise, cloud: Cloud, rain: CloudRain, storm: CloudLightning, close: X, check: Check, play: Play, pause: Pause,
  volume: Volume2, monitor: Monitor, keyboard: Keyboard, gamepad: Gamepad2, eye: Eye, info: Info, back: ArrowLeft, left: ChevronLeft, right: ChevronRight,
  down: ChevronDown, search: Search, sort: ArrowUpDown, filter: ListFilter, zoomIn: ZoomIn, zoomOut: ZoomOut, compass: Compass, exit: LogOut, users: Users,
  sparkles: Sparkles, flame: Flame, gift: Gift, mail: Mail, news: Newspaper, crown: Crown, medal: Medal, target: Target, shuffle: Shuffle, undo: Undo2,
  rotL: RotateCcw, rotR: RotateCw, shirt: Shirt, link: Link, copy: Copy, access: Accessibility, sliders: SlidersHorizontal, pin: MapPin, plus: Plus, minus: Minus,
  package: Package, tent: Tent, paw: PawPrint, clock: Clock, award: Award, help: CircleHelp, menu: Menu, more: Ellipsis, nav: Navigation, type: Type, music: Music,
  anchor: Anchor, gem: Gem, waves: Waves, tag: Tag, archive: Archive, leaf: Leaf, snow: Snowflake, heart: Heart, hook: FishingHook, wrench: Wrench, history: History,
  dog: Dog, bike: Bike, backpack: Backpack, shield: ShieldCheck, ban: Ban, gavel: Gavel, hourglass: Hourglass, userx: UserX, rules: Rules, shovel: Shovel, hand: Hand, party: PartyPopper, meh: Meh, bed: Bed, citrus: Citrus, up: ChevronUp, bug: Bug,
};

// Filled, coloured currency marks (24-unit grid like the rest).
const FILLED = {
  coin: '<circle cx="12" cy="12" r="10" fill="#E9B949" stroke="#9C6F1C" stroke-width="1.6"/><circle cx="12" cy="12" r="6.4" fill="none" stroke="#9C6F1C" stroke-width="1.4" opacity=".75"/><path d="M8.6 7.8a5 5 0 0 1 4.2-1.5" stroke="#FFF2C4" stroke-width="1.6" stroke-linecap="round" fill="none"/>',
  pearl: '<circle cx="12" cy="12.6" r="9.2" fill="#EAF0F6" stroke="#7D93A8" stroke-width="1.6"/><circle cx="9.2" cy="9.6" r="2.6" fill="#FFFFFF"/><path d="M15.5 17.6a6.4 6.4 0 0 0 3-4.2" stroke="#B7C7D8" stroke-width="1.6" stroke-linecap="round" fill="none"/>',
};

const NS = 'http://www.w3.org/2000/svg';
const attr = (a) => Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(' ');
function svgMarkup(name, color = 'currentColor') {
  if (FILLED[name]) return `<svg xmlns="${NS}" viewBox="0 0 24 24">${FILLED[name]}</svg>`;
  const nodes = LINE[name] || LINE.star;
  return `<svg xmlns="${NS}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${nodes.map(([tag, a]) => `<${tag} ${attr(a)}/>`).join('')}</svg>`;
}
export const hasIcon = (name) => !!(LINE[name] || FILLED[name]);

const cache = new Map();
/** A data URL for <img src> use (prices, small marks). Line icons are drawn in the given colour. */
export function iconURL(name, color = '#1E2A27') {
  if (!hasIcon(name)) return pixelIconURL(name);
  const key = `${name}@${color}`;
  if (!cache.has(key)) cache.set(key, `data:image/svg+xml;utf8,${encodeURIComponent(svgMarkup(name, color))}`);
  return cache.get(key);
}

/** An inline SVG icon that takes the surrounding text colour. */
export function icon(name, cls = 'ico') {
  if (!hasIcon(name)) return pixelIcon(name, cls);
  const wrap = document.createElement('span');
  wrap.innerHTML = svgMarkup(name);
  const svg = wrap.firstChild;
  svg.setAttribute('class', `${cls} ico-svg ico-${name}`);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  return svg;
}

// ---------------------------------------------------------------- the old pixel icons
const pcache = new Map();
export function pixelIconURL(name, scale = 2) {
  const key = `${name}@${scale}`;
  if (pcache.has(key)) return pcache.get(key);
  const rows = ICONS[name] || ICONS.star;
  const c = document.createElement('canvas');
  c.width = 16 * scale; c.height = 16 * scale;
  const x = c.getContext('2d');
  rows.forEach((row, y) => {
    for (let i = 0; i < 16; i++) {
      const ch = row[i];
      if (!ch || ch === '.') continue;
      x.fillStyle = PAL[ch] || '#f0f';
      x.fillRect(i * scale, y * scale, scale, scale);
    }
  });
  const url = c.toDataURL();
  pcache.set(key, url);
  return url;
}

export function pixelIcon(name, cls = 'ico') {
  const img = document.createElement('img');
  img.src = pixelIconURL(name);
  img.className = `${cls} ico-pixel`;
  img.alt = '';
  img.draggable = false;
  return img;
}

export const WEATHER_ICON = { clear: 'sun', overcast: 'cloud', rain: 'rain', storm: 'storm' };
export const PHASE_ICON = { dawn: 'dawn', day: 'sun', dusk: 'dawn', night: 'moon' };
