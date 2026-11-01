# Reel Time: developer setup

You only need this to work on the game itself. To **play** (or host your own lake), follow the guide in the README of
https://github.com/mebessusn/reel-time-game: no setup, no build.

## Run it locally (5 min)

You need Node.js 20 or newer (`node -v` to check).

```
npm install
npm run polyfork   # once: fetches the Polyfork models from polyfork.dev and builds the game's mesh data (they aren't kept here: see scripts/fetch-polyfork.mjs)
npm run dev
```

Open http://localhost:5173 and pick **Start fishing**. Outside a Claude artifact the game saves in your browser, and
two tabs on the same device share a lake (handy for trying multiplayer).

## Test it

```
npm test               # rules, fishing, features, moderation, parties (no browser)
npm run test:browser   # the browser suites: starts Vite, runs every suite, writes test-results/last-run.txt
```

## Build the game file

```
npm run build:artifact
```

That writes `dist-artifact/reel-time.html`, the single file you publish as a Claude artifact (see the README's "Make your
own lake" for the capabilities to declare). It embeds no binary files: meshes come from `art/src/*.py` (Blender, `pip
install bpy`) through `node scripts/glb-to-js.mjs`.

## The Claude Code plugin

`claude-plugin/` is the plugin. Test it with `claude plugin test claude-plugin`; validate with
`claude plugin validate claude-plugin`.
