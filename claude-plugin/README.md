# Reel Time

A cozy multiplayer fishing game that lives beside your chat in Claude. Fish, cook, decorate your cottage and hang out
with friends while Claude works. With the Claude Code plugin, a bell rings and a golden fish bites the moment your
answer is ready.

Reel Time is free. Everyone runs their **own lake**: a private copy of the game on their own Claude account, shared only
with the friends they invite. You're its owner and its admin.

## Make your own lake (5 minutes, works on any Claude plan)

1. **Download the game:** open [reel-time.html](https://github.com/mebessusn/reel-time-game/blob/main/release/reel-time.html)
   and click the **download** button (the arrow at the top right of the file). It's about 10 MB.
2. **Start a new chat at [claude.ai](https://claude.ai)**, attach `reel-time.html`, and send this message:

   ```
   Publish the attached reel-time.html exactly as it is, as a new artifact. Don't change or rewrite it. Declare these capabilities: db with rules [bans: read view, write admin] [staff: read view, write owner] [reports: read admin, write admin] [reports/{self}: read interact, write interact] [bugs: read admin, write admin] [bugs/{self}: read interact, write interact]; room; user with scopes ["profile"]; downloads.
   ```

3. **Open the artifact Claude made.** That's your lake. Make your angler and cast a line. Your progress saves to your
   lake automatically.

## Invite friends

1. In your lake, open Claude's **Share** menu.
2. Add each friend **by their Claude email** and set them to **Editor**. (Public links and the Viewer/Commenter levels
   don't let players save or play together. That's how Claude artifacts work, not a game setting.)
3. Send them the lake's link. Everyone you invite fishes in the same lake, sees each other, chats and visits cottages.

Editors can also publish new versions of your artifact in Claude, so only invite people you trust. Only you, the
owner, can add admins; use the in-game Admin panel to manage your lake.

## Update your lake

When a new version comes out, download the new `reel-time.html`, attach it in a Claude chat and send:

```
Update my Reel Time artifact (paste your lake's link here) with the attached reel-time.html, exactly as it is. Publish it to the same artifact so the link stays the same, and keep the capabilities it already has.
```

Everyone's progress stays, and everyone in your lake gets the new version at once.

## Golden fish: the Claude Code plugin (optional)

The plugin tells your lake when Claude is working and when it's done. A timer shows in the game, and when the
answer is ready a bell rings and your next cast hooks a golden fish. It needs Claude Code.

1. In Claude Code, run:

   ```
   /plugin install reel-time --marketplace mebessusn/reel-time-plugin
   ```

   Choose your **user** scope so it works in every session.
2. Point it at your lake (paste your lake's link):

   ```
   /reel-time:lake https://claude.ai/artifact/YOUR-LAKE-ID
   ```

3. Run `/fish` to open the game. That's it; it works in every session from now on.

`/reel-time:lake` on its own shows which lake the plugin uses; `/reel-time:lake reset` goes back to the default.

### Plugin settings (`/config`, then reel-time)

- **Signal the game** (on): tell the game when Claude starts and finishes.
- **Always on** (on): signal every session without running `/fish` first.
- **Ring a bell** (on) and **Ring after (seconds)** (15): the bell when a long turn finishes.

## Privacy

- Your lake lives on **your** Claude account. The game's maker can't see inside it, and nothing is sold or tracked.
- Each player's save is private to their own Claude account. Other players in the lake see your angler name, look,
  level and position, plus chat, mail and record catches.
- The plugin writes one small status note to your private save in your lake: "working" or "done", when it happened,
  how long the turn took and how many steps Claude took. It reads back one note: how many fish you caught while you
  waited. It **never** sends your prompts, Claude's answers, your files or anything else from your session, and it
  talks to nothing but your lake on claude.ai.
- Turn the plugin off with the **Signal the game** setting, or remove it with `/plugin uninstall reel-time`.

Full privacy notice: https://playreeltime.com/privacy. Questions about the game: meganbess+reeltime@mail.grokbot.com.

## Bugs and ideas

Open an issue: https://github.com/mebessusn/reel-time-plugin/issues

## License

Reel Time is © 2026 Megan Bess, released under the [PolyForm Noncommercial License 1.0.0](LICENSE): free to play,
share, study and modify for any noncommercial purpose. The source code is at
https://github.com/mebessusn/reel-time-game.

Reel Time is an independent game. It isn't made or endorsed by Anthropic.
