# Deployment

This puts the tracker on a public Vercel URL backed by a free Supabase project. Anyone can
sign up; each account only ever sees its own data. It takes about 15 minutes. Everything here is free (Supabase Free,
Vercel Hobby).

Throughout, replace:

- `you@example.com` with **your** email address
- `your-app.vercel.app` with your actual Vercel domain (you'll get it in step 3)

---

## 1. Create the Supabase project and apply the migrations

1. Go to <https://supabase.com/dashboard> and sign in. Click **New project**.
2. Choose a name (e.g. `internship-tracker`), set a strong **database password** (save it in
   your password manager), pick the region closest to you, and click **Create new project**.
   Wait for it to finish provisioning.
3. Find your **project ref**. It's the part of the dashboard URL after `/project/`, e.g.
   `https://supabase.com/dashboard/project/abcdefghijklmnop` → `abcdefghijklmnop`.
4. In this repo on your computer, link the project and push the migrations:

   ```bash
   npx supabase login                          # opens the browser once
   npx supabase link --project-ref abcdefghijklmnop   # asks for the database password
   npx supabase db push                        # applies everything in supabase/migrations
   ```

   `db push` lists the migrations and asks to confirm. Answer `Y`.

   _Alternative without the CLI:_ open **SQL Editor** in the dashboard and run each file in
   `supabase/migrations/` in filename order (paste the contents, click **Run**).

   Do **not** run `supabase/seed.sql` in production. It is for local development only.

## 2. Configure authentication

All of these are in the Supabase dashboard under **Authentication**.

1. **Allow sign-ups.** Open **Sign In / Providers** (called **Providers** or **Settings** in
   some dashboard versions):
   - Turn **on** "Allow new users to sign up" and click **Save**.
   - Make sure the **Email** provider is **enabled** (magic links need it).
2. **Configure URLs.** Open **URL Configuration**:
   - **Site URL:** `https://your-app.vercel.app` (until you have it, put
     `http://localhost:3000` and come back after step 3).
   - **Redirect URLs:** add both of these:
     - `http://localhost:3000/auth/callback`
     - `https://your-app.vercel.app/auth/callback`

   Supabase only sends magic links that return to one of these exact addresses.

3. _(Recommended)_ **Email rate limits.** Supabase's built-in email service only sends a
   few emails per hour and is meant for testing. With several people signing in, set up
   custom SMTP. If you hit the limit, wait an hour, or set up free custom SMTP
   (e.g. Resend) under **Authentication → Emails → SMTP Settings**.

## 3. Push to GitHub and import into Vercel

1. Push the repository to GitHub (already done if you cloned or pushed this repo):

   ```bash
   git push origin main
   ```

2. Go to <https://vercel.com/new>, sign in with GitHub, and **Import** the
   `InternshipTracker` repository.
3. Vercel detects **Next.js** automatically. Leave the build settings as they are.
4. **Before clicking Deploy**, open **Environment Variables** and add the variables from
   step 4.
5. Click **Deploy**. When it finishes, note your domain (e.g.
   `internship-tracker-yourname.vercel.app`).
6. Go back to **Supabase → Authentication → URL Configuration** and set the **Site URL**
   and the second **Redirect URL** to this exact domain (step 2.3).

## 4. Environment variables in Vercel

Add these under **Project → Settings → Environment Variables** for the **Production**
environment (and Preview, if you use preview deployments).

| Name                            | Value                                                                                                                | Visibility                                                                     |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase → **Project Settings → API** (or **Data API**) → Project URL, e.g. `https://abcdefghijklmnop.supabase.co`   | **Public.** Safe to expose; it's just the address.                             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → **Project Settings → API Keys** → the **publishable** key (`sb_publishable_…`) or the legacy **anon** key | **Public.** Designed to be public; it can't read anything here because of RLS. |
| `APP_TIMEZONE`                  | Your time zone, e.g. `America/Toronto`, `Asia/Kolkata`, `Europe/London`                                              | **Server-only.**                                                               |

**Do NOT add** the Supabase **service role / secret key** to Vercel. The app doesn't use it,
and it bypasses all Row Level Security.

If you change an environment variable later, redeploy (**Deployments → ⋯ → Redeploy**) for
it to take effect.

## 5. Verify privacy after deploying

Do these checks once, right after your first deploy.

1. **Every page redirects to login.** Open a private/incognito window and visit each of
   these. Each must land on the sign-in page and show no data:
   - `https://your-app.vercel.app/`
   - `https://your-app.vercel.app/tags`
   - `https://your-app.vercel.app/export` (must not download a file)
   - `https://your-app.vercel.app/?tab=applied`
   - `https://your-app.vercel.app/anything-else`
2. **Sign-up works.** Request a link for your email, then open the email **in the
   same browser** you requested it from (links are tied to that browser for security). You
   should land on your dashboard with the five default tags (Cybersecurity, Quantum,
   Software Engineering, Hardware, AI/ML).
3. **Profiles are private.** Sign up with a second email in another browser. It starts
   empty and cannot see anything from your first account.
4. **Headers are set.** In the browser's DevTools → Network, click the page request and
   confirm the response has `content-security-policy`, `x-frame-options: DENY` and
   `x-robots-tag: noindex, nofollow`. The Console should show no CSP errors.
5. **Not indexable.** `https://your-app.vercel.app/robots.txt` shows `Disallow: /`.
6. _(Optional)_ **Database lock.** In Supabase → **Authentication → Policies**, every table
   (`opportunities`, `contacts`, `tags`, `opportunity_tags`) shows **RLS enabled** with
   four policies each.

## Good to know

- **Free-tier pause:** Supabase pauses free projects after about a week with no activity.
  If the app stops loading, open the Supabase dashboard and click **Restore project**.
  Your data is kept.
- **Changing your email:** change the user's email under **Authentication → Users**.
- **Future schema changes:** add a new file in `supabase/migrations/`, test it locally with
  `npm run db:reset`, then `npx supabase db push`.
- **Backups and export:** use **Export CSV** in the app header any time.

## Upgrading an existing single-user deployment

Your existing data is kept as is: the upgrade only adds migrations, it never rewrites or
deletes rows.

1. `npx supabase db push` to apply the new migrations.
2. In Supabase → **Authentication → Sign In / Providers**, turn **on** "Allow new users to
   sign up".
3. In Vercel, you can delete the `ALLOWED_EMAIL` variable (it is no longer read), then
   redeploy.
