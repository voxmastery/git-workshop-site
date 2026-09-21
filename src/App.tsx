import { useCallback, useEffect, useRef, useState } from 'react';
import { CssTicket } from './features/ticket/CssTicket';
import { QrTicket } from './features/ticket/QrTicket';
import { TicketForm } from './features/ticket/TicketForm';
import { createAuth } from './lib/auth';
import { createBackend, type Registration } from './lib/registrations';
import { EMPTY_REGISTRATION, type RegistrationInput } from './lib/validation';
import './features/ticket/ticket.css';

const DROP_NO_DATA_MS = 2500;
const DROP_HARD_CAP_MS = 8000;

type Phase = 'scrub' | 'submitting' | 'dropping' | 'ticket';

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

export default function App() {
  const reduced = usePrefersReducedMotion();
  const [phase, setPhase] = useState<Phase>('scrub');
  const [form, setForm] = useState<RegistrationInput>(EMPTY_REGISTRATION);
  const [serverError, setServerError] = useState<string | null>(null);
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dropFailed, setDropFailed] = useState(false);
  const dropVideo = useRef<HTMLVideoElement>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  // Returning visitor / OAuth redirect: show their saved ticket straight away.
  useEffect(() => {
    let alive = true;
    (async () => {
      const user = await auth.current();
      if (!user || !alive) return;
      try {
        const mine = await backend.mine(user.email);
        if (!alive || !mine) return;
        setRegistration(mine.savedToEmail ? mine : await backend.claim(user.email));
        setPhase('ticket');
      } catch {
        /* no ticket for this account: normal flow */
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
    const cap = setTimeout(() => setPhase('ticket'), DROP_HARD_CAP_MS);
    return () => {
      clearTimeout(noData);
      clearTimeout(cap);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'dropping' || !dropFailed) return;
    const t = setTimeout(() => setPhase('ticket'), 1100);
    return () => clearTimeout(t);
  }, [phase, dropFailed]);

  useEffect(() => {
    if (phase === 'ticket') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [phase]);

  const submit = useCallback(async () => {
    setPhase('submitting');
    setServerError(null);
    try {
      const reg = await backend.register(form);
      setRegistration(reg);
      setPhase(reduced ? 'ticket' : 'dropping');
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      setPhase('scrub');
    }
  }, [form, reduced]);

  const signInExisting = useCallback(async () => {
    setSigningIn(true);
    setSignInError(null);
    try {
      const user = await auth.signInWithGoogle();
      if (!user) return; // real OAuth redirects; the mount effect loads the ticket on return
      const mine = await backend.mine(user.email);
      if (!mine) {
        setSignInError(`No ticket is registered to ${user.email}. Scroll down and punch one.`);
        await auth.signOut();
        return;
      }
      setRegistration(mine.savedToEmail ? mine : await backend.claim(user.email));
      setPhase('ticket');
    } catch {
      setSignInError('Sign-in did not go through. Please try again.');
    } finally {
      setSigningIn(false);
    }
  }, []);

  const save = useCallback(async () => {
    if (!registration) return;
    setSaving(true);
    setSaveError(null);
    try {
      const user = await auth.signInWithGoogle(registration.email);
      if (!user) return;
      if (user.email !== registration.email) {
        setSaveError(`That Google account (${user.email}) doesn’t match the Gmail on your ticket (${registration.email}). Sign in with the Gmail you used.`);
        await auth.signOut();
        return;
      }
      setRegistration(await backend.claim(user.email));
    } catch (e) {
      setSaveError(
        e instanceof Error && e.message === 'NO_MATCH'
          ? 'This Google account doesn’t match the Gmail on your ticket. Use the Gmail you registered with.'
          : 'Could not save the ticket. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  }, [registration]);

  return (
    <div className="app">
      {phase !== 'ticket' && (
        <div className="signin-corner">
          <button type="button" className="signin-link" onClick={signInExisting} disabled={signingIn}>
            {signingIn ? 'Opening Google…' : 'Sign in'}
          </button>
          {signInError && (
            <span className="err" role="alert">
              {signInError}
            </span>
          )}
        </div>
      )}

      {phase !== 'ticket' && (
        <div className={`ct-stage phase-${phase}`}>
            <div className={`ct-wrap${reduced ? '' : ' intro'}`}>
              <CssTicket stubName={form.name.trim()}>
                <TicketForm
                  value={form}
                  onChange={setForm}
                  onSubmit={submit}
                  disabled={phase === 'submitting'}
                  serverError={serverError}
                  extra={
                    serverError?.includes('already has a ticket') ? (
                      <button type="button" className="signin-inline" onClick={signInExisting} disabled={signingIn}>
                        {signingIn ? 'Opening Google…' : 'Sign in with that Gmail to see your ticket'}
                      </button>
                    ) : null
                  }
                />
              </CssTicket>
            </div>

            {phase === 'dropping' && (
              <div className="drop-layer">
                {!dropFailed ? (
                  <video ref={dropVideo} className="drop-video" autoPlay muted playsInline preload="auto" poster="/img/box-poster.jpg" onEnded={() => setPhase('ticket')} onError={() => setDropFailed(true)}>
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

      {phase === 'ticket' && registration && (
        <main className="ticket-screen">
          <video className="bg-loop" autoPlay muted loop playsInline poster="/img/box-poster.jpg" aria-hidden="true" onError={(e) => ((e.currentTarget as HTMLVideoElement).style.display = 'none')}>
            <source src="/video/box-idle.webm" type="video/webm" />
            <source src="/video/box-idle.mp4" type="video/mp4" />
          </video>
          <div className="see-you">
            <p className="kicker">See you soon at the workshop</p>
          </div>
          <QrTicket registration={registration} onSave={save} saving={saving} saveError={saveError} />
        </main>
      )}
    </div>
  );
}
