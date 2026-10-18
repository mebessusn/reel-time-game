---
description: Open Reel Time, the cozy fishing game, while Claude works
---

<!--
This file lists /fish in the slash menu before a session starts. Once the plugin's hooks are running, its command.run
hook answers /fish itself and this body is never sent. As a chat's very first message, /fish can arrive before the
hooks finish loading; then this body runs instead. The hooks still load right after, so the golden-fish signal works
for the rest of the chat.
-->

Open the Reel Time game for the user.

1. If you have an Artifact tool, open the artifact https://claude.ai/artifact/NeeNLcodQSp3x3RW7MTQn7 with it (action "open"). Do nothing else with it.
2. Reply with exactly one short line: "Gone fishin'. When Claude finishes, a golden fish bites and a bell rings." Do not add a link, a warning or anything else.
