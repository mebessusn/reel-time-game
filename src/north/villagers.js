// Frostmere: the people of Hearthwick, using the valley's locals system (game/npcs.js) like the Open Waters islanders:
// they wave and say hello, cheer a great catch, answer emotes and keep their post or wander. The named folk each have
// something to tell you (Talk to them); their shops, quests and games hook in through `Frostmere` (src/north/*.js).
// Northern clothes: knitted sweaters, parkas, trapper and bobble hats, scarves and boots.
import { addSolidFn, blocked } from '../world/colliders.js';
import { defaultAvatar } from '../data/avatarOptions.js';
import { toWorld, ICE_Y } from './geo.js';
import { BUILDINGS, KENNELS, RINK, GREEN, NPC_HOLE_UV } from './hearthwick.js';

const look = (gender, o) => ({ ...defaultAvatar(gender), ...o });
export const LOOKS = {
  astrid: look('female', { skin: 1, height: 'tall', frame: 'broad', hair: 'braids', hairColor: 6, hat: 'beanie', shirt: 'sweater', shirtColor: 0, pants: 'jeans', pantsColor: 1, shoes: 'boots', accessory: 'acc_scarf', mouth: 'smile', brows: 'arched', eyes: 'focused' }),
  torvald: look('male', { skin: 0, height: 'short', frame: 'broad', hair: 'bald', facialHair: 'beard', hairColor: 9, hat: 'trapper', shirt: 'flannel', shirtColor: 0, pants: 'overalls', pantsColor: 1, shoes: 'boots', mouth: 'smirk', eyes: 'sleepy', brows: 'thick' }),
  june: look('female', { skin: 7, frame: 'slim', hair: 'puffs', hairColor: 0, hat: 'beanie', shirt: 'puffer', shirtColor: 5, pants: 'cargo', pantsColor: 1, shoes: 'boots', eyewear: 'goggles', mouth: 'grin', eyes: 'focused' }),
  pell: look('male', { skin: 3, frame: 'broad', hair: 'sidepart', hairColor: 2, facialHair: 'moustache', hat: 'newsboy', shirt: 'cardigan', shirtColor: 4, pants: 'jeans', pantsColor: 2, shoes: 'boots', eyewear: 'roundshades', mouth: 'grin', eyes: 'happy' }),
  elsi: look('female', { skin: 0, height: 'short', frame: 'average', hair: 'buns', hairColor: 9, hat: 'none', shirt: 'cardigan', shirtColor: 9, pants: 'jeans', pantsColor: 0, shoes: 'boots', eyewear: 'roundshades', accessory: 'acc_scarf', mouth: 'smile', eyes: 'content' }),
  mira: look('female', { skin: 4, frame: 'slim', hair: 'ponytail', hairColor: 4, hat: 'beanie', shirt: 'overalls', shirtColor: 2, pants: 'cargo', pantsColor: 3, shoes: 'boots', eyewear: 'goggles', mouth: 'smile', eyes: 'focused' }),
  kit: look('female', { skin: 2, height: 'short', frame: 'slim', hair: 'pigtails', hairColor: 5, hat: 'beanie', shirt: 'puffer', shirtColor: 3, pants: 'jeans', pantsColor: 0, shoes: 'boots', accessory: 'acc_scarf', mouth: 'laugh', eyes: 'sparkle' }),
  bo: look('male', { skin: 6, height: 'short', frame: 'slim', hair: 'beaniehair', hairColor: 1, hat: 'trapper', shirt: 'puffer', shirtColor: 7, pants: 'cargo', pantsColor: 2, shoes: 'boots', mouth: 'toothy', eyes: 'sparkle' }),
  ansel: look('male', { skin: 2, height: 'tall', frame: 'slim', hair: 'shag', hairColor: 9, facialHair: 'beard', hat: 'trapper', shirt: 'flannel', shirtColor: 6, pants: 'cargo', pantsColor: 4, shoes: 'boots', mouth: 'smirk', eyes: 'glance', brows: 'thick' }),
  ingrid: look('female', { skin: 1, hair: 'pixie', hairColor: 3, hat: 'beanie', shirt: 'puffer', shirtColor: 1, pants: 'cargo', pantsColor: 1, shoes: 'hiking', eyewear: 'roundshades', accessory: 'satchel', mouth: 'smile', eyes: 'focused' }),
};
const WALKER_HATS = ['beanie', 'trapper', 'beanie', 'newsboy', 'none'], WALKER_SHIRTS = ['sweater', 'puffer', 'flannel', 'cardigan', 'puffer', 'raincoat'];

const B = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));
/** A point in front of building `id`, `d` metres out from its front, `side` metres along it (world coords). */
function front(id, d, side = 0) {
  const b = B[id], fz = b.hd + d, s = Math.sin(b.ry), c = Math.cos(b.ry), w = toWorld(b.u, b.v);
  return { x: w.x + side * c + fz * s, z: w.z - side * s + fz * c, yaw: b.ry };
}

/** The ice fishers' holes (the shanty town's regulars): hole centres, for the ice to cut and the bobbers to sit in. */
export const NPC_HOLES = NPC_HOLE_UV.map((h) => ({ ...toWorld(h.u, h.v), r: 0.42, npc: true }));

export function villagerDefs() {
  const defs = [], L = LOOKS;
  { const p = front('lodge', 3.2, -2.5); defs.push({ id: 'fm-astrid', name: 'Astrid Lund', title: 'Keeps the Hearth Lodge', look: L.astrid, kind: 'stand', ...p, talk: 'astrid',
    hello: ['Boots off at the door, {you}!', 'Fire\'s lit. Come and thaw.', 'Don\'t stand still on thin ice. I mean it.', 'Hot soup in the lodge at sundown.'] }); }
  { const h = NPC_HOLES[0]; defs.push({ id: 'fm-torvald', name: 'Old Torvald', title: 'Sixty winters on the ice', look: L.torvald, kind: 'fisher', x: h.x - 1.3, z: h.z + 0.6, yaw: 0, bobber: { x: h.x, z: h.z }, catch: ['laketrout', 'cisco', 'roundwhitefish'], rod: 'rod_bamboo', talk: 'torvald',
    hello: ['The ice talks, {you}. Listen.', 'A patient hole feeds a hungry man.', 'Mornin\'. Fish are deep today.', 'Thick ice, thin wallet. Thin ice, fat fish.'] }); }
  { const K = KENNELS, w = toWorld(K.u, K.v - K.d - 2); defs.push({ id: 'fm-june', name: 'June Okafor', title: 'Musher', look: L.june, kind: 'stand', x: w.x + 2, z: w.z, yaw: Math.PI, talk: 'june',
    hello: ['The dogs want to run, {you}!', 'Hike! ...sorry, habit.', 'Sled Derby\'s open whenever you are.', 'Scratch Pepper behind the ears, she\'s earned it.'] }); }
  { const p = front('trading', 1.0, 1.6); defs.push({ id: 'fm-pell', name: 'Pell', title: 'Trading post', look: L.pell, kind: 'stand', ...p, talk: 'pell',
    hello: ['Augers, jig rods, the finest mittens, {you}!', 'Heard the latest? Come in, come in.', 'Cold enough for you? Got parkas!', 'Somebody saw a bear by the Point. Again!'] }); }
  { const p = front('smokehouse', 1.5, 0); defs.push({ id: 'fm-elsi', name: 'Grandma Elsi', title: 'The smokehouse', look: L.elsi, kind: 'stand', ...p, talk: 'elsi',
    hello: ['Cocoa\'s hot, dear.', 'You look frozen, {you}. Come here.', 'Bring me a fish and I\'ll smoke it proper.', 'Did I ever tell you about the Valiant?'] }); }
  { const p = front('carving', 1.2, 0); defs.push({ id: 'fm-mira', name: 'Mira', title: 'Carver', look: L.mira, kind: 'stand', ...p, talk: 'mira', idlePose: 'reel',
    hello: ['Mind the sculptures, they\'re still setting!', 'This week: a bear. Next week: who knows.', 'Bring me something rare, {you}. I\'ll carve it.'] }); }
  { const w = toWorld(RINK.u - 4, RINK.v + 2); defs.push({ id: 'fm-kit', name: 'Kit', title: 'Village kid', look: L.kit, kind: 'roamer', x: w.x, z: w.z, roam: 18, talk: 'kit',
    hello: ['Snowball fight! You\'re it!', 'Bet you can\'t skate backwards.', 'Bo fell in the plunge hole. Again.', 'Race you to the rink!'] }); }
  { const w = toWorld(RINK.u + 5, RINK.v - 1); defs.push({ id: 'fm-bo', name: 'Bo', title: 'Village kid', look: L.bo, kind: 'roamer', x: w.x, z: w.z, roam: 18, talk: 'bo',
    hello: ['I dare you to skate the thin ice!', 'Kit cheats at snowballs.', 'Have you seen Old Whitepaw? I have. Probably.', 'My hands are frozen. Worth it!'] }); }
  { const w = toWorld(-252, 240); defs.push({ id: 'fm-ansel', name: 'Old Ansel', title: 'Trapper', look: L.ansel, kind: 'stand', x: w.x, z: w.z, yaw: Math.PI * 0.75, talk: 'ansel',
    hello: ['Quiet out here. How I like it.', 'Saw the stag tracks again. Don\'t follow them.', 'Mind the wolves. Ha. No wolves. Just me.'] }); }
  { const w = toWorld(296, -168); defs.push({ id: 'fm-ingrid', name: 'Dr. Ingrid Vale', title: 'Skyward Station', look: L.ingrid, kind: 'stand', x: w.x, z: w.z, yaw: Math.PI, talk: 'ingrid',
    hello: ['Kp index is rising, {you}. Lights tonight!', 'Bear 14 was by the Point this morning.', 'Data, data, data. Hello!', 'Shh, I\'m counting something.'] }); }
  // the shanty town's other regulars, fishing their holes
  const fishers = [['Sigrid', 'female'], ['Hal', 'male'], ['Nils', 'male']];
  fishers.forEach(([name, gender], i) => {
    const h = NPC_HOLES[i + 1], a = i * 2.1 + 0.6;
    defs.push({ id: `fm-fisher${i}`, name, title: 'Ice angler', look: walkerLook(gender, i + 3), kind: 'fisher', x: h.x + Math.sin(a) * 1.3, z: h.z + Math.cos(a) * 1.3, bobber: { x: h.x, z: h.z }, catch: ['cisco', 'stickleback', 'roundwhitefish'],
      hello: ['Flag up somewhere? No? Me neither.', 'Cisco are schooling deep.', 'Morning, {you}. Coffee\'s in the thermos.', 'Thirty below and I\'m happy as a clam.'] });
  });
  // walkers about the village and out to the shanties
  const walkers = [['Ola', 'male', GREEN.u - 6, GREEN.v + 4], ['Freya', 'female', GREEN.u + 10, GREEN.v + 8], ['Bjorn', 'male', 60, 120], ['Liv', 'female', 40, 168], ['Rasmus', 'male', 96, 170], ['Tove', 'female', 80, 104]];
  walkers.forEach(([name, gender, u, v], i) => {
    const w = toWorld(u, v);
    defs.push({ id: `fm-walker${i}`, name, title: 'Hearthwick local', look: walkerLook(gender, i), kind: 'roamer', x: w.x, z: w.z, roam: 30,
      hello: ['Cold one today!', 'Hej {you}!', 'Smell that? Elsi\'s smoking char.', 'Lights were dancing last night.', 'Mind your step on the bay ice.', 'Have you tried the sauna yet?'] });
  });
  return defs;
}
function walkerLook(gender, i) {
  return look(gender, { skin: (i * 3 + 1) % 8, hair: gender === 'female' ? ['long', 'braids', 'buns', 'ponytail'][i % 4] : ['crop', 'shag', 'sidepart', 'beaniehair'][i % 4], hairColor: (i * 5) % 10,
    facialHair: gender === 'male' && i % 2 ? 'beard' : 'none', hat: WALKER_HATS[i % WALKER_HATS.length], shirt: WALKER_SHIRTS[i % WALKER_SHIRTS.length], shirtColor: (i * 7) % 14,
    pants: i % 2 ? 'jeans' : 'cargo', pantsColor: i % 5, shoes: 'boots', accessory: i % 3 === 0 ? 'acc_scarf' : 'none' });
}

/** What each of them tells you (Talk): [text, more?]. Their shops and quests add choices (src/north/frostmere.js). */
export const TALKS = {
  astrid: ['Welcome to Hearthwick! I keep the Hearth Lodge: beds upstairs, the big fire, the trophy wall and the notice board. And the sauna down by the shore, when you\'re chilled through.', 'Rule one up here: thin ice is grey-blue and cracked. If it creaks, keep moving. If you go through, I\'ll fish you out, but you\'ll be soaked and freezing till you get by a fire.'],
  torvald: ['Sixty winters I\'ve fished this ice. Drill your hole, drop your jig, and watch the flasher: the marks are fish. Jig them up slow. Too fast and they spook.', 'The big lake trout lie deep, under the pressure ridge, where the ice is bad. And the Glacier King... well. He comes up in a snowstorm, they say. I\'ve only seen him once.'],
  june: ['Eight dogs, one sled, and the whole north to run! The sled trail loops out over the tundra. Beat my time in the Sled Derby and I\'ll owe you a bib.', 'Pepper leads. Juniper and Moss are the wheel dogs. The rest are trouble. Bring them a fish now and then and they\'ll love you forever.'],
  pell: ['Pell\'s Trading Post! Hand augers, jig rods, tip-ups, ice cleats, the warmest parkas north of anywhere. If I don\'t have it, you don\'t need it.', 'Rumour is there\'s something in the deep basin. A shadow under the black ice. Big as a boat! Don\'t quote me. Do quote me.'],
  elsi: ['Bring me a fish, dear, and I\'ll smoke it for you. Smoked fish keeps you warm out there. And the cocoa\'s always hot.', 'My grandmother came on the Valiant, you know. The schooner frozen in the ice up the coast. Her captain\'s log is scattered all over these parts, page by page.'],
  mira: ['I carve wood in summer and ice in winter. That bear out front took me a week. Next week? Maybe a narwhal.', 'If you ever catch something truly rare, show me. I\'ll carve it in ice for the green, with your name on it.'],
  kit: ['I\'m Kit! That\'s Bo. He\'s my brother but he says he\'s adopted. We know every inch of this ice!', 'Snowball fight, first to five! Or race us down the Long Glide. Bo always loses.'],
  bo: ['I\'m Bo. I\'ve seen Old Whitepaw, the giant bear, on the Point when the lights were out. Kit says I made it up.', 'Dare you to skate the thin ice by the ridge! ...Don\'t actually. Astrid gets SO mad.'],
  ansel: ['Out here it\'s me, the spruce and the caribou. And the stag. A white stag, antlers like the lights. Only at dusk, only in snow.', 'Get close and he\'s gone. Swirl of snow, that\'s all. I\'ve been trying to sketch him thirty years.'],
  ingrid: ['Dr. Ingrid Vale, Skyward Station. I study two things: the polar bears on the coast and the aurora overhead. Both are shy, and both are beautiful.', 'If you see a big bear with a silver coat on an aurora night, photograph him. We call him Old Whitepaw. He\'s older than my records.'],
};

export class Villagers {
  constructor(game, north) { this.game = game; this.north = north; this.list = []; this.built = false; }
  build() {
    if (this.built || !this.game.npcs) return;
    this.built = true;
    for (const def of villagerDefs()) {
      // v1.17.1: a fisher stands where there's room by the hole (never in a shanty's wall); faces the hole
      if (def.kind === 'fisher' && def.bobber && blocked(def.x, def.z, 0.35, 'shore')) {
        const b = def.bobber, a0 = Math.atan2(def.x - b.x, def.z - b.z);
        for (let k = 1; k < 24; k++) { const a = a0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 12), x = b.x + Math.sin(a) * 1.3, z = b.z + Math.cos(a) * 1.3; if (!blocked(x, z, 0.35, 'shore')) { def.x = x; def.z = z; break; } }
      }
      if (def.kind === 'fisher' && def.bobber) def.yaw = Math.atan2(def.bobber.x - def.x, def.bobber.z - def.z);
      const n = this.game.npcs.add(def); if (n) { n.north = true; this.list.push(n); } }
    // v1.16.2: the people of Hearthwick are solid (you walk round them, not through them)
    addSolidFn((x, z, r) => { if (r > 0.4) return false; // (walkers only: a dog team runs past, it doesn't get stuck on June)
      for (const n of this.list) { if (!n.actor.root.visible) continue; const dx = x - n.pos.x, dz = z - n.pos.z, rr = r + 0.3; if (dx * dx + dz * dz < rr * rr) return true; } return false; });
  }
  byId(id) { return this.list.find((n) => n.id === id || n.talk === id); }
  contextActions() {
    const g = this.game, p = g.player.pos;
    let best = null, bd = 3.2;
    for (const n of this.list) { if (!n.talk || !n.actor.root.visible) continue; const d = Math.hypot(n.pos.x - p.x, n.pos.z - p.z); if (d < bd) { bd = d; best = n; } }
    if (!best) return [];
    return [{ id: `talk-${best.id}`, label: `Talk to ${best.name}`, color: 'green', at: { x: best.pos.x, z: best.pos.z, y: best.pos.y, h: 2.4 }, fn: () => this.talk(best) }];
  }
  /** Talk: the person's own lines, plus whatever their shop or quest adds (north.talkChoices). */
  talk(n) {
    const g = this.game, [a, b] = TALKS[n.talk] || ['Cold one, isn\'t it?'];
    const bye = { label: 'Thanks!' };
    const extra = this.north.talkChoices?.(n) || [];
    const more = b ? [{ label: 'Tell me more', fn: () => setTimeout(() => g.dialogue.open({ npc: n, title: n.title, text: b, choices: [...extra, bye] }), 200) }] : [];
    g.dialogue.open({ npc: n, title: n.title, text: a, choices: [...extra, ...more, bye] });
    this.north.onTalk?.(n);
  }
}
export { ICE_Y };
