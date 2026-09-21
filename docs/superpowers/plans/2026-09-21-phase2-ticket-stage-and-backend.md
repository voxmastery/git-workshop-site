# Phase 2: Ticket Stage animation + real registration backend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static register card with the animated TicketStage (pull-tab → slide in + unfold → form → fold + drop into the box → "See you soon") and replace the localStorage mock with a Supabase-backed `register` Edge Function, migration and RLS.

**Architecture:** A small pure state machine (`ticketMachine.ts`) drives a React `TicketStage` component; GSAP timelines are created in a hook and respect `prefers-reduced-motion`. Backend access stays behind the existing `RegistrationBackend` interface: a `SupabaseBackend` calls the `register` Edge Function; the mock stays for local dev when env is absent. The Edge Function owns ticket numbering and the HMAC-signed QR token; the browser never sees the secret.

**Tech Stack:** Vite 8, React 19, TypeScript, GSAP 3 (already installed), Vitest, Supabase CLI (`supabase/` folder with migration + Deno Edge Function), `@supabase/supabase-js`.

**Spec:** `docs/superpowers/specs/2026-09-21-registration-site-design.md` (sections "TicketStage states", "Data model", "Architecture", "Error handling").

## Global Constraints

- Colours and fonts exactly as `src/styles.css` tokens (cream `#f6d9b8`, orange `#f05033`, coral hover `#ff7a59`, deep `#2b1d4f`, green `#3ddc84`).
- Ticket is a real DOM element (never an image); the stub shows the typed name live.
- Every `<video>` needs a poster and an `onError` fallback; the flow must work with all MP4s missing.
- `prefers-reduced-motion: reduce` → no drop animation; ticket slides straight to the "See you soon" state.
- Mobile first: ticket 92vw wide, inputs 48px tall, submit sticky at the bottom of the ticket.
- Email lowercased, must end with `@gmail.com`; phone 10 digits; name 2–60 chars (already in `src/lib/validation.ts`).
- Unlimited-plan videos are 720p; use `public/video/ticket-unfold.mp4` (9:16), `public/video/ticket-drop.mp4`, `public/video/box-idle.mp4`, `public/video/box-burst.mp4`.
- Never commit secrets. Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` in the browser; `TICKET_HMAC_SECRET`, `TURNSTILE_SECRET_KEY` only in Supabase function secrets.
- Commit after every task with conventional messages; `npm test` and `npm run build` must pass before each commit.

## File structure

```
src/
  features/ticket/
    ticketMachine.ts          pure reducer: states + events (Task 1)
    ticketMachine.test.ts
    useTicketTimelines.ts     GSAP timelines for slide-in/unfold and fold/drop (Task 2)
    TicketStage.tsx           the component: pull-tab, ticket, form, drop, see-you-soon (Task 2, 3)
    TicketForm.tsx            the form moved out of RegisterTicket.tsx (Task 3)
    Confetti.tsx              commit-dot confetti (Task 3)
    ticket.css                stage-specific styles (Task 2, 3)
  lib/
    registrations.ts          add SupabaseBackend + env switch (Task 5)
    registrations.test.ts
    env.ts                    typed env access (Task 5)
supabase/
  config.toml                 created by `supabase init` (Task 4)
  migrations/20260921000000_registrations.sql (Task 4)
  functions/register/index.ts (Task 4)
  functions/_shared/token.ts  HMAC helpers, unit-tested with Deno (Task 4)
  functions/_shared/token_test.ts
SETUP.md                       Supabase + Google OAuth + Vercel env steps (Task 5)
```

---

### Task 1: Ticket state machine

**Files:**
- Create: `src/features/ticket/ticketMachine.ts`
- Test: `src/features/ticket/ticketMachine.test.ts`

**Interfaces:**
- Produces: `type TicketState = 'landing' | 'entering' | 'form' | 'submitting' | 'dropping' | 'done'`; `type TicketEvent = {type:'PULL'} | {type:'ENTERED'} | {type:'SUBMIT'} | {type:'SUCCESS'; ticketNo:number} | {type:'FAIL'; message:string} | {type:'LANDED'}`; `type TicketContext = {state: TicketState; ticketNo: number | null; error: string | null}`; `function ticketReducer(ctx: TicketContext, ev: TicketEvent): TicketContext`; `const INITIAL_TICKET: TicketContext`.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/ticket/ticketMachine.test.ts
import { describe, expect, it } from 'vitest';
import { INITIAL_TICKET, ticketReducer, type TicketContext } from './ticketMachine';

function run(events: Parameters<typeof ticketReducer>[1][], start: TicketContext = INITIAL_TICKET) {
  return events.reduce(ticketReducer, start);
}

describe('ticketReducer', () => {
  it('starts on landing', () => {
    expect(INITIAL_TICKET).toEqual({ state: 'landing', ticketNo: null, error: null });
  });
  it('walks the happy path', () => {
    expect(run([{ type: 'PULL' }]).state).toBe('entering');
    expect(run([{ type: 'PULL' }, { type: 'ENTERED' }]).state).toBe('form');
    expect(run([{ type: 'PULL' }, { type: 'ENTERED' }, { type: 'SUBMIT' }]).state).toBe('submitting');
    const ok = run([{ type: 'PULL' }, { type: 'ENTERED' }, { type: 'SUBMIT' }, { type: 'SUCCESS', ticketNo: 7 }]);
    expect(ok).toEqual({ state: 'dropping', ticketNo: 7, error: null });
    expect(ticketReducer(ok, { type: 'LANDED' }).state).toBe('done');
  });
  it('returns to the form with the message on failure', () => {
    const failed = run([{ type: 'PULL' }, { type: 'ENTERED' }, { type: 'SUBMIT' }, { type: 'FAIL', message: 'Duplicate' }]);
    expect(failed).toEqual({ state: 'form', ticketNo: null, error: 'Duplicate' });
  });
  it('ignores events that do not apply to the current state', () => {
    expect(ticketReducer(INITIAL_TICKET, { type: 'SUBMIT' })).toBe(INITIAL_TICKET);
    expect(ticketReducer(INITIAL_TICKET, { type: 'LANDED' })).toBe(INITIAL_TICKET);
  });
  it('clears a previous error when submitting again', () => {
    const failed: TicketContext = { state: 'form', ticketNo: null, error: 'x' };
    expect(ticketReducer(failed, { type: 'SUBMIT' })).toEqual({ state: 'submitting', ticketNo: null, error: null });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/ticket/ticketMachine.test.ts`
Expected: FAIL, cannot resolve `./ticketMachine`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/ticket/ticketMachine.ts
export type TicketState = 'landing' | 'entering' | 'form' | 'submitting' | 'dropping' | 'done';

export type TicketEvent =
  | { type: 'PULL' }
  | { type: 'ENTERED' }
  | { type: 'SUBMIT' }
  | { type: 'SUCCESS'; ticketNo: number }
  | { type: 'FAIL'; message: string }
  | { type: 'LANDED' };

export type TicketContext = { state: TicketState; ticketNo: number | null; error: string | null };

export const INITIAL_TICKET: TicketContext = { state: 'landing', ticketNo: null, error: null };

export function ticketReducer(ctx: TicketContext, ev: TicketEvent): TicketContext {
  switch (ctx.state) {
    case 'landing':
      return ev.type === 'PULL' ? { ...ctx, state: 'entering' } : ctx;
    case 'entering':
      return ev.type === 'ENTERED' ? { ...ctx, state: 'form' } : ctx;
    case 'form':
      return ev.type === 'SUBMIT' ? { ...ctx, state: 'submitting', error: null } : ctx;
    case 'submitting':
      if (ev.type === 'SUCCESS') return { state: 'dropping', ticketNo: ev.ticketNo, error: null };
      if (ev.type === 'FAIL') return { state: 'form', ticketNo: null, error: ev.message };
      return ctx;
    case 'dropping':
      return ev.type === 'LANDED' ? { ...ctx, state: 'done' } : ctx;
    default:
      return ctx;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/ticket/ticketMachine.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/ticket/ticketMachine.ts src/features/ticket/ticketMachine.test.ts
git commit -m "feat(ticket): add ticket stage state machine"
```

---

### Task 2: TicketStage component with slide-in and unfold

**Files:**
- Create: `src/features/ticket/useTicketTimelines.ts`, `src/features/ticket/TicketStage.tsx`, `src/features/ticket/ticket.css`
- Modify: `src/App.tsx` (render `<TicketStage />` instead of `<RegisterTicket />`), `src/styles.css` (remove the old `.register`/`.ticket` block once TicketStage owns it)
- Test: `src/features/ticket/useTicketTimelines.test.ts`

**Interfaces:**
- Consumes: `ticketReducer`, `INITIAL_TICKET`, `TicketContext` from Task 1; `EVENT` from `src/data/event.ts`.
- Produces: `TicketStage` default export (no props). `useTicketTimelines(refs, reduced: boolean)` returns `{ playEnter(onDone: () => void): void; playDrop(onLanded: () => void): void }`. Helper `enterDuration(reduced: boolean): number` (ms) exported for tests. `TicketStage` renders `<form>` via a `TicketForm` placeholder in this task (the real form arrives in Task 3), with `data-state={ctx.state}` on the root for E2E.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/ticket/useTicketTimelines.test.ts
import { describe, expect, it } from 'vitest';
import { enterDuration, dropDuration } from './useTicketTimelines';

describe('timeline durations', () => {
  it('uses the spec timings when motion is allowed', () => {
    expect(enterDuration(false)).toBe(700 + 1000 + 600); // drop-in 700ms, pause 1s, unfold 600ms
    expect(dropDuration(false)).toBe(400 + 1200);        // refold 400ms, drop ~1.2s
  });
  it('collapses to near-zero for reduced motion', () => {
    expect(enterDuration(true)).toBeLessThanOrEqual(200);
    expect(dropDuration(true)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/ticket/useTicketTimelines.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write the hook**

```ts
// src/features/ticket/useTicketTimelines.ts
import gsap from 'gsap';
import { useCallback, type RefObject } from 'react';

export type TicketRefs = {
  ticket: RefObject<HTMLDivElement | null>;
  top: RefObject<HTMLDivElement | null>;   // upper half (front face)
  bottom: RefObject<HTMLDivElement | null>; // lower half (folds down to reveal form)
};

export const ENTER_DROP_MS = 700;
export const ENTER_PAUSE_MS = 1000;
export const ENTER_UNFOLD_MS = 600;
export const DROP_REFOLD_MS = 400;
export const DROP_FALL_MS = 1200;

export function enterDuration(reduced: boolean): number {
  return reduced ? 200 : ENTER_DROP_MS + ENTER_PAUSE_MS + ENTER_UNFOLD_MS;
}
export function dropDuration(reduced: boolean): number {
  return reduced ? 0 : DROP_REFOLD_MS + DROP_FALL_MS;
}

export function useTicketTimelines(refs: TicketRefs, reduced: boolean) {
  const playEnter = useCallback(
    (onDone: () => void) => {
      const ticket = refs.ticket.current;
      const bottom = refs.bottom.current;
      if (!ticket || !bottom) return onDone();
      if (reduced) {
        gsap.set(ticket, { y: 0, opacity: 1 });
        gsap.set(bottom, { rotateX: 0 });
        return void setTimeout(onDone, enterDuration(true));
      }
      const tl = gsap.timeline({ onComplete: onDone });
      tl.fromTo(ticket, { y: '-120vh', opacity: 1 }, { y: 0, duration: ENTER_DROP_MS / 1000, ease: 'back.out(1.4)' })
        .to({}, { duration: ENTER_PAUSE_MS / 1000 })
        .fromTo(bottom, { rotateX: -180 }, { rotateX: 0, duration: ENTER_UNFOLD_MS / 1000, ease: 'power2.out' });
    },
    [refs, reduced],
  );

  const playDrop = useCallback(
    (onLanded: () => void) => {
      const ticket = refs.ticket.current;
      const bottom = refs.bottom.current;
      if (!ticket || !bottom || reduced) return onLanded();
      const tl = gsap.timeline({ onComplete: onLanded });
      tl.to(bottom, { rotateX: -180, duration: DROP_REFOLD_MS / 1000, ease: 'power2.in' })
        .to(ticket, { rotate: 12, duration: 0.2 }, '<')
        .to(ticket, { y: '60vh', scaleY: 1.08, scaleX: 0.95, duration: (DROP_FALL_MS * 0.7) / 1000, ease: 'power2.in' })
        .to(ticket, { scaleY: 0.8, scaleX: 1.15, opacity: 0, duration: (DROP_FALL_MS * 0.3) / 1000, ease: 'power1.out' });
    },
    [refs, reduced],
  );

  return { playEnter, playDrop };
}
```

- [ ] **Step 4: Write the component and styles**

```tsx
// src/features/ticket/TicketStage.tsx
import { useEffect, useReducer, useRef, useState } from 'react';
import { EVENT } from '../../data/event';
import { INITIAL_TICKET, ticketReducer } from './ticketMachine';
import { useTicketTimelines } from './useTicketTimelines';
import './ticket.css';

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

export default function TicketStage() {
  const [ctx, dispatch] = useReducer(ticketReducer, INITIAL_TICKET);
  const reduced = usePrefersReducedMotion();
  const ticket = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const { playEnter } = useTicketTimelines({ ticket, top, bottom }, reduced);
  const [name, setName] = useState('');

  useEffect(() => {
    if (ctx.state === 'entering') playEnter(() => dispatch({ type: 'ENTERED' }));
  }, [ctx.state, playEnter]);

  return (
    <section className="section ticket-stage" id="register" data-state={ctx.state}>
      <div className="section-head">
        <p className="kicker">Register free</p>
        <h2 className="display">Punch your ticket</h2>
      </div>
      <div className="stage">
        <video className="stage-bg" autoPlay muted loop playsInline poster="/img/box-poster.jpg" aria-hidden="true"
          onError={(e) => ((e.currentTarget as HTMLVideoElement).style.display = 'none')}>
          <source src="/video/box-idle.mp4" type="video/mp4" />
        </video>

        {ctx.state === 'landing' && (
          <button className="pull-tab" type="button" onClick={() => dispatch({ type: 'PULL' })}>
            <span aria-hidden="true">▾</span> Pull for your ticket
          </button>
        )}

        {ctx.state !== 'landing' && (
          <div className="ticket3d" ref={ticket}>
            <div className="half top" ref={top}>
              <div className="stub"><div className="day">{EVENT.dateDay}</div><div className="mon">{EVENT.dateMonth}</div>
                <div className="who">{(name.trim() || 'YOUR NAME').toUpperCase()}</div></div>
              <div className="face">
                <h3>{EVENT.name}</h3>
                <p className="small">{EVENT.chapter} · {EVENT.dateLabel} · {EVENT.venueShort}</p>
              </div>
            </div>
            <div className="half bottom" ref={bottom}>
              {/* Task 3 replaces this placeholder with <TicketForm/> */}
              <div className="face form-face">
                <label className="field"><span>Full name</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} disabled={ctx.state !== 'form'} /></label>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
```

```css
/* src/features/ticket/ticket.css */
.ticket-stage .stage { position: relative; min-height: 80svh; border-radius: 24px; overflow: hidden; background: var(--deep); display: grid; place-items: start center; padding: 24px 0 40px; perspective: 1400px; }
.ticket-stage .stage-bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0.35; }
.pull-tab { position: absolute; top: 0; left: 50%; transform: translateX(-50%); background: var(--cream); color: var(--deep); border: 0; border-radius: 0 0 14px 14px; padding: 10px 18px; font-weight: 700; cursor: pointer; box-shadow: 0 8px 20px rgba(0,0,0,.35); }
.pull-tab:hover { background: #fff; }
.ticket3d { position: relative; width: min(92vw, 560px); transform-style: preserve-3d; will-change: transform; }
.half { background: var(--cream); color: var(--deep); display: grid; grid-template-columns: 84px 1fr; transform-style: preserve-3d; backface-visibility: hidden; }
.half.top { border-radius: 18px 18px 0 0; border-bottom: 2px dashed rgba(43,29,79,.35); }
.half.bottom { border-radius: 0 0 18px 18px; transform-origin: top center; }
.half .stub { background: var(--orange); color: #fff; text-align: center; padding: 14px 6px; display: grid; align-content: center; }
.half.bottom .stub { background: var(--orange); opacity: .92; }
.half .stub .day { font-family: var(--font-display); font-size: 2.6rem; line-height: 1; }
.half .stub .mon { font-family: var(--font-display); letter-spacing: 3px; }
.half .stub .who { margin-top: 10px; font-size: .65rem; font-weight: 700; word-break: break-word; }
.half .face { padding: 18px; }
.half h3 { font-family: var(--font-display); letter-spacing: 2px; font-size: 1.8rem; margin: 0; }
.half .small { margin: 4px 0 0; font-size: .85rem; color: #4a3b78; }
.form-face .field input, .form-face .field select { height: 48px; width: 100%; border-radius: 10px; border: 1.5px solid #cbb9a0; background: #fff; padding: 0 12px; font: inherit; color: var(--deep); }
.form-face .field { display: grid; gap: 6px; font-size: .8rem; font-weight: 600; }
@media (prefers-reduced-motion: reduce) { .ticket-stage .stage-bg { display: none; } }
```

- [ ] **Step 5: Wire it into App and run tests + build**

In `src/App.tsx` replace `import { RegisterTicket } from './components/RegisterTicket';` with `import TicketStage from './features/ticket/TicketStage';` and `<RegisterTicket />` with `<TicketStage />`. Keep `RegisterTicket.tsx` until Task 3 deletes it.

Run: `npm test && npm run build`
Expected: all tests pass, build clean. Then `npm run dev`, open `http://localhost:5173/#register`, click the pull-tab: ticket drops in with overshoot, pauses, lower half folds open.

- [ ] **Step 6: Commit**

```bash
git add src/features/ticket src/App.tsx
git commit -m "feat(ticket): ticket stage with slide-in and unfold timelines"
```

---

### Task 3: Form on the ticket, fold-and-drop, burst, confetti, "See you soon"

**Files:**
- Create: `src/features/ticket/TicketForm.tsx`, `src/features/ticket/Confetti.tsx`
- Modify: `src/features/ticket/TicketStage.tsx`, `src/features/ticket/ticket.css`
- Delete: `src/components/RegisterTicket.tsx`; remove `.register`, `.ticket`, `.form`, `.field`, `.grid-2`, `.toggle`, `.hp`, `.success` rules from `src/styles.css`.
- Test: `src/features/ticket/Confetti.test.ts`

**Interfaces:**
- Consumes: `validateRegistration`, `EMPTY_REGISTRATION`, `RegistrationInput`, `formatTicketNo` from `src/lib/validation.ts`; `createBackend()` from `src/lib/registrations.ts`; `ticketReducer` events from Task 1; `playDrop` from Task 2.
- Produces: `TicketForm` props `{ value: RegistrationInput; onChange(v: RegistrationInput): void; onSubmit(): void; disabled: boolean; serverError: string | null }`; `Confetti` props `{ count?: number; seed?: number }` and exported pure `confettiPieces(count: number, seed: number): {x:number; delay:number; color:string}[]`.

- [ ] **Step 1: Write the failing confetti test**

```ts
// src/features/ticket/Confetti.test.ts
import { describe, expect, it } from 'vitest';
import { confettiPieces } from './Confetti';

describe('confettiPieces', () => {
  it('is deterministic for a seed and spreads across the width', () => {
    const a = confettiPieces(40, 7);
    const b = confettiPieces(40, 7);
    expect(a).toEqual(b);
    expect(a).toHaveLength(40);
    expect(Math.min(...a.map((p) => p.x))).toBeGreaterThanOrEqual(0);
    expect(Math.max(...a.map((p) => p.x))).toBeLessThanOrEqual(100);
    expect(new Set(a.map((p) => p.color)).size).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/ticket/Confetti.test.ts` → FAIL, module not found.

- [ ] **Step 3: Implement Confetti**

```tsx
// src/features/ticket/Confetti.tsx
const COLORS = ['#3ddc84', '#f05033', '#c9b8f5', '#f6d9b8', '#8957e5'];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function confettiPieces(count: number, seed: number) {
  const rnd = mulberry32(seed);
  return Array.from({ length: count }, (_, i) => ({
    x: Math.round(rnd() * 100),
    delay: Math.round(rnd() * 400) / 1000,
    color: COLORS[i % COLORS.length],
  }));
}

export function Confetti({ count = 40, seed = 1 }: { count?: number; seed?: number }) {
  return (
    <div className="confetti" aria-hidden="true">
      {confettiPieces(count, seed).map((p, i) => (
        <span key={i} className="confetti-dot" style={{ left: `${p.x}%`, animationDelay: `${p.delay}s`, background: p.color }} />
      ))}
    </div>
  );
}
```

Add to `ticket.css`:

```css
.confetti { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.confetti-dot { position: absolute; bottom: 40%; width: 10px; height: 10px; border-radius: 50%; animation: confetti-pop 1.4s ease-out forwards; }
@keyframes confetti-pop { 0% { transform: translateY(0) scale(.6); opacity: 0 } 15% { opacity: 1 } 100% { transform: translateY(-60vh) scale(1); opacity: 0 } }
.flash { position: absolute; inset: 0; background: radial-gradient(circle at 50% 70%, rgba(246,217,184,.9), transparent 60%); animation: flash 900ms ease-out forwards; pointer-events: none; }
@keyframes flash { from { opacity: 1 } to { opacity: 0 } }
.see-you { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; gap: 14px; padding: 24px; }
.see-you h3 { font-family: var(--font-display); font-size: clamp(2.4rem, 8vw, 4.5rem); letter-spacing: 2px; margin: 0; color: var(--cream); }
.see-you .hint { color: var(--lavender); font-size: .9rem; margin: 0; }
.see-you ol { text-align: left; color: var(--cream); padding-left: 20px; margin: 0; }
.stamp { position: absolute; right: -6px; width: 22px; height: 22px; border-radius: 50%; background: var(--green); color: var(--deep); font-size: 14px; font-weight: 700; display: grid; place-items: center; box-shadow: 0 2px 6px rgba(0,0,0,.3); }
.form-face .submit { position: sticky; bottom: 0; padding-top: 8px; background: linear-gradient(to top, var(--cream) 70%, transparent); }
.burst-video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
@media (prefers-reduced-motion: reduce) { .confetti-dot, .flash { animation: none; display: none; } }
```

- [ ] **Step 4: Run confetti test** → `npm test -- src/features/ticket/Confetti.test.ts` PASS.

- [ ] **Step 5: Build TicketForm** (move the form JSX from `src/components/RegisterTicket.tsx`; keep behaviour, change the wrapper to the ticket's lower half, add stamps)

```tsx
// src/features/ticket/TicketForm.tsx
import { useMemo, useState, type FormEvent } from 'react';
import { CLASS_YEARS, DEPARTMENTS } from '../../data/event';
import { validateRegistration, type RegistrationInput } from '../../lib/validation';

type Props = { value: RegistrationInput; onChange: (v: RegistrationInput) => void; onSubmit: () => void; disabled: boolean; serverError: string | null };
type Key = keyof RegistrationInput;

export function TicketForm({ value, onChange, onSubmit, disabled, serverError }: Props) {
  const [touched, setTouched] = useState<Partial<Record<Key, boolean>>>({});
  const [honeypot, setHoneypot] = useState('');
  const errors = useMemo(() => validateRegistration(value), [value]);
  const set = <K extends Key>(k: K, v: RegistrationInput[K]) => onChange({ ...value, [k]: v });
  const touch = (k: Key) => setTouched((t) => ({ ...t, [k]: true }));
  const filled = (k: Key) => (k === 'laptop' ? value.laptop !== null : String(value[k] ?? '').trim() !== '');
  const stamp = (k: Key) => (filled(k) && !errors[k] ? <span className="stamp" aria-label="looks good">✓</span> : null);
  const err = (k: Key) => (touched[k] && errors[k] ? <span className="err">{errors[k]}</span> : null);

  function submit(e: FormEvent) {
    e.preventDefault();
    setTouched({ name: true, email: true, department: true, classYear: true, phone: true, githubUsername: true, laptop: true });
    if (honeypot || Object.keys(errors).length) return;
    onSubmit();
  }

  return (
    <form className="form-face" onSubmit={submit} noValidate>
      <input className="hp" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} aria-hidden="true" />
      <label className="field"><span>Full name</span><input value={value.name} onChange={(e) => set('name', e.target.value)} onBlur={() => touch('name')} autoComplete="name" disabled={disabled} />{stamp('name')}{err('name')}</label>
      <label className="field"><span>Personal Gmail</span><input type="email" inputMode="email" value={value.email} onChange={(e) => set('email', e.target.value)} onBlur={() => touch('email')} autoComplete="email" placeholder="you@gmail.com" disabled={disabled} />{stamp('email')}{err('email')}</label>
      <div className="grid-2">
        <label className="field"><span>Department</span><select value={value.department} onChange={(e) => set('department', e.target.value)} onBlur={() => touch('department')} disabled={disabled}><option value="">Choose…</option>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</select>{stamp('department')}{err('department')}</label>
        <label className="field"><span>Class year</span><select value={value.classYear} onChange={(e) => set('classYear', e.target.value)} onBlur={() => touch('classYear')} disabled={disabled}><option value="">Choose…</option>{CLASS_YEARS.map((y) => <option key={y} value={y}>{y} year</option>)}</select>{stamp('classYear')}{err('classYear')}</label>
      </div>
      <label className="field"><span>Phone (WhatsApp)</span><input type="tel" inputMode="numeric" value={value.phone} onChange={(e) => set('phone', e.target.value)} onBlur={() => touch('phone')} autoComplete="tel-national" placeholder="10 digits" disabled={disabled} />{stamp('phone')}{err('phone')}</label>
      <label className="field"><span>GitHub username</span><input value={value.githubUsername} onChange={(e) => set('githubUsername', e.target.value)} onBlur={() => touch('githubUsername')} placeholder="optional" disabled={disabled || value.noGithubYet} />{err('githubUsername')}</label>
      <label className="toggle"><input type="checkbox" checked={value.noGithubYet} onChange={(e) => set('noGithubYet', e.target.checked)} disabled={disabled} /> I’ll create one</label>
      <div className="field"><span>Bringing a laptop?</span>
        <div className="toggle" role="radiogroup" aria-label="Bringing a laptop">
          <label className="toggle"><input type="radio" name="laptop" checked={value.laptop === true} onChange={() => { set('laptop', true); touch('laptop'); }} disabled={disabled} /> Yes</label>
          <label className="toggle"><input type="radio" name="laptop" checked={value.laptop === false} onChange={() => { set('laptop', false); touch('laptop'); }} disabled={disabled} /> No</label>
        </div>{stamp('laptop')}{err('laptop')}</div>
      {serverError && <div className="err" role="alert">{serverError}</div>}
      <div className="submit"><button className="btn btn-primary" type="submit" disabled={disabled} style={{ width: '100%' }}>{disabled ? 'Punching…' : 'Punch my ticket'}</button></div>
    </form>
  );
}
```

Move the `.grid-2`, `.toggle`, `.hp`, `.err` rules from `src/styles.css` into `ticket.css` (scoped under `.form-face`) and delete them from `styles.css`. `.field` in `ticket.css` needs `position: relative` so the stamp sits on the ticket edge.

- [ ] **Step 6: Wire the full flow into TicketStage**

Replace the placeholder lower half and add drop/done handling:

```tsx
// inside TicketStage (additions)
import { TicketForm } from './TicketForm';
import { Confetti } from './Confetti';
import { createBackend } from '../../lib/registrations';
import { EMPTY_REGISTRATION, formatTicketNo, type RegistrationInput } from '../../lib/validation';

const backend = createBackend();
// state
const [form, setForm] = useState<RegistrationInput>(EMPTY_REGISTRATION);
const [burstFailed, setBurstFailed] = useState(false);
const { playEnter, playDrop } = useTicketTimelines({ ticket, top, bottom }, reduced);

useEffect(() => {
  if (ctx.state === 'dropping') playDrop(() => dispatch({ type: 'LANDED' }));
}, [ctx.state, playDrop]);

async function submit() {
  dispatch({ type: 'SUBMIT' });
  try {
    const { ticketNo } = await backend.register(form);
    dispatch({ type: 'SUCCESS', ticketNo });
  } catch (e) {
    dispatch({ type: 'FAIL', message: e instanceof Error ? e.message : 'Something went wrong. Please try again.' });
  }
}
```

Lower half JSX becomes `<TicketForm value={form} onChange={setForm} onSubmit={submit} disabled={ctx.state !== 'form'} serverError={ctx.error} />`; the stub name reads `form.name`.

When `ctx.state === 'done'` render, inside `.stage` after the ticket (ticket is now opacity 0):

```tsx
{ctx.state === 'done' && (
  <>
    {!reduced && !burstFailed ? (
      <video className="burst-video" autoPlay muted playsInline onError={() => setBurstFailed(true)} aria-hidden="true">
        <source src="/video/ticket-drop.mp4" type="video/mp4" />
      </video>
    ) : (<div className="flash" />)}
    {!reduced && <Confetti seed={ctx.ticketNo ?? 1} />}
    <div className="see-you">
      <h3>See you soon at the workshop.</h3>
      <p className="hint">Ticket {formatTicketNo(ctx.ticketNo ?? 0)} · Sign in with the same Gmail to get your ticket.</p>
      <button className="btn btn-primary" type="button" disabled title="Arrives in the next update">Continue with Google</button>
      <ol><li>Create a GitHub account</li><li>Install Git</li><li>Run <code>git --version</code></li><li>Screenshot it into the WhatsApp group</li></ol>
    </div>
  </>
)}
```

Delete `src/components/RegisterTicket.tsx`. Remove the now-unused `.register`, `.ticket*`, `.form`, `.field`, `.success` rules from `src/styles.css`.

- [ ] **Step 7: Verify**

Run: `npm test && npm run build` → all pass, no unused exports. Manual: `npm run dev`, fill the form, submit; ticket refolds, rotates, drops, drop clip (or flash) plays, confetti, "See you soon" with the ticket number. Toggle OS reduced motion: ticket jumps straight to "See you soon".

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(ticket): form on the ticket, fold-and-drop, burst and see-you-soon state"
```

---

### Task 4: Supabase migration and `register` Edge Function

**Files:**
- Create: `supabase/config.toml` (via `npx supabase init`), `supabase/migrations/20260921000000_registrations.sql`, `supabase/functions/_shared/token.ts`, `supabase/functions/_shared/token_test.ts`, `supabase/functions/register/index.ts`
- Test: Deno test for `_shared/token.ts`

**Interfaces:**
- Produces: HTTP `POST {SUPABASE_URL}/functions/v1/register` with JSON `{name,email,department,classYear,phone,githubUsername,laptop,turnstileToken?}` → `201 {ticketNo:number, qrUrl:string}`; `409 {error:'duplicate'}`; `400 {error:string}`; `429 {error:'rate_limited'}`. `_shared/token.ts` exports `signTicket(ticketNo: number, secret: string): Promise<string>` (hex HMAC-SHA256 of the decimal ticket number), `verifyTicket(ticketNo: number, sig: string, secret: string): Promise<boolean>` (constant-time), `sha256Hex(input: string): Promise<string>`, `randomToken(): string` (32 bytes hex).

- [ ] **Step 1: Init Supabase folder**

Run: `npx --yes supabase@latest init --with-vscode-settings=false --with-intellij-settings=false` (answer no to prompts). Expected: `supabase/config.toml` created. Add `supabase/.temp` to `.gitignore`.

- [ ] **Step 2: Write the failing Deno test**

```ts
// supabase/functions/_shared/token_test.ts
import { assertEquals, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { randomToken, sha256Hex, signTicket, verifyTicket } from './token.ts';

Deno.test('sign and verify round-trip', async () => {
  const sig = await signTicket(42, 'secret');
  assertEquals(sig.length, 64);
  assertEquals(await verifyTicket(42, sig, 'secret'), true);
  assertEquals(await verifyTicket(43, sig, 'secret'), false);
  assertEquals(await verifyTicket(42, sig, 'other'), false);
});

Deno.test('random token is 64 hex chars and unique', () => {
  const a = randomToken();
  assertEquals(a.length, 64);
  assertNotEquals(a, randomToken());
});

Deno.test('sha256 is stable', async () => {
  assertEquals(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd supabase/functions/_shared && deno test --allow-none token_test.ts` (install Deno if missing: `curl -fsSL https://deno.land/install.sh | sh`). Expected: FAIL, module not found.

- [ ] **Step 4: Implement token helpers**

```ts
// supabase/functions/_shared/token.ts
const enc = new TextEncoder();

function toHex(bytes: ArrayBuffer | Uint8Array): string {
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

export async function signTicket(ticketNo: number, secret: string): Promise<string> {
  const key = await hmacKey(secret);
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(String(ticketNo))));
}

export async function verifyTicket(ticketNo: number, sig: string, secret: string): Promise<boolean> {
  const expected = await signTicket(ticketNo, secret);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

export async function sha256Hex(input: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(input)));
}

export function randomToken(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}
```

- [ ] **Step 5: Run Deno tests** → PASS (3 tests).

- [ ] **Step 6: Write the migration**

```sql
-- supabase/migrations/20260921000000_registrations.sql
create sequence if not exists ticket_no_seq start 1;

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  ticket_no int not null unique default nextval('ticket_no_seq'),
  name text not null check (char_length(name) between 2 and 60),
  email text not null unique check (email = lower(email) and email like '%@gmail.com'),
  department text not null check (department in ('CSE','AI/ML','ISE','ECE','EEE','ME','Civil','Other')),
  class_year text not null check (class_year in ('1st','2nd','3rd','4th')),
  phone text not null check (phone ~ '^[0-9]{10}$'),
  github_username text,
  laptop boolean not null,
  os text,
  google_uid uuid unique,
  checkin_token_hash text not null,
  created_at timestamptz not null default now(),
  checked_in_at timestamptz
);

create table if not exists public.organisers (
  email text primary key
);

create table if not exists public.register_attempts (
  ip text not null,
  attempted_at timestamptz not null default now()
);
create index if not exists register_attempts_ip_idx on public.register_attempts (ip, attempted_at);

alter table public.registrations enable row level security;
alter table public.organisers enable row level security;
alter table public.register_attempts enable row level security;

-- No anon/authenticated inserts: only the service role (Edge Function) writes.
create policy "own row by google uid or email" on public.registrations
  for select to authenticated
  using (google_uid = auth.uid() or email = lower(auth.jwt() ->> 'email'));

create policy "organisers read all" on public.registrations
  for select to authenticated
  using (exists (select 1 from public.organisers o where o.email = lower(auth.jwt() ->> 'email')));

create policy "organisers see organisers" on public.organisers
  for select to authenticated
  using (email = lower(auth.jwt() ->> 'email'));
```

- [ ] **Step 7: Write the Edge Function**

```ts
// supabase/functions/register/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2';
import { randomToken, sha256Hex, signTicket } from '../_shared/token.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const DEPARTMENTS = ['CSE', 'AI/ML', 'ISE', 'ECE', 'EEE', 'ME', 'Civil', 'Other'];
const YEARS = ['1st', '2nd', '3rd', '4th'];

type Body = { name?: string; email?: string; department?: string; classYear?: string; phone?: string; githubUsername?: string; laptop?: boolean; turnstileToken?: string };

function validate(b: Body): string | null {
  const name = (b.name ?? '').trim();
  if (name.length < 2 || name.length > 60) return 'name';
  const email = (b.email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@gmail\.com$/.test(email)) return 'email';
  if (!DEPARTMENTS.includes(b.department ?? '')) return 'department';
  if (!YEARS.includes(b.classYear ?? '')) return 'classYear';
  if (!/^[0-9]{10}$/.test((b.phone ?? '').replace(/\s+/g, ''))) return 'phone';
  if (typeof b.laptop !== 'boolean') return 'laptop';
  return null;
}

async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) return true; // Turnstile optional until configured
  if (!token) return false;
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: token, remoteip: ip }),
  });
  const data = (await res.json()) as { success?: boolean };
  return data.success === true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'method' });

  let body: Body;
  try { body = (await req.json()) as Body; } catch { return json(400, { error: 'json' }); }
  const bad = validate(body);
  if (bad) return json(400, { error: `invalid_${bad}` });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  if (!(await verifyTurnstile(body.turnstileToken, ip))) return json(400, { error: 'turnstile' });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // rate limit: 5 attempts per IP per 10 minutes
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count } = await supabase.from('register_attempts').select('*', { count: 'exact', head: true }).eq('ip', ip).gte('attempted_at', since);
  if ((count ?? 0) >= 5) return json(429, { error: 'rate_limited' });
  await supabase.from('register_attempts').insert({ ip });

  const secret = Deno.env.get('TICKET_HMAC_SECRET');
  if (!secret) return json(500, { error: 'server_config' });
  const token = randomToken();

  const { data, error } = await supabase
    .from('registrations')
    .insert({
      name: body.name!.trim(),
      email: body.email!.trim().toLowerCase(),
      department: body.department,
      class_year: body.classYear,
      phone: body.phone!.replace(/\s+/g, ''),
      github_username: body.githubUsername?.trim() || null,
      laptop: body.laptop,
      checkin_token_hash: await sha256Hex(token),
    })
    .select('ticket_no')
    .single();

  if (error) {
    if (error.code === '23505') return json(409, { error: 'duplicate' });
    console.error(error);
    return json(500, { error: 'insert' });
  }
  const ticketNo = data.ticket_no as number;
  const sig = await signTicket(ticketNo, secret);
  const site = Deno.env.get('SITE_URL') ?? 'https://git-workshop-site.vercel.app';
  return json(201, { ticketNo, qrUrl: `${site}/c/${ticketNo}.${sig}` });
});
```

- [ ] **Step 8: Local check (no project needed)**

Run: `deno check supabase/functions/register/index.ts` → no type errors. Run the token tests again.

- [ ] **Step 9: Commit**

```bash
git add supabase .gitignore
git commit -m "feat(backend): registrations migration, RLS and register edge function"
```

---

### Task 5: Supabase backend adapter, env switch and SETUP guide

**Files:**
- Create: `src/lib/env.ts`, `src/lib/registrations.test.ts`, `SETUP.md`
- Modify: `src/lib/registrations.ts`, `.env.example`, `README.md`

**Interfaces:**
- Consumes: `RegistrationBackend`, `LocalMockBackend` (existing), `RegistrationInput`.
- Produces: `readEnv(): { supabaseUrl: string | null; supabaseAnonKey: string | null; organiserEmails: string[]; turnstileSiteKey: string | null }`; `class SupabaseBackend implements RegistrationBackend` with constructor `(url: string, anonKey: string, fetchImpl?: typeof fetch)`; `createBackend()` returns `SupabaseBackend` when url and key are set, else the mock. `mapRegisterError(status: number, body: {error?: string}): string` exported for tests.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/registrations.test.ts
import { describe, expect, it, vi } from 'vitest';
import { SupabaseBackend, mapRegisterError } from './registrations';
import { EMPTY_REGISTRATION } from './validation';

const input = { ...EMPTY_REGISTRATION, name: 'Asha Rao', email: 'asha@gmail.com', department: 'CSE', classYear: '2nd', phone: '9876543210', laptop: true };

describe('SupabaseBackend.register', () => {
  it('posts to the register function and returns the ticket number', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ticketNo: 12, qrUrl: 'https://x/c/12.abc' }), { status: 201 }));
    const b = new SupabaseBackend('https://proj.supabase.co', 'anon', fetchImpl as unknown as typeof fetch);
    await expect(b.register(input)).resolves.toEqual({ ticketNo: 12 });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://proj.supabase.co/functions/v1/register');
    expect((init.headers as Record<string, string>).apikey).toBe('anon');
    expect(JSON.parse(init.body as string).email).toBe('asha@gmail.com');
  });
  it('turns a 409 into the duplicate message', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: 'duplicate' }), { status: 409 }));
    const b = new SupabaseBackend('https://proj.supabase.co', 'anon', fetchImpl as unknown as typeof fetch);
    await expect(b.register(input)).rejects.toThrow('already has a ticket');
  });
});

describe('mapRegisterError', () => {
  it('maps known errors to friendly copy', () => {
    expect(mapRegisterError(409, { error: 'duplicate' })).toMatch(/already has a ticket/);
    expect(mapRegisterError(429, { error: 'rate_limited' })).toMatch(/Too many tries/);
    expect(mapRegisterError(400, { error: 'invalid_email' })).toMatch(/Gmail/);
    expect(mapRegisterError(500, {})).toMatch(/try again/);
  });
});
```

- [ ] **Step 2: Run to verify it fails** → `npm test -- src/lib/registrations.test.ts` FAIL, `SupabaseBackend` not exported.

- [ ] **Step 3: Implement env + adapter**

```ts
// src/lib/env.ts
export function readEnv() {
  const e = import.meta.env;
  return {
    supabaseUrl: (e.VITE_SUPABASE_URL as string | undefined) || null,
    supabaseAnonKey: (e.VITE_SUPABASE_ANON_KEY as string | undefined) || null,
    organiserEmails: ((e.VITE_ORGANISER_EMAILS as string | undefined) ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
    turnstileSiteKey: (e.VITE_TURNSTILE_SITE_KEY as string | undefined) || null,
  };
}
```

Add to `src/lib/registrations.ts` (keep `LocalMockBackend`):

```ts
import { readEnv } from './env';

export function mapRegisterError(status: number, body: { error?: string }): string {
  if (status === 409) return 'This Gmail already has a ticket. Sign in to see it.';
  if (status === 429) return 'Too many tries from this network. Wait a few minutes and try again.';
  if (status === 400 && body.error === 'invalid_email') return 'Use a personal Gmail address ending in @gmail.com.';
  if (status === 400 && body.error === 'turnstile') return 'Please complete the human check and try again.';
  if (status === 400) return 'Something in the form isn’t right. Check the fields and try again.';
  return 'Something went wrong. Please try again.';
}

export class SupabaseBackend implements RegistrationBackend {
  constructor(private url: string, private anonKey: string, private fetchImpl: typeof fetch = fetch) {}

  async register(input: RegistrationInput): Promise<RegistrationResult> {
    const res = await this.fetchImpl(`${this.url.replace(/\/$/, '')}/functions/v1/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: this.anonKey, Authorization: `Bearer ${this.anonKey}` },
      body: JSON.stringify({
        name: input.name.trim(),
        email: normaliseEmail(input.email),
        department: input.department,
        classYear: input.classYear,
        phone: input.phone.replace(/\s+/g, ''),
        githubUsername: input.noGithubYet ? '' : input.githubUsername.trim(),
        laptop: input.laptop,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { ticketNo?: number; error?: string };
    if (!res.ok || typeof body.ticketNo !== 'number') throw new Error(mapRegisterError(res.status, body));
    return { ticketNo: body.ticketNo };
  }
}

export function createBackend(): RegistrationBackend {
  const { supabaseUrl, supabaseAnonKey } = readEnv();
  if (supabaseUrl && supabaseAnonKey) return new SupabaseBackend(supabaseUrl, supabaseAnonKey);
  return new LocalMockBackend();
}
```

- [ ] **Step 4: Run tests** → `npm test` all PASS; `npm run build` clean.

- [ ] **Step 5: Write SETUP.md** (numbered, copy-pasteable)

```markdown
# Setup: Supabase + Vercel

1. Create a free project at supabase.com → note Project URL and anon key (Settings → API).
2. Install CLI: `npm i -g supabase` (or use `npx supabase`). `supabase login`, then `supabase link --project-ref <ref>`.
3. Apply the schema: `supabase db push`.
4. Secrets for the function: `supabase secrets set TICKET_HMAC_SECRET=$(openssl rand -hex 32) SITE_URL=https://git-workshop-site.vercel.app` (add `TURNSTILE_SECRET_KEY=...` later if you enable Turnstile).
5. Deploy the function: `supabase functions deploy register --no-verify-jwt`.
6. Add organisers: in the SQL editor, `insert into organisers(email) values ('you@gmail.com');`.
7. Google sign-in (phase 3): Authentication → Providers → Google; create an OAuth client in Google Cloud with redirect `https://<ref>.supabase.co/auth/v1/callback`.
8. Vercel: Project → Settings → Environment Variables → `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ORGANISER_EMAILS` (comma separated). Redeploy.
9. Local: copy `.env.example` to `.env` and paste the same values; `npm run dev`.
```

Update `README.md` to point at SETUP.md and describe the mock fallback.

- [ ] **Step 6: Commit and push**

```bash
git add -A
git commit -m "feat(backend): supabase register adapter, env switch and setup guide"
git push
```

Expected: Vercel auto-deploys; `https://git-workshop-site.vercel.app` shows the animated ticket (mock backend until env vars exist).

---

## Self-review

- Spec coverage: TicketStage states 0–3 (Tasks 2–3), data model + RLS (Task 4), `register` function with numbering, token hash, rate limit, Turnstile (Task 4), adapter + mock fallback + env (Task 5), error copy (Task 5), reduced motion (Tasks 2–3), video fallbacks (Tasks 2–3). States 4–5 and `/checkin` are phase 3 by design.
- Placeholders: none; every step has code.
- Type consistency: `RegistrationBackend.register(input): Promise<{ticketNo:number}>` is used identically in Tasks 3 and 5; `TicketEvent` names match between Tasks 1–3; `signTicket/verifyTicket/sha256Hex/randomToken` names match between the test and the function.
