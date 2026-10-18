---
description: Open Reel Time, the cozy fishing game, while Claude works
---

<!--
This file lists /fish in the slash menu. Where the plugin's hooks are running (Claude Code), its command.run hook
answers /fish itself with the lake set by /reel-time:lake, and this body is never sent. Where they aren't (the claude.ai
web app, or a chat's very first message before the hooks load), this body runs instead. It must never name one
particular lake: every player has their own.
-->

Open the user's own Reel Time lake. Every player has their own lake: a Reel Time artifact on their own Claude account.

1. If the user gave a link in this message (https://claude.ai/artifact/...), that is their lake.
2. Otherwise, if you have an Artifact tool, list the user's artifacts (action "list", scope "mine") and pick the one titled
   "Reel Time". If there are several, pick the most recently opened one.
3. If you found their lake and have an Artifact tool, open it (action "open", with its url). Do nothing else with it.
   Then reply with exactly one short line: "Gone fishin'. When Claude finishes, a golden fish bites and a bell rings."
4. If you found no lake, reply with exactly this and nothing else:
   "You don't have a Reel Time lake yet. Make one in about 5 minutes (any Claude plan): https://github.com/mebessusn/reel-time-game. Then run /fish again."
5. If you found a lake but have no Artifact tool, reply with one short line giving its link so they can open it.

Never open or link a lake that isn't the user's own.
