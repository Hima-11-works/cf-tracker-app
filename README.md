# Codeforces Probation Tracker

A Next.js app for a shared Codeforces probation sheet. The public pages show a leaderboard and an individual whitelisted user's problem statuses. Admin edits are protected by a password kept in the server environment.

## Run locally

1. Create the Supabase project and tables by following **Set up Supabase** below.
2. Install the app dependencies with `npm install`.
3. Copy `.env.example` to `.env.local` and fill in `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `ADMIN_PASSWORD`.
4. Start the app with `npm run dev`, then open `http://localhost:3000`.
5. Open `/admin`, sign in with `ADMIN_PASSWORD`, and enter the whitelist and probation sheet.

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

If the app is already connected to an existing database, run [`supabase/add_iot_lab_member.sql`](./supabase/add_iot_lab_member.sql) once in the SQL Editor before deploying this update. It adds the IoT Lab membership flag to the whitelist.

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
2. Add one Codeforces handle per line in **Whitelist**. Prefix IoT Lab members with `*` (for example, `*handle_name`) to show their leaderboard badge.
3. Paste each public Codeforces contest or problemset URL, such as `https://codeforces.com/contest/1915/problem/A`. The app looks up the problem name and rating; choose a section to group it on the sheet.
4. Choose **Save changes**. The sheet page groups problems by section, and the leaderboard includes active whitelist handles.

On `/leaderboard`, use **Exclude IoT Lab members** to hide marked handles from the standings.

Removing a handle from the active whitelist hides it from both public pages but preserves progress in the database. Removing a problem from the sheet deletes its progress rows for all handles, because the progress row belongs to that sheet problem.

## How status sync works

- Opening `/user` for a whitelisted handle reads its saved progress and the active problem sheet.
- Accepted problems are served from Supabase and are not checked against Codeforces again.
- For problems whose stored state is not accepted, the server requests up to the user's 10,000 most recent submissions from Codeforces. It maps `OK` to accepted, `WRONG_ANSWER` to wrong answer, and `TIME_LIMIT_EXCEEDED` or `MEMORY_LIMIT_EXCEEDED` to TLE / MLE. Other verdicts are ignored.
- A recognized result is upserted to `problem_progress`. The accepted date is the timestamp of the latest accepted submission found in that response.
- The leaderboard counts accepted sheet rows. It does not query Codeforces itself.

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
