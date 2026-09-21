import { useMemo, useState, type FormEvent } from 'react';
import { CLASS_YEARS, DEPARTMENTS } from '../../data/event';
import { validateRegistration, type RegistrationInput } from '../../lib/validation';

type Key = keyof RegistrationInput;
type Props = {
  value: RegistrationInput;
  onChange: (v: RegistrationInput) => void;
  onSubmit: () => void;
  disabled: boolean;
  serverError: string | null;
};

export function TicketForm({ value, onChange, onSubmit, disabled, serverError }: Props) {
  const [touched, setTouched] = useState<Partial<Record<Key, boolean>>>({});
  const [honeypot, setHoneypot] = useState('');
  const errors = useMemo(() => validateRegistration(value), [value]);

  const set = <K extends Key>(k: K, v: RegistrationInput[K]) => onChange({ ...value, [k]: v });
  const touch = (k: Key) => setTouched((t) => ({ ...t, [k]: true }));
  const filled = (k: Key) => String(value[k] ?? '').trim() !== '';
  const cls = (k: Key) => `field${filled(k) && !errors[k] ? ' ok' : ''}${touched[k] && errors[k] ? ' bad' : ''}`;
  const err = (k: Key) => (touched[k] && errors[k] ? <span className="err">{errors[k]}</span> : null);

  function submit(e: FormEvent) {
    e.preventDefault();
    setTouched({ name: true, email: true, department: true, classYear: true, phone: true, githubUsername: true });
    if (honeypot || Object.keys(errors).length) return;
    onSubmit();
  }

  return (
    <form className="ticket-form" onSubmit={submit} noValidate>
      <input className="hp" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} aria-hidden="true" />

      <label className={cls('name')}>
        <span>Full name</span>
        <input value={value.name} onChange={(e) => set('name', e.target.value)} onBlur={() => touch('name')} autoComplete="name" disabled={disabled} />
        {err('name')}
      </label>

      <label className={cls('email')}>
        <span>Personal Gmail</span>
        <input type="email" inputMode="email" value={value.email} onChange={(e) => set('email', e.target.value)} onBlur={() => touch('email')} autoComplete="email" placeholder="you@gmail.com" disabled={disabled} />
        {err('email')}
      </label>

      <div className="row">
        <label className={cls('department')}>
          <span>Department</span>
          <select value={value.department} onChange={(e) => set('department', e.target.value)} onBlur={() => touch('department')} disabled={disabled}>
            <option value="">Choose…</option>
            {DEPARTMENTS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          {err('department')}
        </label>
        <label className={cls('classYear')}>
          <span>Year</span>
          <select value={value.classYear} onChange={(e) => set('classYear', e.target.value)} onBlur={() => touch('classYear')} disabled={disabled}>
            <option value="">Choose…</option>
            {CLASS_YEARS.map((y) => (
              <option key={y} value={y}>
                {y} year
              </option>
            ))}
          </select>
          {err('classYear')}
        </label>
      </div>

      <label className={cls('phone')}>
        <span>Phone (WhatsApp)</span>
        <input type="tel" inputMode="numeric" value={value.phone} onChange={(e) => set('phone', e.target.value)} onBlur={() => touch('phone')} autoComplete="tel-national" placeholder="10 digits" disabled={disabled} />
        {err('phone')}
      </label>

      <label className={cls('githubUsername')}>
        <span>GitHub username</span>
        <input value={value.githubUsername} onChange={(e) => set('githubUsername', e.target.value)} onBlur={() => touch('githubUsername')} placeholder="optional" disabled={disabled || value.noGithubYet} />
        {err('githubUsername')}
      </label>
      <label className="check">
        <input type="checkbox" checked={value.noGithubYet} onChange={(e) => set('noGithubYet', e.target.checked)} disabled={disabled} /> I’ll create one
      </label>

      <p className="bring">Bring your laptop + charger. Phones won’t work for this one.</p>

      {serverError && (
        <div className="err" role="alert">
          {serverError}
        </div>
      )}

      <button className="punch" type="submit" disabled={disabled}>
        {disabled ? 'Punching…' : 'Punch my ticket'}
      </button>
    </form>
  );
}
