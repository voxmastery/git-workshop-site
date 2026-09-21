# Setup: Supabase (tickets + Google sign-in) and Vercel

Until these steps are done the site runs on a local mock: tickets live in the visitor's own browser and "Continue with Google" signs in as the Gmail they typed. Follow this once and the same build switches to the real backend.

## 1. Supabase project

1. Create a free project at https://supabase.com → Project Settings → API. Note **Project URL** and **anon public key**.
2. Install the CLI: `npm i -g supabase` (or prefix every command with `npx`).
3. In this repo: `supabase login`, then `supabase link --project-ref <your-project-ref>`.
4. Apply the schema: `supabase db push` (creates `registrations`, `organisers`, `register_attempts`, sequence and RLS from `supabase/migrations/`).
5. Set function secrets (the HMAC secret signs the QR codes; keep it private):
   ```bash
   supabase secrets set TICKET_HMAC_SECRET=$(openssl rand -hex 32) SITE_URL=https://git-workshop-site.vercel.app
   ```
6. Deploy the functions:
   ```bash
   supabase functions deploy register --no-verify-jwt
   supabase functions deploy claim --no-verify-jwt
   ```
   (`claim` verifies the user's JWT itself; `register` is called before sign-in.)

## 2. Google sign-in

1. Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID (Web application).
   Authorised redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`.
2. Supabase → Authentication → Providers → Google: paste the client ID and secret, enable.
3. Supabase → Authentication → URL Configuration: Site URL `https://git-workshop-site.vercel.app`, and add the same URL (and `http://localhost:5199` for local dev) to Redirect URLs.

## 3. Vercel environment variables

Project → Settings → Environment Variables (Production + Preview):

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | Project URL from step 1 |
| `VITE_SUPABASE_ANON_KEY` | anon public key from step 1 |
| `VITE_ORGANISER_EMAILS` | comma-separated organiser Gmails (for the future check-in page) |

Redeploy (Deployments → Redeploy, or push a commit).

## 4. Local development

```bash
cp .env.example .env   # paste the same three values
npm run dev -- --port 5199
```

## 5. Organisers

In the Supabase SQL editor: `insert into organisers(email) values ('you@gmail.com');`

## How the pieces fit

- `register` Edge Function: validates, rate-limits (5 per IP per 10 min), assigns `ticket_no`, stores a hashed check-in token, returns the signed QR URL `/c/<ticket_no>.<hmac>`.
- `claim` Edge Function: with the user's Google session, binds `google_uid` to the row whose email equals the signed-in Gmail and returns the ticket. Any other Gmail gets `404 no_match`.
- The browser never sees `TICKET_HMAC_SECRET` or the service role key.
