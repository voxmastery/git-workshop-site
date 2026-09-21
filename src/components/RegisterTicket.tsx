import { useMemo, useState, type FormEvent } from 'react';
import { CLASS_YEARS, DEPARTMENTS, EVENT } from '../data/event';
import { createBackend } from '../lib/registrations';
import {
  EMPTY_REGISTRATION,
  formatTicketNo,
  validateRegistration,
  type RegistrationInput,
} from '../lib/validation';

const backend = createBackend();

export function RegisterTicket() {
  const [form, setForm] = useState<RegistrationInput>(EMPTY_REGISTRATION);
  const [touched, setTouched] = useState<Partial<Record<keyof RegistrationInput, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [ticketNo, setTicketNo] = useState<number | null>(null);
  const [honeypot, setHoneypot] = useState('');

  const errors = useMemo(() => validateRegistration(form), [form]);

  function update<K extends keyof RegistrationInput>(key: K, value: RegistrationInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  function touch(key: keyof RegistrationInput) {
    setTouched((t) => ({ ...t, [key]: true }));
  }
  function fieldClass(key: keyof RegistrationInput) {
    const filled = key === 'laptop' ? form.laptop !== null : String(form[key] ?? '').trim() !== '';
    return `field${filled && !errors[key] ? ' ok' : ''}`;
  }
  function showError(key: keyof RegistrationInput): string | undefined {
    return touched[key] ? errors[key] : undefined;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched({ name: true, email: true, department: true, classYear: true, phone: true, githubUsername: true, laptop: true });
    if (honeypot) return;
    if (Object.keys(errors).length > 0) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const result = await backend.register(form);
      setTicketNo(result.ticketNo);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const stubName = form.name.trim() || 'YOUR NAME';

  return (
    <section className="section" id="register">
      <div className="section-head">
        <p className="kicker">Register free</p>
        <h2 className="display">Punch your ticket</h2>
        <p>Limited seats. Beginners and non-CS branches welcome.</p>
      </div>
      <div className="register">
        <video className="bg" autoPlay muted loop playsInline poster="/img/box-poster.jpg" aria-hidden="true" onError={(e) => ((e.currentTarget as HTMLVideoElement).style.display = 'none')}>
          <source src="/video/box-idle.mp4" type="video/mp4" />
        </video>
        <div className="ticket">
          <div className="stub">
            <div className="day">{EVENT.dateDay}</div>
            <div className="mon">{EVENT.dateMonth}</div>
            <div className="who">{ticketNo ? formatTicketNo(ticketNo) : stubName.toUpperCase()}</div>
          </div>
          <div className="body">
            <h3>{EVENT.name} · {EVENT.chapter}</h3>
            <div style={{ fontSize: '0.85rem', color: '#4a3b78' }}>
              {EVENT.dateLabel} · {EVENT.session} · {EVENT.venue}
            </div>

            {ticketNo ? (
              <div className="success" style={{ marginTop: 16 }}>
                <h3 style={{ fontSize: '2.4rem' }}>See you soon at the workshop.</h3>
                <p style={{ margin: 0 }}>
                  Your ticket is <strong className="mono">{formatTicketNo(ticketNo)}</strong>. Before you come:
                </p>
                <ol>
                  <li>Create a GitHub account at github.com</li>
                  <li>Install Git for your OS</li>
                  <li>
                    Run <code>git --version</code> in a terminal
                  </li>
                  <li>Screenshot it into the WhatsApp group</li>
                </ol>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#4a3b78' }}>
                  Google sign-in and your personal QR ticket arrive with the next update of this page.
                </p>
              </div>
            ) : (
              <form className="form" onSubmit={onSubmit} noValidate>
                <input className="hp" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} aria-hidden="true" />

                <div className={fieldClass('name')}>
                  <label htmlFor="name">Full name</label>
                  <input id="name" value={form.name} onChange={(e) => update('name', e.target.value)} onBlur={() => touch('name')} autoComplete="name" />
                  {showError('name') && <span className="err">{showError('name')}</span>}
                </div>

                <div className={fieldClass('email')}>
                  <label htmlFor="email">Personal Gmail</label>
                  <input id="email" type="email" inputMode="email" value={form.email} onChange={(e) => update('email', e.target.value)} onBlur={() => touch('email')} autoComplete="email" placeholder="you@gmail.com" />
                  {showError('email') && <span className="err">{showError('email')}</span>}
                </div>

                <div className="grid-2">
                  <div className={fieldClass('department')}>
                    <label htmlFor="department">Department</label>
                    <select id="department" value={form.department} onChange={(e) => update('department', e.target.value)} onBlur={() => touch('department')}>
                      <option value="">Choose…</option>
                      {DEPARTMENTS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    {showError('department') && <span className="err">{showError('department')}</span>}
                  </div>
                  <div className={fieldClass('classYear')}>
                    <label htmlFor="classYear">Class year</label>
                    <select id="classYear" value={form.classYear} onChange={(e) => update('classYear', e.target.value)} onBlur={() => touch('classYear')}>
                      <option value="">Choose…</option>
                      {CLASS_YEARS.map((y) => (
                        <option key={y} value={y}>{y} year</option>
                      ))}
                    </select>
                    {showError('classYear') && <span className="err">{showError('classYear')}</span>}
                  </div>
                </div>

                <div className={fieldClass('phone')}>
                  <label htmlFor="phone">Phone (WhatsApp)</label>
                  <input id="phone" type="tel" inputMode="numeric" value={form.phone} onChange={(e) => update('phone', e.target.value)} onBlur={() => touch('phone')} autoComplete="tel-national" placeholder="10 digits" />
                  {showError('phone') && <span className="err">{showError('phone')}</span>}
                </div>

                <div className={fieldClass('githubUsername')}>
                  <label htmlFor="github">GitHub username</label>
                  <input id="github" value={form.githubUsername} onChange={(e) => update('githubUsername', e.target.value)} onBlur={() => touch('githubUsername')} disabled={form.noGithubYet} placeholder="optional" />
                  <label className="toggle">
                    <input type="checkbox" checked={form.noGithubYet} onChange={(e) => update('noGithubYet', e.target.checked)} /> I’ll create one
                  </label>
                  {showError('githubUsername') && <span className="err">{showError('githubUsername')}</span>}
                </div>

                <div className={fieldClass('laptop')}>
                  <label>Bringing a laptop?</label>
                  <div className="toggle" role="radiogroup" aria-label="Bringing a laptop">
                    <label className="toggle"><input type="radio" name="laptop" checked={form.laptop === true} onChange={() => { update('laptop', true); touch('laptop'); }} /> Yes</label>
                    <label className="toggle"><input type="radio" name="laptop" checked={form.laptop === false} onChange={() => { update('laptop', false); touch('laptop'); }} /> No</label>
                  </div>
                  {showError('laptop') && <span className="err">{showError('laptop')}</span>}
                </div>

                {serverError && <div className="err" role="alert" style={{ color: '#b3261e' }}>{serverError}</div>}

                <button className="btn btn-primary" type="submit" disabled={submitting}>
                  {submitting ? 'Punching…' : 'Punch my ticket'}
                </button>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#4a3b78' }}>
                  By registering you’ll receive event updates on WhatsApp.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
