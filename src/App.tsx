import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CssTicket } from './features/ticket/CssTicket';
import { QrTicket } from './features/ticket/QrTicket';
import { TicketForm } from './features/ticket/TicketForm';
import { createAuth } from './lib/auth';
import { createBackend, type Registration } from './lib/registrations';
import { EMPTY_REGISTRATION, type RegistrationInput } from './lib/validation';
import './features/ticket/ticket.css';

const DROP_NO_DATA_MS = 2500;
const DROP_HARD_CAP_MS = 8000;

type Phase = 'form' | 'submitting' | 'dropping' | 'done' | 'ticket';

const auth = createAuth();
const backend = createBackend(() => auth.accessToken());

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

/** Scale the ticket down just enough that it always fits the screen, so nothing needs scrolling. */
function useFitScale(el: React.RefObject<HTMLDivElement | null>, deps: unknown[]) {
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const node = el.current;
    if (!node) return;
    const fit = () => {
      const h = node.offsetHeight;
      const w = node.offsetWidth;
      const availH = window.innerHeight - 20;
      const availW = window.innerWidth - 12;
      setScale(Math.min(1, availH / h, availW / w));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(node);
    window.addEventListener('resize', fit);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', fit);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return scale;
}

export default function App() {
  const reduced = usePrefersReducedMotion();
  const [phase, setPhase] = useState<Phase>('form');
  const [form, setForm] = useState<RegistrationInput>(EMPTY_REGISTRATION);
  const [serverError, setServerError] = useState<string | null>(null);
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [dropFailed, setDropFailed] = useState(false);
  const dropVideo = useRef<HTMLVideoElement>(null);
  const ticketEl = useRef<HTMLDivElement>(null);
  const scale = useFitScale(ticketEl, [phase, serverError]);

  // Returning visitor / back from Google: show their ticket straight away.
  useEffect(() => {
    let alive = true;
    (async () => {
      const user = await auth.current();
      if (!user || !alive) return;
      try {
        const mine = await backend.mine(user.email);
        if (!alive) return;
        if (!mine) {
          setAuthError(`No ticket is registered to ${user.email}. Fill the ticket below with that Gmail.`);
          await auth.signOut();
          return;
        }
        setRegistration(mine.savedToEmail ? mine : await backend.claim(user.email));
        setPhase('ticket');
      } catch {
        /* fall through to the form */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Drop step: play the clip; if it cannot start, flash instead; never hang.
  useEffect(() => {
    if (phase !== 'dropping') return;
    const noData = setTimeout(() => {
      const v = dropVideo.current;
      if (!v || v.readyState < 2) setDropFailed(true);
    }, DROP_NO_DATA_MS);
    const cap = setTimeout(() => setPhase('done'), DROP_HARD_CAP_MS);
    return () => {
      clearTimeout(noData);
      clearTimeout(cap);
    };
  }, [phase]);
  useEffect(() => {
    if (phase !== 'dropping' || !dropFailed) return;
    const t = setTimeout(() => setPhase('done'), 1100);
    return () => clearTimeout(t);
  }, [phase, dropFailed]);

  const submit = useCallback(async () => {
    setPhase('submitting');
    setServerError(null);
    try {
      const reg = await backend.register(form);
      setRegistration(reg);
      setPhase(reduced ? 'done' : 'dropping');
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      setPhase('form');
    }
  }, [form, reduced]);

  /** Google sign-in, used both by the "see your ticket" step and the top-corner button. */
  const signIn = useCallback(
    async (hintEmail?: string) => {
      setBusy(true);
      setAuthError(null);
      try {
        const user = await auth.signInWithGoogle(hintEmail);
        if (!user) return; // real OAuth redirects; the mount effect shows the ticket on return
        if (hintEmail && user.email !== hintEmail) {
          setAuthError(`That Google account (${user.email}) doesn’t match the Gmail on your ticket (${hintEmail}).`);
          await auth.signOut();
          return;
        }
        const mine = await backend.mine(user.email);
        if (!mine) {
          setAuthError(`No ticket is registered to ${user.email}. Use the Gmail you registered with.`);
          await auth.signOut();
          return;
        }
        setRegistration(mine.savedToEmail ? mine : await backend.claim(user.email));
        setPhase('ticket');
      } catch (e) {
        setAuthError(e instanceof Error && e.message === 'NO_MATCH' ? 'This Google account has no ticket. Use the Gmail you registered with.' : 'Sign-in did not go through. Please try again.');
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  return (
    <div className={`app phase-${phase}`}>
      {(phase === 'form' || phase === 'submitting') && (
        <div className="signin-corner">
          <button type="button" className="signin-link" onClick={() => signIn()} disabled={busy}>
            {busy ? 'Opening Google…' : 'Sign in'}
          </button>
          {authError && (
            <span className="err" role="alert">
              {authError}
            </span>
          )}
        </div>
      )}

      {(phase === 'form' || phase === 'submitting' || phase === 'dropping') && (
        <div className={`ct-stage phase-${phase}`}>
          <div className={`ct-wrap${reduced ? '' : ' intro'}`}>
            <div className="ct-fit" style={{ transform: `scale(${scale})` }}>
            <CssTicket ref={ticketEl} stubName={form.name.trim()}>
              <TicketForm
                value={form}
                onChange={setForm}
                onSubmit={submit}
                disabled={phase !== 'form'}
                serverError={serverError}
                extra={
                  serverError?.includes('already has a ticket') ? (
                    <button type="button" className="signin-inline" onClick={() => signIn(form.email.trim().toLowerCase())} disabled={busy}>
                      {busy ? 'Opening Google…' : 'Sign in with that Gmail to see your ticket'}
                    </button>
                  ) : null
                }
              />
            </CssTicket>
            </div>
          </div>

          {phase === 'dropping' && (
            <div className="drop-layer">
              {!dropFailed ? (
                <video ref={dropVideo} className="drop-video" autoPlay muted playsInline preload="auto" poster="/img/box-poster.jpg" onEnded={() => setPhase('done')} onError={() => setDropFailed(true)}>
                  <source src="/video/ticket-drop.webm" type="video/webm" />
                  <source src="/video/ticket-drop.mp4" type="video/mp4" />
                </video>
              ) : (
                <>
                  <img className="drop-video" src="/img/box-poster.jpg" alt="" />
                  <div className="flash" />
                </>
              )}
            </div>
          )}
        </div>
      )}

      {phase === 'done' && registration && (
        <main className="done-screen">
          <video className="bg-loop" autoPlay muted loop playsInline poster="/img/box-poster.jpg" aria-hidden="true" onError={(e) => ((e.currentTarget as HTMLVideoElement).style.display = 'none')}>
            <source src="/video/box-idle.webm" type="video/webm" />
            <source src="/video/box-idle.mp4" type="video/mp4" />
          </video>
          <div className="done-card">
            <h1 className="display">See you soon at the workshop.</h1>
            <p>
              Your ticket is in the box. Sign in with <strong>{registration.email}</strong> to see it and save it to your account.
            </p>
            <button className="google" type="button" onClick={() => signIn(registration.email)} disabled={busy}>
              {busy ? 'Opening Google…' : 'Sign in with Google to see your ticket'}
            </button>
            {authError && (
              <p className="err" role="alert">
                {authError}
              </p>
            )}
          </div>
        </main>
      )}

      {phase === 'ticket' && registration && (
        <main className="ticket-screen">
          <video className="bg-loop" autoPlay muted loop playsInline poster="/img/box-poster.jpg" aria-hidden="true" onError={(e) => ((e.currentTarget as HTMLVideoElement).style.display = 'none')}>
            <source src="/video/box-idle.webm" type="video/webm" />
            <source src="/video/box-idle.mp4" type="video/mp4" />
          </video>
          <QrTicket registration={registration} />
        </main>
      )}
    </div>
  );
}
