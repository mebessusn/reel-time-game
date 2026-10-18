import { loadGear } from './entities/gearModels.js';
import { prewarmFishSkins } from './entities/softfish.js';
import './ui/style.css';
import { Game } from './game/game.js';
import { LocalSave, safe } from './save/local.js';
import { LocalNet, SupabaseNet, RoomNet, NullNet } from './net/net.js';
import { showSplash, showLoading } from './ui/login.js';
import { getSupabase, cloudConfigured, redirectUrl, displayNameFrom, providerLabel } from './net/backend.js';
import { randomAvatar } from './data/avatarOptions.js';
import { bindKeyboardMode } from './ui/nav.js';
import { openCountryPicker } from './ui/creator.js';

bindKeyboardMode();

// URL options (handy for testing): ?as=<slot> separate guest save, ?autoplay skip splash,
// ?avatar=random skip the creator, ?room=<name> private cove, ?src=claude opened by /fish, ?t= ?weather= debug sky.
const params = new URLSearchParams(location.search);
const stage = document.getElementById('stage');
const uiRoot = document.getElementById('ui');

function guestName() {
  const a = ['Sleepy', 'Cozy', 'Quiet', 'Lucky', 'Mossy', 'Misty', 'Sunny', 'Patient', 'Drifting', 'Humming'];
  const b = ['Heron', 'Otter', 'Trout', 'Frog', 'Duck', 'Loon', 'Minnow', 'Beaver', 'Pike', 'Newt'];
  return `${a[Math.floor(Math.random() * a.length)]} ${b[Math.floor(Math.random() * b.length)]}`;
}

async function boot() {
  const hideLoading = showLoading(uiRoot);
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))); // let the loading screen paint first
  hideLoading.step(0.2, 'Building the valley');
  await new Promise((r) => setTimeout(r, 30));
  await Promise.race([loadGear(), new Promise((r) => setTimeout(r, 4000))]); // detailed rods and lures
  const game = new Game({ stage, uiRoot });
  hideLoading.step(0.6, 'Lighting the lamps');
  await game.engine.precompile().catch(() => {}); // v1.13.19: no shader compiles later (dusk, new areas)
  hideLoading.step(0.75, 'Filling the lake');
  window.__game = game; // used by automated tests and handy for debugging
  game.backdrop();
  const sb = await getSupabase().catch(() => null);
  hideLoading.step(0.9, 'Checking in at the dock');
  let session = null;
  if (sb) {
    try { session = (await sb.auth.getSession()).data.session; } catch { session = null; }
  }
  hideLoading.step(1, 'Ready');
  await new Promise((r) => setTimeout(r, 120));
  hideLoading();

  const signIn = {
    async onGitHub() {
      const { error } = await sb.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: redirectUrl() + location.search } });
      if (error) throw error;
    },
    async onEmail(email) {
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectUrl() + location.search } });
      if (error) throw error;
      return 'Check your inbox for a sign-in link. You can play as a guest while you wait.';
    },
  };

  let save;
  const slot = params.get('as') || 'guest';
  if (sb && session) {
    const { CloudSave } = await import('./save/cloud.js');
    save = new CloudSave(sb, session);
    try {
      await save.init(displayNameFrom(session.user));
      // Offer to bring guest progress over once.
      const guest = safe.get(`rt_profile_${slot}`);
      if (save.isNew && guest && (guest.catchCount || 0) > 0 && !safe.get('rt_guest_imported')) {
        if (confirm(`Bring your guest progress (${guest.catchCount} catches, level ${guest.level}) to your account? This can only happen once.`)) {
          await save.importGuest(guest);
          safe.set('rt_guest_imported', true);
        }
      }
    } catch (e) {
      console.error(e);
      alert(`Could not reach the lake server (${e.message || e}). Playing as a guest for now.`);
      save = null;
    }
  }
  if (!save) {
    const seen = safe.get(`rt_profile_${slot}`);
    if (!params.has('autoplay') && (!seen || (sb && !safe.get('rt_seen_splash')))) {
      await showSplash(uiRoot, { cloud: !!sb, ...signIn });
      safe.set('rt_seen_splash', true);
    }
    save = new LocalSave(slot);
    let name = guestName();
    try { const me = await window.claude?.use?.('user').then((u) => u?.me()); if (me?.name) name = me.name.split(' ')[0].slice(0, 20); } catch { /* not in an artifact */ }
    await save.init(name);
  }

  // Online lake when Supabase is configured; inside a Claude artifact, the artifact's room; otherwise tabs on this device.
  // Interim transports. Multiplayer will move to the dedicated server: add it here as one more BaseNet (src/net/net.js).
  const makeNet = () => (sb ? new SupabaseNet(sb, params.get('room') || 'main') : window.claude?.use ? new RoomNet() : new LocalNet(params.get('room') || 'main'));
  let net = makeNet();
  game.makeNet = makeNet; // v1.13.7: switching back to multiplayer opens a fresh connection
  const auth = {
    available: !!sb,
    label: session ? providerLabel(session.user) : '',
    showSignIn: () => showSplash(uiRoot, { cloud: true, ...signIn, message: 'Your guest progress stays on this device; you can bring it over after signing in.' }),
  };
  game.save = save;
  game.net = net;
  game.supabase = sb || null;
  game.setAuth(auth);

  // The title screen (over the live lake) for everyone, then the creator for a brand-new angler.
  if (!params.has('autoplay')) await game.menus.title({ name: save.profile.name, first: !save.profile.avatar });
  // v1.13.7: single player fishes alone (no shared lake, no strangers); chosen on the title screen
  if (game.playMode === 'solo' && !params.has('room')) { game.net = new NullNet(); }
  if (!save.profile.avatar) {
    if (params.get('avatar') === 'random') await save.saveAvatar({ ...randomAvatar(), country: params.get('country') || 'XX' });
    else await game.openCreator(true);
  }
  // v1.9.3: everyone has a country now (their flag can fly over Frostpine)
  if (save.profile.avatar && !save.profile.avatar.country) {
    const code = params.has('autoplay') ? (params.get('country') || null) : await openCountryPicker(uiRoot, { audio: game.audio });
    if (code) await save.saveAvatar({ ...save.profile.avatar, country: code });
  }
  await game.start();
  prewarmFishSkins(null, { idle: true }); // v1.13.19: off the loading screen (it was half the wait); a fish still unpainted when first needed is painted then
}

boot().catch((e) => {
  console.error(e);
  uiRoot.innerHTML = `<div class="loading">Something went wrong loading the lake.<br><small>${String(e.message || e)}</small></div>`;
});

if (!cloudConfigured && import.meta.env.DEV) console.info('[reel-time] Supabase not configured: guest mode with local multiplayer between tabs.');
