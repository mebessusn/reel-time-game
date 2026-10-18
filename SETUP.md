# Reel Time: setup guide

About 20 minutes end to end. Steps 1–2 get you playing locally in guest mode; steps 3–7 put the lake online so anyone can sign in with GitHub or an email link and fish together.

Commands below run on your **Windows desktop in PowerShell**, from the project folder (`C:\Users\Megan\Documents\FishingGame`). They work the same on a Mac in Terminal.

---

## 1. Install and run locally (5 min)

You need Node.js 20 or newer (`node -v` to check; get it from nodejs.org if missing).

**Windows desktop (PowerShell)**
```
npm install
npm run dev
```

Open http://localhost:5173 and pick **Start fishing**. With no Supabase settings the game runs in guest mode: progress saves in the browser, and two tabs in the same browser share a lake (handy for trying multiplayer).

Useful URL options while testing: `?as=alice` (a separate guest save per name), `?t=0.9` (force night), `?weather=storm`, `?room=team` (a private cove).

## 2. Run the tests (optional, 2 min)

**Windows desktop (PowerShell)**
```
npm test
```

That runs the rules, reel-balance, database and cloud-save tests (the database tests run the real migration in an in-process Postgres). The browser playthrough test needs the dev server running in another window:

**Windows desktop (PowerShell, second window)**
```
npx playwright install chromium
npm run test:e2e
```

## 3. Create the Supabase project (5 min)

1. Go to https://supabase.com, sign in, and click **New project** (the free tier is plenty for a team).
2. When it's ready, open **SQL Editor → New query**, paste the whole of `supabase/migrations/0001_reel_time.sql`, and click **Run**.
3. New query again: paste `supabase/migrations/0002_seed.sql` and **Run**. (This loads the 32 species, items and achievements.)
4. Open **Project Settings → API** and note two values for step 5:
   - **Project URL**, e.g. `https://abcdefghijkl.supabase.co`
   - The **anon public** key (the long `eyJ...` string labelled `anon` `public`). Do **not** use the `service_role` key anywhere in the game: it bypasses all security.

## 4. Turn on sign-in (5 min)

**GitHub sign-in**

1. On GitHub: **Settings → Developer settings → OAuth Apps → New OAuth App**.
   - Application name: `Reel Time`
   - Homepage URL: your game URL from step 6 (you can use `http://localhost:5173` for now and change it later)
   - Authorization callback URL: `https://<your-project-ref>.supabase.co/auth/v1/callback` (your Project URL from step 3 plus `/auth/v1/callback`)
2. Click **Register application**, then **Generate a new client secret**.
3. In Supabase: **Authentication → Sign In / Providers → GitHub**, switch it on, paste the GitHub **Client ID** and **Client secret** (the raw values GitHub shows, no encoding), and save.

**Email links** are on by default in Supabase (**Authentication → Sign In / Providers → Email**). The built-in mailer only sends a few emails per hour; add your own SMTP under **Authentication → Emails** if lots of people will use email sign-in.

**Allowed URLs**: **Authentication → URL Configuration**
- Site URL: your game URL (step 6)
- Redirect URLs: add `http://localhost:5173` and your game URL

## 5. Point the game at Supabase (1 min)

Copy `.env.example` to `.env` and fill in the two values from step 3:

**Windows desktop (PowerShell)**
```
Copy-Item .env.example .env
notepad .env
```

```
VITE_SUPABASE_URL=https://abcdefghijkl.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...the anon public key...
```

Restart `npm run dev`. The splash now shows **Sign in with GitHub**, **Email me a sign-in link** and **Play as guest**. Guests still join the shared lake (they appear to others), but their progress stays on their device until they sign in; the first sign-in offers to bring guest progress over once (capped: up to level 10, 2,000 coins, 20 Pearls).

## 6. Put it on the web (5 min)

**Option A: GitHub Pages (included workflow)**

1. Move the workflow into place (it ships in `docs\` because Claude can't write into `.github` on your computer), then push this folder to a GitHub repository.

   **Windows desktop (PowerShell)**
   ```
   New-Item -ItemType Directory -Force .github\workflows | Out-Null
   Move-Item docs\github-pages-deploy.yml .github\workflows\deploy.yml
   ```

2. In the repo: **Settings → Secrets and variables → Actions → New repository secret**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` with the same values as your `.env`.
3. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Push to `main`. The workflow in `.github/workflows/deploy.yml` builds and publishes to `https://<you>.github.io/<repo>/`.
5. Add that URL to Supabase's Site URL / Redirect URLs (step 4) and to the GitHub OAuth app's Homepage URL.

**Option B: Cloudflare Pages / Netlify / Vercel**: build command `npm run build`, output folder `dist`, and the same two environment variables.

## 7. Add `/fish` to Claude (2 min)

The companion plugin lives in `claude-plugin/` and the repo root has `.claude-plugin/marketplace.json`, so the repository is its own marketplace.

In a Claude Code terminal session:
```
/plugin install reel-time --marketplace <your-github-user>/<repo>
```

Answer `y` to add the marketplace, pick the user scope, and set **Game URL** when asked (or later via `/config` → reel-time). Then type `/fish` while a prompt runs: you get a link to the lake, a small Reel Time pane, and a toast plus a bell when Claude finishes a turn that took 15 seconds or more. (The bell plays on macOS; on Windows you get the toast.)

## 8. Weekly crowns (optional)

To crown the week's Top Angler every Monday, enable the `pg_cron` extension (**Database → Extensions**), then run once in the SQL Editor:

```sql
select cron.schedule('reel-time-weekly', '5 4 * * 1', 'select public.close_week()');
```

---

### Troubleshooting

- **"Could not reach the lake server"**: check `.env` values and that both migrations ran.
- **GitHub sign-in loops back to the splash**: the callback URL in the GitHub OAuth app must be the Supabase `/auth/v1/callback` URL, and your game URL must be in Supabase's Redirect URLs.
- **"is not biting right now" errors**: the server checks time-of-day rules against its own clock; the `?t=` debug option only works in guest mode.
- **Other players don't appear**: Realtime must be enabled for the project (it is by default). Both players need the same `?room=` (or none).
