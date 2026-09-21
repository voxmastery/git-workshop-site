# Git & GitHub Workshop — ticket site

Single-screen registration for the Cynergy Coding Club workshop (RUAS, 22 Sep 2026).

- A gold carnival ticket drops in on load; scrolling scrubs it open (frames from a Kling 3.0 clip drawn on a canvas).
- The form sits on the open ticket. "Punch my ticket" registers, the ticket drops into the lottery box, and the visitor's own QR ticket appears.
- "Continue with Google to save it" binds the ticket to the Gmail they registered with; returning signed-in visitors land straight on their ticket.

Live: https://git-workshop-site.vercel.app

## Run

```bash
npm install
npm run dev -- --port 5199   # mock backend until .env has Supabase values
npm test
npm run build
```

## Backend

Without `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` the app uses an in-browser mock (tickets in localStorage, sign-in simulated). See **SETUP.md** for the Supabase project, Edge Functions (`register`, `claim`), migration, Google OAuth and Vercel env vars.

## Assets

`public/video/*.mp4|webm` and `public/frames/ticket/*.webp` were generated in Higgsfield (Kling 3.0 + Nano Banana 2); prompts are in `video/README.md` (not committed) and `docs/`.
