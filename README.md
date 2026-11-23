# Codeforces Probation Tracker

A Next.js app for a shared Codeforces probation sheet. The public pages show a leaderboard and an individual whitelisted user's problem statuses. Admin edits are protected by a password kept in the server environment.

## Run locally

1. Create the Supabase project and tables by following **Set up Supabase** below.
2. Install the app dependencies with `npm install`.
3. Copy `.env.example` to `.env.local` and fill in `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `ADMIN_PASSWORD`.
4. Start the app with `npm run dev`, then open `http://localhost:3000`.
5. Open `/admin`, sign in with `ADMIN_PASSWORD`, and enter the whitelist and probation sheet.

`next.config.ts` sends production builds to `.next-build` and keeps development in `.next`, so `npm run build` does not replace the files a running `npm run dev` is reading.

For an existing Supabase project that still uses the legacy `service_role` key, set `SUPABASE_SERVICE_ROLE_KEY` instead. The preferred current key is `SUPABASE_SECRET_KEY`. Keep either key server-only and out of source control.

## Set up Supabase

### 1. Create a project

1. Sign in to [Supabase](https://supabase.com/dashboard) and choose **New project**.
2. Select the organization, give the project a name, set a strong database password, and choose the region closest to the app's users.
3. Wait for the project to finish provisioning.

### 2. Create the tracker tables

1. Open the project in the Supabase Dashboard.
2. Open **SQL Editor** and create a new query.
3. Copy all of [`supabase/schema.sql`](./supabase/schema.sql) into the editor and run it.
4. Confirm the `whitelist`, `problems`, and `problem_progress` tables appear under **Table Editor**.

For an existing project, run [`supabase/add_iot_lab_member.sql`](./supabase/add_iot_lab_member.sql) first if it predates the IoT Lab update. Then run [`supabase/migrations/20261105_pagination.sql`](./supabase/migrations/20261105_pagination.sql), [`supabase/migrations/20261105_admin_idempotency.sql`](./supabase/migrations/20261105_admin_idempotency.sql), and [`supabase/migrations/20261119_dense_leaderboard_rank.sql`](./supabase/migrations/20261119_dense_leaderboard_rank.sql) once each in SQL Editor, in that order, before deploying this update. These add the leaderboard function/index and the protected request-key table used to make admin saves safe to retry. The last file replaces the leaderboard function so tied players share a rank. New projects get these through `supabase/schema.sql`.

The schema enables Row Level Security and creates no browser access policies. The app talks to Supabase only from its server routes, which authenticate admin edits before using the server secret key. Supabase documents secret keys as backend-only because they bypass Row Level Security; never put one in a `NEXT_PUBLIC_` variable or client code. See [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys) and [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).

### 3. Add the project URL and server key

1. In the Supabase Dashboard, open **Connect** to copy the project's URL. It looks like `https://your-project-ref.supabase.co`.
2. Open **Settings → API Keys** and create or copy a **secret key**. It starts with `sb_secret_`.
3. In the app root, copy `.env.example` to `.env.local` and set:

   ```dotenv
   SUPABASE_URL=https://your-project-ref.supabase.co
   SUPABASE_SECRET_KEY=sb_secret_your_key
   ADMIN_PASSWORD=use-a-long-unique-password
   ```

4. Restart `npm run dev` after changing environment values.

The app also accepts the legacy `service_role` JWT through `SUPABASE_SERVICE_ROLE_KEY` if the project has not moved to secret keys. Supabase is deprecating legacy `anon` and `service_role` keys at the end of 2026, so use a secret key for a new setup.

### 4. Add the roster and sheet

1. Open `http://localhost:3000/admin` and sign in using the `ADMIN_PASSWORD` value.
2. Add one Codeforces handle per line in **Whitelist**. Prefix IoT Lab members with `*` (for example, `*handle_name`) to show the IoT Lab logo beside their handle in the standings table.
3. Paste each public Codeforces contest or problemset URL, such as `https://codeforces.com/contest/1915/problem/A`. The app looks up the problem name and rating; choose a section to group it on the sheet.
4. Choose the save button in the admin toolbar. The sheet page groups problems by section, and the leaderboard includes active whitelist handles.

The sample in [`supabase/problem-sheet-snapshot.json`](./supabase/problem-sheet-snapshot.json) has 150 problems in 10 sections of 15. It records the sheet at one point in time; the code does not enforce those counts.

On `/leaderboard`, use **Exclude IoT Lab members** to hide marked handles from the standings. Press **Ctrl/⌘ K** to open the page and theme command menu; while signed into `/admin`, press **Ctrl/⌘ S** to save the current draft. On phones the main links move into a hamburger menu, and the command menu fills the screen.

Above the table, the top three places appear as a podium, 1st to 3rd from left to right. Each place shows a gold, silver, or bronze medal, the player's Codeforces avatar (larger for 1st), handle, rating in brackets, and solved count; tied players share a place. The toolbar's refresh icon reloads the standings. Podium avatars and ratings come from `/api/leaderboard/profiles`.

On `/user`, the summary shows the Codeforces avatar beside the handle and a relative **Last online** time under it, with the exact time in the tooltip. Two charts follow, a topic radar and a rating donut; on phones they swipe sideways. Each probation section is a bordered card with its own accepted count and progress bar.

On `/admin`, **Refresh solved counts** rechecks every active whitelist handle one at a time through `POST /api/admin/progress/refresh`, showing which handle is being checked and listing any that fail. Save and sign out are icon-only buttons in the toolbar.

Removing a handle from the active whitelist hides it from both public pages but preserves progress in the database. Removing a problem from the sheet deletes its progress rows for all handles, because the progress row belongs to that sheet problem.

## How status sync works

- Opening `/user` for a whitelisted handle reads its saved progress and the active problem sheet.
- Accepted problems are served from Supabase and are not checked against Codeforces again.
- For problems whose stored state is not accepted, the server requests up to the user's 10,000 most recent submissions from Codeforces. It maps `OK` to accepted, `WRONG_ANSWER` to wrong answer, and `TIME_LIMIT_EXCEEDED` or `MEMORY_LIMIT_EXCEEDED` to TLE / MLE. Other verdicts are ignored.
- A recognized result is upserted to `problem_progress`. The accepted date is the timestamp of the latest accepted submission found in that response.
- The `/user` route and the admin **Refresh solved counts** action share the same logic in [`lib/progress-sync.ts`](./lib/progress-sync.ts). `/user` calls `saveSubmissionProgress`; the admin refresh calls `refreshHandleProgress`, which saves through `saveSubmissionProgress`.
- The Codeforces profile data shown on `/user` (rating, rank, avatar, last online) and the podium's avatar and rating come from the `user.info` API and are cached in memory for 10 minutes in [`lib/codeforces.ts`](./lib/codeforces.ts).
- Codeforces requests are spaced about 2 seconds apart (`CODEFORCES_API_INTERVAL_MS`), so refreshing all handles takes time roughly proportional to the number of handles.
- The leaderboard counts accepted sheet rows; its standings request does not query Codeforces. The podium loads avatars and ratings separately from `/api/leaderboard/profiles`.

Codeforces defines the `user.status` API and the `Submission` object in its [API method reference](https://codeforces.com/apiHelp/methods) and [API object reference](https://codeforces.com/apiHelp/objects).

## Deploy to Vercel

This is a standard Next.js App Router project. Vercel detects Next.js automatically; keep the default framework build and output settings. The API routes run on the server and need access to Supabase and Codeforces.

1. Before pushing, run `npm run typecheck` and `npm run build` locally.
2. Push the project to GitHub, GitLab, or Bitbucket, then import that repository in Vercel. The app is at the repository root, so keep the Vercel **Root Directory** set to `.`.
3. In **Project Settings → Environment Variables**, add these server-only values to **Production**:

   ```dotenv
   SUPABASE_URL=https://your-project-ref.supabase.co
   SUPABASE_SECRET_KEY=sb_secret_your_key
   ADMIN_PASSWORD=use-a-long-unique-password
   ```

   Do not prefix these values with `NEXT_PUBLIC_`. Also set these variable names for **Preview** deployments, using a separate Supabase project and a separate admin password when possible so branch testing cannot alter production data. Vercel applies changed environment values to new deployments, so redeploy after changing them.
4. Deploy with Vercel's detected Next.js settings. Do not set a custom output directory or enable static export; the tracker needs server routes for Supabase and Codeforces requests.
5. Smoke-check the deployed `/leaderboard`, `/user`, and `/admin` routes. Sign into `/admin`, add a test handle and problem, confirm they appear on the public pages, then remove the test data.
6. Add a custom domain in Vercel when ready to share the tracker. Vercel provides HTTPS for project domains and custom domains.

Vercel's [Next.js deployment guide](https://vercel.com/docs/frameworks/full-stack/nextjs) covers framework detection and Preview URLs. See also [Vercel environment variables](https://vercel.com/docs/environment-variables) for environment scopes and redeployment behavior. The app requires outbound HTTPS access to `codeforces.com` and your Supabase project URL.
