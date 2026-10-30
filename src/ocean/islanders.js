// Open Waters v1.15.6: the islanders. Locals on every island, using the valley's locals system (game/npcs.js): they
// wave and say hello as you pass, cheer a great catch, answer your emotes, and wander or keep their post. A few have
// something to tell you (Talk to them): where the turtles go, how the grotto was found, what the beach games are.
// Built with the islands, the first time you go to sea.
import { ISLAND_BY_ID, DOCKS, PAD_BY_ID, ATOLL, oceanSurfaceY } from './geo.js';
import { SITES } from './islands.js';
import { defaultAvatar } from '../data/avatarOptions.js';
import { CRAB_TRACK } from './games/common.js';

const WATER_Y = 0.85;
const look = (gender, o) => ({ ...defaultAvatar(gender), ...o });
const LOOKS = {
  leilani: look('female', { skin: 5, hair: 'wavy', hairColor: 0, hat: 'flowercrown', shirt: 'tank', shirtColor: 6, pants: 'shorts', pantsColor: 7, shoes: 'sandals', accessory: 'lei', mouth: 'grin', eyes: 'happy' }),
  mo: look('male', { skin: 7, height: 'short', frame: 'broad', hair: 'bald', facialHair: 'beard', hairColor: 9, hat: 'hat_straw', shirt: 'tank', shirtColor: 2, pants: 'shorts', pantsColor: 3, shoes: 'sandals', mouth: 'smile', eyes: 'content' }),
  nani: look('female', { skin: 6, height: 'short', frame: 'slim', hair: 'puffs', hairColor: 1, hat: 'hat_pail', shirt: 'tee', shirtColor: 4, pants: 'shorts', pantsColor: 5, shoes: 'sandals', mouth: 'laugh', eyes: 'sparkle' }),
  ben: look('male', { skin: 1, hair: 'sidepart', hairColor: 3, hat: 'hat_visor_beach', shirt: 'hawaiian', shirtColor: 11, pants: 'shorts', pantsColor: 1, shoes: 'slipons', eyewear: 'bigsunnies', accessory: 'acc_camera', mouth: 'grin' }),
  ivy: look('female', { skin: 2, hair: 'long', hairColor: 4, hat: 'sunhat', shirt: 'sundress', shirtColor: 9, shoes: 'sandals', eyewear: 'cateye', mouth: 'smile' }),
  rua: look('male', { skin: 6, hair: 'locs', hairColor: 0, hat: 'bandana', shirt: 'tank', shirtColor: 13, pants: 'shorts', pantsColor: 6, shoes: 'sandals', facialHair: 'stubble' }),
  marina: look('female', { skin: 4, hair: 'ponytail', hairColor: 2, hat: 'boonie', shirt: 'polo', shirtColor: 5, pants: 'cargo', pantsColor: 4, shoes: 'hiking', eyewear: 'roundshades', accessory: 'satchel', eyes: 'focused' }),
  kalani: look('male', { skin: 5, frame: 'slim', hair: 'manbun', hairColor: 1, hat: 'none', shirt: 'stripes', shirtColor: 7, pants: 'shorts', pantsColor: 2, shoes: 'sandals', accessory: 'shells' }),
  sam: look('female', { skin: 3, hair: 'pixie', hairColor: 5, hat: 'hat_swimcap', shirt: 'tank', shirtColor: 3, pants: 'shorts', pantsColor: 7, shoes: 'sandals', eyewear: 'goggles', mouth: 'toothy' }),
  pete: look('male', { skin: 2, height: 'tall', frame: 'slim', hair: 'shag', hairColor: 8, facialHair: 'beard', hat: 'sailor', shirt: 'stripes', shirtColor: 0, pants: 'cargo', pantsColor: 2, shoes: 'boots', eyes: 'sleepy', mouth: 'smirk', brows: 'thick' }),
  // v1.15.16: Bob, who runs the crab races and can't stop betting on them. Clean-cut brown crop, a tidy polo gone
  // a little tired, a bum bag for the bet slips.
  bob: look('male', { skin: 1, hair: 'crop', hairColor: 2, facialHair: 'none', hat: 'none', shirt: 'polo', shirtColor: 13, pants: 'jeans', pantsColor: 1, shoes: 'slipons', accessory: 'fannypack', brows: 'worried', eyes: 'glance', mouth: 'wobbly' }),
  jun: look('male', { skin: 4, hair: 'undercut', hairColor: 1, hat: 'hat_bucket_tan', shirt: 'denim', shirtColor: 2, pants: 'cargo', pantsColor: 1, shoes: 'hiking', accessory: 'acc_backpack', eyes: 'focused' }),
};

/** Somewhere dry to stand near (x, z). */
function dryNear(x, z) {
  for (let r = 0; r < 10; r += 0.5) for (let a = 0; a < 12; a++) {
    const px = x + Math.cos(a / 12 * Math.PI * 2) * r, pz = z + Math.sin(a / 12 * Math.PI * 2) * r;
    if (oceanSurfaceY(px, pz) > WATER_Y + 0.35) return { x: px, z: pz };
  }
  return { x, z };
}
/** A spot on the beach looking out to sea along bearing a, with the bobber a few metres out. */
function beachSpot(I, a, e0 = 1.0) {
  let d = I.atoll ? I.r * (ATOLL.in + 0.2) : 0; // (an atoll: from the ring, not the motu in the middle)
  const ux = Math.cos(a), uz = Math.sin(a);
  while (d < 200 && oceanSurfaceY(I.x + ux * d, I.z + uz * d) > WATER_Y + 0.3) d += 0.5;
  d -= 1.2;
  const x = I.x + ux * d, z = I.z + uz * d;
  return { x, z, yaw: Math.atan2(ux, uz), bobber: { x: x + ux * 7 * e0, z: z + uz * 7 * e0 } };
}

export function islanderDefs() {
  const P = ISLAND_BY_ID.palm, T = ISLAND_BY_ID.turtle, S = ISLAND_BY_ID.smuggler;
  const DP = DOCKS.palm, DT = DOCKS.turtle, DS = DOCKS.smuggler;
  const court = PAD_BY_ID.court, defs = [];
  // ---- Palm Key
  { const p = dryNear(court.x + 9, court.z + 2); defs.push({ id: 'isle-leilani', name: 'Leilani', title: 'Beach games', look: LOOKS.leilani, kind: 'stand', x: p.x, z: p.z, yaw: Math.atan2(court.x - p.x, court.z - p.z), talk: 'leilani',
    hello: ['Aloha! Up for a game?', 'Sand\'s perfect today, {you}!', 'Grab your crew, we\'re short a team!', 'Mahalo for visiting!'] }); }
  { const x = DP.end.x - DP.ux * 1, z = DP.end.z - DP.uz * 1; defs.push({ id: 'isle-mo', name: 'Old Mo', title: 'Fishes the jetty', look: LOOKS.mo, kind: 'fisher', x: x - DP.side.x * 0.6, z: z - DP.side.z * 0.6, yaw: Math.atan2(-DP.side.x, -DP.side.z), bobber: { x: x - DP.side.x * 7, z: z - DP.side.z * 7 }, catch: ['snapper', 'bluetang', 'barracuda'], rod: 'rod_bamboo', talk: 'mo',
    hello: ['Snapper are thick under this jetty.', 'Mornin\', {you}. Pull up a plank.', 'Seventy years I\'ve fished here. Still learning.', 'Shh, something\'s nosing the bait.'] }); }
  { const v = SITES.palm.village; defs.push({ id: 'isle-nani', name: 'Nani', title: 'Village kid', look: LOOKS.nani, kind: 'roamer', x: v.x + 3, z: v.z + 2, roam: 14,
    hello: ['Hi! Wanna see my shell?', 'I found a crab! It pinched me!', 'Race you to the beach!', 'Are you a real sailor?'] }); }
  for (const [k, who] of [[0, 'ben'], [1, 'ivy']]) { const x = DP.x0 - DP.ux * 4 - DP.side.x * (9 + k * 6), z = DP.z0 - DP.uz * 4 - DP.side.z * (9 + k * 6); const p = dryNear(x, z);
    defs.push({ id: `isle-${who}`, name: who === 'ben' ? 'Ben' : 'Ivy', title: 'On holiday', look: LOOKS[who], kind: 'roamer', x: p.x, z: p.z, roam: 16,
      hello: who === 'ben' ? ['Say cheese! Ha, kidding.', 'Did you see the whale?!', 'Best holiday ever, {you}.'] : ['Isn\'t the water gorgeous?', 'I could stay here forever.', 'Have you tried Kai\'s grilled snapper?'] }); }
  { const s = beachSpot(P, Math.atan2(DP.uz, DP.ux) + Math.PI * 0.75); defs.push({ id: 'isle-rua', name: 'Rua', title: 'Local angler', look: LOOKS.rua, kind: 'fisher', ...s, catch: ['bonefish', 'snapper', 'barracuda'],
    hello: ['Bonefish on the flats at dawn, bro.', 'Hey {you}! Tide\'s turning.', 'Barracuda keep stealing my bait.'] }); }
  // v1.15.16: Bob oversees the crab races from the finish line (and asks everyone who passes for a few coins)
  { const T = PAD_BY_ID.crabs, p = dryNear(T.x + CRAB_TRACK / 2 + 1.2, T.z + 2.4); defs.push({ id: 'isle-bob', name: 'Bob', title: 'Runs the crab races', look: LOOKS.bob, kind: 'stand', x: p.x, z: p.z, yaw: Math.atan2(T.x - p.x, T.z - p.z), talk: 'bob',
    hello: ['Spare a few coins, {you}? I\'ve got a feeling about Purple.', 'I\'m due. I can feel it.', 'Just need a little stake to get back in.', 'Psst, {you}. Yellow\'s been training. Probably.', 'Ten coins. I\'ll pay you back. With interest. Maybe.'],
    mutter: ['Just one more race. Then I\'ll stop. Probably.', 'Purple\'s due. Purple has GOT to be due.', 'I had a system. Then the system had me.', 'Lost my boat on a crab named Gary once. Gary didn\'t even finish.', 'They say the house always wins. I AM the house. How am I losing?', 'Double or nothing. It\'s always nothing.', 'I can quit whenever I want. I just never want to.', 'Note to self: crabs cannot read the odds board.', 'Leilani took my bet slips away. I hid some in my shoe.', 'Ten on Red. No, Blue. No... can I bet on all of them?', 'I\'m not addicted. I\'m committed. Big difference.', 'Lucky shell, lucky polo, lucky socks. Why am I still losing?', 'Somewhere out there is a crab that believes in me.', 'Kai won\'t run me a tab any more. Fair, honestly.', 'I bet my sandals on Yellow once. Walked home on hot sand.', 'Maybe I should take up fishing instead. ...Ten coins says I don\'t.', 'Gambling problem? No. Gambling SOLUTION. It just hasn\'t worked yet.', 'If I win the next one, coconuts for everyone. On me. For real this time.', 'Hey {you}, you look lucky. Ever been lucky for someone else?', 'Every loss is just a win that hasn\'t happened yet.', 'I should go home. ...After this race. And the next one.', 'Mum always said I\'d go far. She meant further than the crab track.'] }); }
  // ---- Turtle Atoll
  { const t = SITES.turtle.tent, a = Math.atan2(T.x - t.x, T.z - t.z), p = dryNear(t.x + Math.sin(a) * 4.0, t.z + Math.cos(a) * 4.0); defs.push({ id: 'isle-marina', name: 'Dr. Marina Reyes', title: 'Marine biologist', look: LOOKS.marina, kind: 'stand', x: p.x, z: p.z, yaw: a, talk: 'marina',
    hello: ['Careful where you step: turtle nests!', 'Seven turtles counted today!', 'The rays came in on the tide.', 'Hello {you}! Science is happening!'] }); }
  { const s = beachSpot(T, Math.atan2(DT.uz, DT.ux) + 1.6); defs.push({ id: 'isle-kalani', name: 'Kalani', title: 'Bonefish guide', look: LOOKS.kalani, kind: 'fisher', ...s, catch: ['bonefish', 'bluetang', 'parrotfish'], talk: 'kalani',
    hello: ['Gray ghosts on the flats today.', 'Bonefish spook easy. Quiet steps, {you}.', 'Ever seen a tarpon jump? Wait till dusk.'] }); }
  { const p = SITES.turtle.ring[30] || SITES.turtle.ring[0]; defs.push({ id: 'isle-sam', name: 'Sam', title: 'Snorkeler', look: LOOKS.sam, kind: 'roamer', x: p.x, z: p.z, roam: 20,
    hello: ['The lagoon\'s like swimming in a fish tank!', 'Swim out to the motu, there\'s a hammock!', 'Saw an octopus! It waved. I think.'] }); }
  // ---- Smuggler's Rock
  { const L = SITES.smuggler.lookout, a = Math.atan2(S.x - L.x, S.z - L.z) + Math.PI, p = dryNear(L.x + Math.sin(a + 0.6) * 3.2, L.z + Math.cos(a + 0.6) * 3.2); defs.push({ id: 'isle-pete', name: 'Salty Pete', title: 'Keeps the lookout', look: LOOKS.pete, kind: 'stand', x: p.x, z: p.z, yaw: a, talk: 'pete',
    hello: ['Arr. You\'re no smuggler. Too clean.', 'See that arch? Don\'t swim through it. Heh.', 'Fine view from up here, eh?', 'Watch for sails, {you}.'] }); }
  { const x = DS.x0 - DS.ux * 4 + DS.side.x * 4.5, z = DS.z0 - DS.uz * 4 + DS.side.z * 4.5, p = dryNear(x, z); defs.push({ id: 'isle-jun', name: 'Jun', title: 'Treasure hunter', look: LOOKS.jun, kind: 'roamer', x: p.x, z: p.z, roam: 12, talk: 'jun',
    hello: ['Three weeks digging. One spoon.', 'If you find a map, I saw nothing.', 'Psst. The crates. Check the crates.'] }); }
  return defs;
}

/** What each islander says when you Talk to them: [text, more?]. */
export const TALKS = {
  leilani: ['Aloha! I run the beach games on Palm Key: volleyball on the court, crab races, coconut toss, sandcastles and cannonballs off the tower. Open a game at one of the boards and your crew gets an invite. Islanders fill any empty spots.', 'Win your first game of each and you take home something to wear. Prizes are bigger when your crew plays together than against us islanders.'],
  mo: ['Snapper and tangs come right up to the jetty posts. Cast along the jetty, not straight out, and keep your line out of the boat\'s way.', 'Barracuda will take anything shiny. Bring what you catch to Kai at the tiki bar: he grills it island-style, and reef fish keep you going longest.'],
  marina: ['I\'m counting turtles for the reef survey. They graze the sea grass in the lagoon. Wade in off the lagoon beach and swim: they don\'t mind company if you\'re gentle.', 'The eagle rays come in on the rising tide. And the motu in the middle has a hammock, if you swim out. Best nap on the ocean.'],
  kalani: ['Bonefish feed on the flats at dawn and dusk. They\'re fast and spooky: long casts, still water. Tarpon roll in the channels after dark.', 'Rough weather pushes the bait in close. Calm days, the big ones stay out on the reef edge.'],
  pete: ['The smugglers used this rock for forty years. Landed their goods round the far side, through the arch, into a cave nobody could see from the sea.', 'Folk still find their maps. In the crates by the jetty, or in a fish\'s belly if you fish close to the rock. Dig where the X says, and bring a shovel.'],
  bob: ['I run the crab races. Four crabs, four lanes, ten metres of sand. Back a crab at the board, then cheer on the beat and it scuttles faster. Crabs love the rain, too: wet days, they fly.', 'I\'d race them myself, but Leilani says I\'m banned from betting on my own track. And the other track. And the coconut toss. She\'s probably right. She\'s always right.'],
  jun: ['I\'ve dug half this island. Nothing! The old-timer at the lookout says the good stuff\'s in the grotto. Through the arch. Swim, if you\'ve got the lungs for it.', 'If you find a map, I\'ll trade you... a spoon. Very old spoon.'],
};

export class Islanders {
  constructor(game, ow) { this.game = game; this.ow = ow; this.list = []; this.built = false; }
  build() {
    if (this.built || !this.game.npcs) return;
    this.built = true;
    for (const def of islanderDefs()) { const n = this.game.npcs.add(def); if (n) this.list.push(n); }
  }
  /** The islander in front of you to Talk to (within 3 m). */
  contextActions() {
    const g = this.game, p = g.player.pos;
    let best = null, bd = 3.2;
    for (const n of this.list) { if (!n.talk || !n.actor.root.visible) continue; const d = Math.hypot(n.pos.x - p.x, n.pos.z - p.z); if (d < bd) { bd = d; best = n; } }
    if (!best) return [];
    return [{ id: `talk-${best.id}`, label: `Talk to ${best.name}`, color: 'green', at: { x: best.pos.x, z: best.pos.z, y: best.pos.y, h: 2.4 }, fn: () => this.talk(best) }];
  }
  talk(n) {
    if (n.talk === 'bob') return this.talkBob(n);
    const g = this.game, [a, b] = TALKS[n.talk] || ['Lovely day, isn\'t it?'];
    const bye = { label: 'Thanks!' };
    g.dialogue.open({ npc: n, title: n.title, text: a, choices: b ? [{ label: 'Tell me more', primary: true, fn: () => setTimeout(() => g.dialogue.open({ npc: n, title: n.title, text: b, choices: [bye] }), 200) }, bye] : [bye] });
    this.ow.quests?.progress?.('talk', { npc: n.id });
  }
  /** v1.15.16: Bob asks for a few coins, and what happens to them is anybody's guess. */
  talkBob(n) {
    const g = this.game, [a, b] = TALKS.bob, bye = { label: 'Not today, Bob' };
    const you = g.profile?.name || 'friend';
    const open = (text, choices) => setTimeout(() => g.dialogue.open({ npc: n, title: n.title, text: text.replaceAll('{you}', you), choices }), 200);
    const spare = { label: 'Spare 10 coins', primary: true, fn: async () => {
      const r = await g.save.spend('gift', 'bob', { coins: 10 });
      if (!r.ok) return open('Oh. You\'re skint too? Ha. Welcome to the club, friend.', [{ label: 'Bye, Bob' }]);
      const given = (g.ext.d.bobGiven || 0) + 1;
      g.ext.change((d) => { d.bobGiven = given; });
      g.audio.sfx('coin');
      const won = n.r() < 0.2;
      open(BOB_AFTER[won ? 'won' : 'lost'][Math.floor(n.r() * BOB_AFTER[won ? 'won' : 'lost'].length)] + (given === 5 ? ' You know, you\'re the only one who still stops to talk to me. Thanks, {you}. I mean it.' : ''), [{ label: 'Good luck, Bob' }]);
      this.game.npcs?.say?.(n, won ? 'WINNER! ...double or nothing?' : 'Next one. Definitely the next one.', performance.now());
    } };
    g.dialogue.open({ npc: n, title: n.title, text: a, choices: [spare, { label: 'Tell me more', fn: () => open(b, [spare, bye]) }, bye] });
    this.ow.quests?.progress?.('talk', { npc: n.id });
  }
}

/** What Bob says after you spare him a few coins: he bets it straight away. */
const BOB_AFTER = {
  lost: ['Bless you. Putting it all on Purple... aaand Purple stopped to eat a sandflea. Gone.', 'Yellow! Come on, Yellow! ...Yellow went sideways. Crabs. Always sideways.', 'Thanks, friend! Red was a lock. Red was a LOCK. Red fell asleep in lane two.', 'Blue had it, Blue had it right up until the finish. Then Blue turned round.'],
  won: ['Blue came in! BLUE CAME IN! I\'m rich! ...I already put it all on the next race.', 'I won! Thirty coins! Right, that\'s going straight back on Purple.'],
};
