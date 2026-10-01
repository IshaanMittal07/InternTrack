# Internship Tracker

A private notebook for an internship search. It tracks applications, postings you plan to
apply to, and companies you're interested in, along with the people you're networking with,
referrals and tags. It runs on a public URL (Vercel), but **only one email address can ever
sign in**, and all data is private to that account.

Built with Next.js (App Router, TypeScript strict), Supabase (Postgres + Auth), Tailwind CSS
and Zod. Tested with Vitest and Playwright. Everything runs on free tiers.

To deploy your own copy, follow **[DEPLOYMENT.md](DEPLOYMENT.md)**.

## Features

- **Three categories:** Applied, Planning, Interested, shown as tabs with count badges.
- **Summary strip:** total applied, interviews in progress, referrals received, follow-ups
  due this week, deadlines in the next 14 days, and a count per tag (click one to filter).
- **Cards** show company, role, stage, deadline, referral status, tags, and contact
  progress (e.g. "2 of 3 contacts spoken to").
- **Detail drawer** for each opportunity:
  - Edit every field.
  - **Contacts:** add, edit and delete people, with a one-click "spoken with" toggle,
    last-contacted and next follow-up dates.
  - **Referral:** status, plus which contact referred you.
  - **Tags:** searchable multi-select. Type a new name to create a tag on the spot.
  - **Move between categories:** moving to Applied asks for the date applied (default
    today) and sets the stage to Submitted. Moving out of Applied asks for confirmation and
    clears the date and stage.
- **Search, filter and sort:** search company or role; filter by stage, referral status,
  priority and tags (matches any selected tag); sort by deadline, date added or priority.
  All filters combine and live in the URL, so they survive a refresh.
- **Highlights:** deadlines within 7 days and overdue follow-ups.
- **Manage tags page:** rename, recolor and delete tags, with usage counts. Deleting a tag
  removes it from opportunities without deleting them.
- **CSV export:** one row per opportunity, tags comma-separated, contacts summarized.
  Values are safely escaped and spreadsheet formulas are neutralized.
- Every delete asks for confirmation. Every tab has a helpful empty state.
- Warm light and dark themes (dark follows your system setting), responsive down to phone
  width, keyboard accessible, and checked against WCAG 2.1 AA with automated axe scans.

## Security model

The goal: even though the site is public, nobody but you can sign in, read or change
anything. Several independent layers enforce this, so a mistake in one is caught by the next.

| Layer                               | What it does                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No public sign-ups**              | Sign-ups are disabled in Supabase. Your one account is created by hand in the dashboard.                                                                                                                                                                                                                                                                                                                                  |
| **Single-email lock at sign-in**    | The sign-in Server Action only sends a magic link if the email matches `ALLOWED_EMAIL` (trimmed, lowercased). It uses `shouldCreateUser: false`. Every email gets the same message ("If this email is allowed, a link has been sent") after the same minimum delay, so the page never reveals which address is allowed.                                                                                                   |
| **Magic links with PKCE**           | A link only works in the browser that requested it, so a forwarded or leaked email link is useless.                                                                                                                                                                                                                                                                                                                       |
| **Proxy (middleware)**              | `src/proxy.ts` runs on every request. Signed-out visitors are redirected to `/login` from every route except `/login`, the auth callback and static files. A valid session for any _other_ account is signed out immediately. (Next.js 16 renamed `middleware.ts` to `proxy.ts`.)                                                                                                                                         |
| **Every page and action re-checks** | All data access happens on the server. Every Server Component and Server Action calls `requireUser()` (verified session + allowlist) and validates input with Zod before touching the database. Queries are also scoped to your user id.                                                                                                                                                                                  |
| **Row Level Security in Postgres**  | RLS is on for every table, with separate select/insert/update/delete policies allowing only rows where `user_id = auth.uid()` **and** the signed-in email is on a database allowlist (`private.allowed_emails`, which the API can't reach). Child tables also verify that linked rows (opportunity, tag) belong to you, because Postgres checks foreign keys without RLS. The `anon` role has no privileges on any table. |
| **No service role key in the app**  | The app never uses the Supabase service role key, which would bypass RLS. It isn't configured in Vercel at all. It is only used locally by tests and the setup script.                                                                                                                                                                                                                                                    |
| **Security headers**                | A per-request nonce-based Content-Security-Policy (only scripts carrying that request's random nonce can run), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Robots-Tag: noindex, nofollow`, `Permissions-Policy` and HSTS.                                                                                                                          |
| **Not indexed**                     | `robots.txt` disallows all crawling, and pages carry `noindex` metadata.                                                                                                                                                                                                                                                                                                                                                  |

Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are public. The anon key
is designed to be public: on its own it can do nothing here, because sign-ups are off and
RLS blocks everything for the `anon` role.

## Running locally

**Requirements:** Node.js 20.9+, Docker Desktop (running).

```bash
npm install
cp .env.example .env.local        # then edit, see below
npm run db:start                  # starts local Supabase in Docker (first run downloads images)
npx supabase status               # prints the local URL and keys
```

Fill in `.env.local` from `supabase status`:

- `NEXT_PUBLIC_SUPABASE_URL`: `API URL` (usually `http://127.0.0.1:54321`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: `Publishable key` (or `anon key`)
- `SUPABASE_SERVICE_ROLE_KEY`: `Secret key` (or `service_role key`). Local only.
- `ALLOWED_EMAIL`: any address. The test suites expect `owner@test.local`.
- `APP_TIMEZONE`: e.g. `America/Toronto`

Then:

```bash
npm run local:setup   # creates your local account and adds it to the allowlist
npm run dev           # http://localhost:3000
```

Sign in with your `ALLOWED_EMAIL`. Locally no real email is sent: open **Mailpit** at
<http://127.0.0.1:54324> and click the link there, in the same browser.

`npm run db:start` applies everything in `supabase/migrations` and runs `supabase/seed.sql`.
`npm run db:reset` wipes the local database and re-applies them. After a reset, run
`npm run local:setup` again.

## Scripts

| Script                                      | What it does                                                                       |
| ------------------------------------------- | ---------------------------------------------------------------------------------- |
| `npm run dev`                               | Development server                                                                 |
| `npm run build` / `npm start`               | Production build / serve                                                           |
| `npm run lint`                              | ESLint, failing on any warning                                                     |
| `npm run typecheck`                         | Generates route types, then `tsc --noEmit`                                         |
| `npm test`                                  | Unit tests (no database needed)                                                    |
| `npm run test:integration`                  | RLS, schema, sign-in and service tests against local Supabase                      |
| `npm run test:e2e`                          | Playwright end-to-end and accessibility tests (production build, desktop + mobile) |
| `npm run test:all`                          | All three test suites                                                              |
| `npm run db:start` / `db:stop` / `db:reset` | Local Supabase                                                                     |
| `npm run db:types`                          | Regenerate `src/lib/supabase/database.types.ts` from the local schema              |
| `npm run local:setup`                       | Create and allowlist the local `ALLOWED_EMAIL` account                             |

Integration and e2e tests need local Supabase running and `ALLOWED_EMAIL=owner@test.local`.

## What the tests cover

- **Unit:** every Zod schema, date and highlight logic (including time zones), filters and
  sorting, summary numbers, CSV escaping and formula-injection neutralization, category
  moves, the CSP builder, design-token contrast (WCAG AA in both themes), and the sign-in
  lock.
- **Integration (real local Postgres):** two users plus an unlisted user prove that
  nobody else can read, insert, update or delete anything in any table, including linking
  their tag to your opportunity or your tag to theirs. Also: public sign-up is disabled;
  a non-allowed email gets no email and the same message; check constraints and triggers;
  tags (create, assign, filter, rename, recolor, delete, case-insensitive duplicates);
  Planning → Applied and Applied → Planning moves.
- **End-to-end (Playwright):** every page redirects to `/login` when signed out; the full
  signed-in flow (create, add contact, toggle spoken-with, add and create tags, filter by
  tag, move Planning → Applied); confirm dialogs; CSV download; Manage tags; security
  headers and nonce CSP with no console errors; axe accessibility scans in light and dark
  mode.

## Project structure

```
src/
  proxy.ts                  per-request CSP nonce, session refresh, auth gate, allowlist
  app/
    login/                  sign-in page + Server Action
    auth/callback, signout  magic-link landing, POST-only sign out
    (app)/                  signed-in pages: dashboard, /tags, /export (CSV)
  components/               ui/, opportunities/, contacts/, tags/, dashboard/
  lib/
    auth/                   allowlist check, requireUser()
    domain/                 pure logic: dates, filters, summary, category moves
    validation/             Zod schemas
    security/csp.ts         Content-Security-Policy builder
    supabase/               server + proxy clients, generated types
    csv.ts                  CSV export with formula-injection guard
  server/
    actions/                Server Actions (session check, then service)
    services/               Zod validation + database access, scoped to the user
supabase/
  migrations/               schema, RLS, grants, seed function
  config.toml               local Supabase (sign-ups disabled)
tests/
  unit/  integration/  e2e/
```
