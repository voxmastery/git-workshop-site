import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { EVENT } from '../../data/event';
import type { Registration } from '../../lib/registrations';
import { layoutForTicket } from '../../lib/ticketLayout';
import { formatTicketNo } from '../../lib/validation';

const STICKER_GLYPH: Record<string, string> = {
  'pull-request': '⎇',
  merge: '⇄',
  fork: '⑂',
  star: '★',
  octocat: '🐱',
  git: '◆',
};

type Props = {
  registration: Registration;
  onSave: () => void;
  saving: boolean;
  saveError: string | null;
};

export function QrTicket({ registration, onSave, saving, saveError }: Props) {
  const [qr, setQr] = useState<string | null>(null);
  const layout = layoutForTicket(registration.ticketNo);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(registration.qrUrl, { margin: 1, width: 220, color: { dark: '#2b1d4f', light: '#f6d9b8' } })
      .then((url) => alive && setQr(url))
      .catch(() => alive && setQr(null));
    return () => {
      alive = false;
    };
  }, [registration.qrUrl]);

  const saved = Boolean(registration.savedToEmail);

  return (
    <div className="qr-wrap">
      <div className="qr-ticket" style={{ transform: `rotate(${layout.tilt}deg)` }} data-ticket={formatTicketNo(registration.ticketNo)}>
        <div className="qr-stub" style={{ background: layout.stubColour }}>
          <div className="day">{EVENT.dateDay}</div>
          <div className="mon">{EVENT.dateMonth}</div>
          <div className="no">{formatTicketNo(registration.ticketNo)}</div>
        </div>
        <div className="qr-body">
          <p className="kicker">{EVENT.name} · {EVENT.chapter}</p>
          <h2 className="display">{registration.name}</h2>
          <p className="meta">
            {registration.department} · {registration.classYear} year
          </p>
          <p className="meta">
            {EVENT.dateLabel} · {EVENT.session}
            <br />
            {EVENT.venue}
          </p>
          <div className="qr-row">
            {qr ? <img src={qr} alt={`QR code for ticket ${formatTicketNo(registration.ticketNo)}`} width={110} height={110} /> : <div className="qr-ph" />}
            <div className="qr-note">
              Show this at the door.
              <br />
              <strong>Bring your laptop + charger.</strong>
            </div>
          </div>
          <div className="stickers" aria-hidden="true">
            {layout.stickers.map((s, i) => (
              <span key={i} className={`stk stk-${s}`}>
                {STICKER_GLYPH[s]}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="save-box">
        {saved ? (
          <p className="saved">
            Saved to <strong>{registration.savedToEmail}</strong>. Open this page signed in and your ticket is here.
          </p>
        ) : (
          <>
            <p>Sign in with the same Gmail to save this ticket to your account.</p>
            <button className="google" type="button" onClick={onSave} disabled={saving}>
              {saving ? 'Opening Google…' : 'Continue with Google to save it'}
            </button>
            {saveError && (
              <p className="err" role="alert">
                {saveError}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
