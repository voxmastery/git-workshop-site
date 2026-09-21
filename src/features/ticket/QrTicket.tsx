import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { EVENT } from '../../data/event';
import type { Registration } from '../../lib/registrations';
import { formatTicketNo } from '../../lib/validation';

type Props = {
  registration: Registration;
  onSave: () => void;
  saving: boolean;
  saveError: string | null;
};

/**
 * The student's ticket: the painted golden ticket (public/img/golden-ticket.webp, 2752x1536, tilted ≈ -3.9°)
 * with their details written on the cream area and their real QR laid over the printed QR square.
 * All positions are percentages of the image so it scales with the viewport.
 */
export function QrTicket({ registration, onSave, saving, saveError }: Props) {
  const [qr, setQr] = useState<string | null>(null);
  const ticketNo = formatTicketNo(registration.ticketNo);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(registration.qrUrl, { margin: 0, width: 360, errorCorrectionLevel: 'M', color: { dark: '#2b1d4f', light: '#ffffff' } })
      .then((url) => alive && setQr(url))
      .catch(() => alive && setQr(null));
    return () => {
      alive = false;
    };
  }, [registration.qrUrl]);

  const saved = Boolean(registration.savedToEmail);

  return (
    <div className="gt-wrap">
      <div className="gt" data-ticket={ticketNo} role="img" aria-label={`Ticket ${ticketNo} for ${registration.name}`}>
        <picture>
          <source srcSet="/img/golden-ticket.webp" type="image/webp" />
          <img className="gt-img" src="/img/golden-ticket.png" alt="" draggable={false} />
        </picture>

        {/* red stub */}
        <div className="gt-stub">
          <span className="gt-day">{EVENT.dateDay}</span>
          <span className="gt-mon">{EVENT.dateMonth}</span>
          <span className="gt-no">{ticketNo}</span>
        </div>

        {/* cream area, left of the QR */}
        <div className="gt-text">
          <span className="gt-kicker">
            {EVENT.name} · {EVENT.chapter}
          </span>
          <span className="gt-name">{registration.name}</span>
          <span className="gt-line">
            {registration.department} · {registration.classYear} year
            {registration.githubUsername ? ` · @${registration.githubUsername}` : ''}
          </span>
          <span className="gt-line">
            {EVENT.dateLabel} · {EVENT.session}
          </span>
          <span className="gt-line gt-venue">{EVENT.venue}</span>
        </div>

        {/* real QR over the printed one */}
        <div className="gt-qr">{qr && <img src={qr} alt="" draggable={false} />}</div>
      </div>

      <div className="save-box">
        {saved ? (
          <p className="saved">
            Saved to <strong>{registration.savedToEmail}</strong>. Open this page signed in and your ticket is here. Show the QR at the door.
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
