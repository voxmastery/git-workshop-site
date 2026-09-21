# Git & GitHub Workshop registration site — design

Date: 2026-09-21. Sources: `/home/voxmastery/Pictures/git-workshop-brief.md`, `/home/voxmastery/Pictures/registration-flow-spec.md`. Those two files are the source of truth for copy, colours, fields and event facts; this document settles the architecture and the build order.

## Decisions (approved 2026-09-21)

| Decision | Choice |
|---|---|
| Framework | Vite + React 18 + TypeScript, Tailwind, GSAP + ScrollTrigger, Lenis |
| Backend | Supabase: Postgres table `registrations`, Google auth, Edge Functions `register` and `checkin` |
| Hosting | Vercel (static SPA) + Supabase Edge Functions |
| Scope of v1 | Full flow: scroll site, ticket form, fold/drop, Google sign-in, unique QR ticket, organiser check-in |
| Credentials | None yet. App reads `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ORGANISER_EMAILS`, `VITE_TURNSTILE_SITE_KEY`. With no URL set, a local mock adapter runs the whole flow in memory. |

## Architecture

```
browser (Vite SPA)
  ├─ scroll story (GSAP ScrollTrigger + Lenis, canvas frame-scrub)
  ├─ TicketStage (DOM ticket, GSAP timelines, <video> layers)
  ├─ supabase-js  ──► Supabase Auth (Google)
  └─ fetch        ──► Edge Function register  ──► Postgres registrations
                  ──► Edge Function checkin   ──► Postgres registrations
```

- The browser never holds the HMAC secret. `register` assigns `ticket_no` (sequence), creates a 32-byte token, stores its SHA-256 hash, and returns `ticket_no` and the signed QR URL `https://<site>/c/<ticket_no>.<hmac>`.
- `checkin` recomputes the HMAC over `ticket_no`, compares constant-time, sets `checked_in_at` if null, and returns the card payload plus `already_checked_in`.
- Row Level Security: anon may insert nothing directly (inserts go through `register` with the service role); a signed-in user may select the row where `google_uid = auth.uid()` or `email = auth.email()`; organisers (emails in a `organisers` table) may select and update all.

## Data model

```
registrations
  id uuid pk default gen_random_uuid()
  ticket_no int unique default nextval('ticket_no_seq')   -- CYN-GIT-0001 is ticket_no 1
  name text not null check (char_length(name) between 2 and 60)
  email text not null unique                                -- lowercased, must end with @gmail.com
  department text not null                                  -- CSE, AI/ML, ISE, ECE, EEE, ME, Civil, Other
  class_year text not null                                  -- 1st, 2nd, 3rd, 4th
  phone text not null check (phone ~ '^[0-9]{10}$')
  github_username text
  laptop boolean not null
  os text
  google_uid uuid unique
  checkin_token_hash text not null
  created_at timestamptz default now()
  checked_in_at timestamptz
organisers
  email text pk
```

## Page structure (single route `/`, plus `/ticket` and `/checkin`)

Sections are pinned; each maps scroll progress 0→1 to a GSAP timeline. Total scroll ≈ 6–7 viewport heights on desktop, less on mobile.

1. Hero: `hero-loop-promptA` plays muted behind the Bebas title; on scroll the title parallaxes up and fades, date/time/venue chips slide in at 20 %.
2. The problem: folder fills with `final.docx`, `final_v2.docx`, `final_v3_REAL_final.docx` typed in one by one.
3. Commit timeline: SVG path draws itself, dots light up, branch, merge with green dot and `Merged` pill, step labels.
4. The scene: canvas frame-scrub of `scroll-dolly-promptB` (≈84 frames at 12 fps from the 7 s clip, ≤1280 px WebP, chunked preload, poster frame first); caption cards pin at window, board, contribution grid.
5. Leave with: six Octicon sticker badges fly in and settle; hover flips to the takeaway text; stacked on mobile.
6. Agenda: ticket unrolls, rows light by scroll, clock rail 2:00 → 5:00.
7. Hosts: two circular photos in gradient rings from opposite sides.
8. Register: the TicketStage (below).
9. Footer: logos, "Part 1 of 2 · Next chapter in October".

`prefers-reduced-motion`: every scrub becomes a static poster frame with fade-ins; the ticket skips the drop.

## TicketStage states

| State | What happens | Assets |
|---|---|---|
| 0 landing | Pull-tab "Pull for your ticket" at top; scroll, tap or drag triggers 1 | — |
| 1 slide in | DOM ticket (cream `#f6d9b8`, orange stub, notches, sticker strip) drops from above, `back.out(1.4)` 700 ms, then unfolds (CSS 3D rotateX on two halves) | `gold-ticket-slide-unfold-9x16` plays behind as ambience on phones; DOM ticket is the interactive layer |
| 2 form | Fields in spec order; each valid field stamps a green ✓ on the ticket edge; stub shows the name live; submit "Punch my ticket"; honeypot + Turnstile | — |
| 3 fold and drop | After `register` returns 200: form fades, ticket re-folds 400 ms, rotates 12°, drops with squash-and-stretch ≈1.2 s into the box; burst clip plays (CSS flash fallback); commit-dot confetti; text "See you soon at the workshop."; button "Continue with Google" | `lottery-box-idle-loop` looping behind, `gold-ticket-drop-into-box` or `lottery-box-swallow-burst` on landing |
| 4 sign-in | Supabase Google OAuth; on return match `auth.email` to `registrations.email`; match → bind `google_uid`, go to 5; mismatch → inline email-fix requiring the registered phone | — |
| 5 unique ticket | `/ticket`: name in Bebas, department · year, date/time/venue, `CYN-GIT-0001`, QR of the signed URL, sticker layout and stub colour chosen by a hash of `ticket_no`, "Add to phone" via `html-to-image`, share, pre-work checklist; signed-in visits land here directly | — |

## Check-in (`/checkin`)

Gated to `VITE_ORGANISER_EMAILS` client-side and the `organisers` table server-side. `html5-qrcode` scanner → `checkin` → green card (name, department, ticket number, laptop yes/no) or amber "already checked in at 2:07 PM". Manual search by name or phone. Live counter registered / checked in, no page reloads.

## Error handling

- Form: field-level messages, server errors shown on the ticket, duplicate email → "This Gmail already has a ticket, sign in to see it".
- Video: every `<video>` has `onerror` → hide and use the CSS fallback; the site works with all MP4s missing.
- Network: `register` retried once; failures keep the form state intact.
- Auth mismatch path as above; unknown organiser on `/checkin` sees a plain "not authorised" page.

## Testing

- Vitest: validation schema (zod), ticket-number formatting, hash-seeded layout determinism, HMAC verify (Deno test for the function), scroll-progress mapping helpers.
- Playwright: register → see you soon → (mock) sign in → ticket renders with QR; `/checkin` scan via injected payload marks a row and blocks the duplicate.
- Lighthouse CI on mobile: performance and accessibility ≥ 90.
- Coverage target 80 % on `src/lib` and `src/features`.

## Build phases

1. Scaffold, tokens, fonts, assets, mock backend, scroll story sections 1–7 and 9.
2. TicketStage states 0–3, `register` function, migration, RLS.
3. Google sign-in, unique ticket, check-in, `checkin` function, Playwright, Lighthouse, Vercel config, setup guide.

## Out of scope for v1

Emails and WhatsApp messages (documented as a follow-up using Supabase triggers), certificate mailing, analytics.
