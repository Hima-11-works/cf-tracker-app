# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Inferred and delegated: Next.js App Router with TypeScript and Supabase. Server routes keep the Supabase service key and admin password off the client.

## Users

Codeforces users in a probation program who want to see their standing and problem progress. An administrator maintains the eligible user list and probation sheet.

## Product Purpose

Track probation sheet progress from Codeforces submissions, show each eligible user's problem status and accepted date, and rank users by accepted problems.

## Positioning

One probation sheet connects Codeforces handles, submission verdicts, and a shared leaderboard.

## Operating Context

Users enter a Codeforces handle to view the sheet. The app checks Codeforces for sheet problems whose saved status is not accepted and stores the latest relevant result in Supabase. Accepted results stay cached. An administrator signs in with a password configured in the server environment and edits the whitelist and sheet.

## Capabilities and Constraints

- Required routes: `/leaderboard`, `/user`, and `/admin`.
- The whitelist determines who can view an individual sheet.
- Problem states are not attempted, accepted, time or memory limit exceeded, and wrong answer.
- The leaderboard ranks whitelisted handles by accepted problems.
- The app needs a Supabase project, server URL and service role key, and an admin password.
- Inferred implementation detail: each problem is identified by its Codeforces contest ID and index, and sheet sections are editable labels.
- Unspecified: public deployment target, branding, and whether the leaderboard should include display names.

## Evidence on Hand

No user list or problem data was supplied. The administrator will configure the initial whitelist and sheet; the app must not present invented results as real data.

## Product Principles

- Make each person's standing and next problem easy to find.
- Keep submission-derived results legible and consistent.
- Preserve accepted results to avoid unnecessary Codeforces requests.
- Keep secrets and database writes on the server.
