import { useCallback, useEffect, useRef, useState } from 'react';
import { EVENT } from './data/event';
import { FrameScrubber } from './features/scrub/FrameScrubber';
import { QrTicket } from './features/ticket/QrTicket';
import { TicketForm } from './features/ticket/TicketForm';
import { createAuth } from './lib/auth';
import { createBackend, type Registration } from './lib/registrations';
import { progressForRect } from './lib/scrub';
import { EMPTY_REGISTRATION, type RegistrationInput } from './lib/validation';

const FRAME_COUNT = 169; // 24 fps frames of ticket-unfold.mp4
const FRAME_W = 540;
const FRAME_H = 960;
const FORM_AT = 0.9; // scroll progress at which the form appears on the open ticket (unfold is done by ~0.5)
const SCRUB_EASE = 0.14; // per-frame easing toward the scroll target; lower = smoother, laggier
const DROP_NO_DATA_MS = 2500; // if the drop clip has no data by then, use the CSS flash instead
const DROP_HARD_CAP_MS = 8000; // never sit on the drop step longer than this

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

/** Scroll progress of the track, eased every animation frame so the scrub glides instead of stepping. */
function useSmoothScrollProgress(track: React.RefObject<HTMLDivElement | null>, reduced: boolean) {
  const [progress, setProgress] = useState(0);
  const target = useRef(0);
  const current = useRef(0);

  useEffect(() => {
    const measure = () => {
      const el = track.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      target.current = progressForRect(r.top, r.height, window.innerHeight);
    };
    measure();
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);

    let raf = 0;
    const tick = () => {
      const diff = target.current - current.current;
      if (reduced || Math.abs(diff) < 0.0008) current.current = target.current;
      else current.current += diff * SCRUB_EASE;
      setProgress((p) => (Math.abs(p - current.current) < 0.0004 ? p : current.current));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
      cancelAnimationFrame(raf);
    };
  }, [track, reduced]);

  return progress;
}

export default function App() {
  const reduced = usePrefersReducedMotion();
  const track = useRef<HTMLDivElement>(null);
  const progress = useSmoothScrollProgress(track, reduced);
  const [phase, setPhase] = useState<Phase>('scrub');
  const [form, setForm] = useState<RegistrationInput>(EMPTY_REGISTRATION);
  const [serverError, setServerError] = useState<string | null>(null);
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dropFailed, setDropFailed] = useState(false);
  const dropVideo = useRef<HTMLVideoElement>(null);

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

  const formVisible = phase === 'scrub' && progress >= FORM_AT;

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

  const save = useCallback(async () => {
    if (!registration) return;
    setSaving(true);
    setSaveError(null);
    try {
      const user = await auth.signInWithGoogle(registration.email);
      if (!user) return; // real OAuth redirects; the mount effect finishes the claim on return
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
      <a className="brand" href="https://github.com/voxmastery/git-workshop-site" target="_blank" rel="noreferrer">
        {EVENT.kicker}
      </a>

      {phase !== 'ticket' && (
        <div className="track" ref={track} style={{ height: '300vh' }}>
          <div className={`stage phase-${phase}${formVisible ? ' form-visible' : ''}`}>
            <div className={`frames-wrap${reduced ? '' : ' intro'}`}>
              <FrameScrubber progress={progress} frameCount={FRAME_COUNT} basePath="/frames/ticket" width={FRAME_W} height={FRAME_H} className="frames" />
            </div>

            <div className={`hint${progress < 0.06 ? ' show' : ''}`} aria-hidden="true">
              <span className="hint-arrow">⌄</span>
              <span>Scroll to open your ticket</span>
            </div>

            <div className={`ticket-face${formVisible || phase === 'submitting' ? ' show' : ''}`}>
              <h1 className="display">
                {EVENT.name}
                <small>{EVENT.chapter}</small>
              </h1>
              <p className="meta">
                {EVENT.dateLabel} · {EVENT.session} · {EVENT.venueShort} · Free
              </p>
              <TicketForm value={form} onChange={setForm} onSubmit={submit} disabled={phase === 'submitting'} serverError={serverError} />
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
