# Reel Time

A cozy multiplayer fishing game that lives beside your chat in Claude. Fish, cook, decorate your cottage and hang out
with friends while Claude works; with the Claude Code plugin, a golden fish bites the moment your answer is ready.

## Play it

You don't need to build anything. Everyone runs their own lake, a private copy of the game on their own Claude account:

1. Download [`release/reel-time.html`](release/reel-time.html) (open it, then use the download button at the top right).
2. Follow **[Make your own lake](https://github.com/mebessusn/reel-time-plugin#make-your-own-lake-5-minutes-works-on-any-claude-plan)**:
   attach it in a claude.ai chat, paste the publish message, invite friends by email as Editors.
3. Optional: the [Claude Code plugin](https://github.com/mebessusn/reel-time-plugin) for golden fish.

## Build it yourself

```
npm ci
npm run dev              # play at http://localhost:5173
npm test                 # unit tests
npm run build:artifact   # the single-file game: dist-artifact/reel-time.html
```

Meshes are built in Blender from `art/src/*.py` (`pip install bpy`, then `python3 art/src/<name>.py`) and turned into
plain JS modules with `node scripts/glb-to-js.mjs`, so the game file embeds no binary blobs.

## License

© 2026 Megan Bess. [PolyForm Noncommercial 1.0.0](LICENSE): free to play, share, study and modify for any
noncommercial purpose. Reel Time is an independent game; it isn't made or endorsed by Anthropic.

---

A cozy, multiplayer, Minecraft-style fishing game to play while Claude works. Cast a line on Cozy Cove lake beside other devs, row out in your boat, collect all 32 species (and their Gold and Diamond versions), trade prized fish for rod, lure and boat skins, and watch the great-catch feed roll by.

- **Play anywhere**: a static web app (Vite + Three.js). Guest mode works with no setup.
- **Online lake**: Supabase for GitHub / email sign-in, saves, leaderboards, the live feed and realtime multiplayer. Every balance change is validated by a server function.
- **In Claude**: the `reel-time` plugin adds `/fish`. While Claude works, the game shows a timer; when your turn is done, a bell rings and a golden "Claude's Catch" fish bites.

Setup: see [SETUP.md](SETUP.md). Design: see the Reel Time design document.

## What's in the box

| Area | Highlights |
| --- | --- |
| World | Voxel lake with six zones (Dock, Reed Shallows, Open Water, The Deep, Waterfall Pool, Sunken Ruins), cabin shop, lighthouse, campfire, fireflies |
| Time | Shared wall-clock day/night (24-minute days), moon phases, clear / overcast / rain / storm |
| Fishing | Power cast, nibble and bite, hook window, reeling mini-game (or Relaxed mode), 32 species x 6 tiers, Gold (1/40) and Diamond (1/250) variants, junk, treasure and 12 bottle messages |
| Progress | Levels 1-50, creel and storage, Fishpedia (96 slots), 40 achievements with rewards and titles |
| Economy | Coins from selling, Pearls from trading Diamond fish; rods, lures, boats, clothes and emotes with small perks |
| Social | Live presence, emotes, show-off, rafting up in boats, great-catch feed with reactions, weekly and all-time boards, lake records |
| Avatar | Gender, frame, height, 15 skin tones, 15 hair styles and 16 colors, eyes, brows, mouths, facial hair, glasses, hats, shirts, pants, shoes, accessories |
| Audio | All synthesized: effects, ambience that changes by place and time (loons on Frostpine, frogs in Lilymarsh, quarry drips), footsteps by surface, generative lo-fi music by time of day, optional sound captions |
| While you're away | Crab pots and set lines fill on the real clock; Claude Code tells the game when your answer is ready |
| Home | Your cabin (H) with an aquarium, decor and a trophy mount; visit friends who are on the lake |
| Progression | Bait that changes what bites, rod and boat upgrades, daily requests, a local's wish of the day, the Sunken Ruins story, one-of-a-kind fish with nicknames, lake collections with statues |
| Lake life | Hourly 10-minute derbies, the weekly Lantern Festival meter, player-written messages in bottles, meteor showers, fog nights and migration mornings, optional real-world weather |
| Comfort | Gus's guided first catch, waystone fast travel, controller support, rebindable keys, interface size, colour-blind markers, creel lock / sort / filter, a shared gear box |

## Project layout

```
src/            game client (data, world, entities, game loop, UI, audio, saves, networking)
supabase/       database migration (schema, row-level security, server functions) + generated seed
claude-plugin/  the /fish companion plugin
scripts/        gen-seed.mjs keeps the database seed in sync with src/data
tests/          rules, reel balance, SQL, cloud-save integration, browser playthrough
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server at http://localhost:5173 |
| `npm run build` | Static site in `dist/` |
| `npm run build:single` | One self-contained HTML file in `dist-single/` (guest mode) |
| `npm test` | Rules, balance, database and cloud tests |
| `npm run test:e2e` | Headless browser playthrough (dev server must be running) |
| `node scripts/gen-seed.mjs` | Regenerate `supabase/migrations/0002_seed.sql` after editing species, items or achievements |

## A note on trust

Catch rolls happen in the browser, so a determined player could fake catches. The server rejects impossible ones (unknown species, wrong zone or time, weight out of range, level gates, more than 6 catches a minute) and owns every coin, Pearl and purchase. That is plenty for a friendly lake.

## Claude plugin: /fish

Install the Reel Time plugin in Claude Code (terminal, desktop app or web):

```
/plugin marketplace add mebessusn/reel-time
/plugin install reel-time@reel-time
```

Then type `/fish`. In the Claude app the lake opens in the tab beside the chat; in a terminal you get a link. When Claude finishes a long turn, a bell rings and a golden fish bites in the game.
