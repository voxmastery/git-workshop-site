import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { EVENT } from '../../data/event';
import type { Registration } from '../../lib/registrations';
import { formatTicketNo } from '../../lib/validation';

/**
 * The student's ticket: the painted golden ticket (public/img/golden-ticket.webp, 2752x1536, tilted ≈ -3.9°)
 * with their details on the cream area and their real QR over the printed QR square.
 * All positions are percentages of the image so it scales with the viewport.
 */
export function QrTicket({ registration }: { registration: Registration }) {
  const [qr, setQr] = useState<string | null>(null);
  const ticketNo = formatTicketNo(registration.ticketNo);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(registration.qrUrl, { margin: 0, width: 512, errorCorrectionLevel: 'M', color: { dark: '#2b1d4f', light: '#ffffff' } })
      .then((url) => alive && setQr(url))
      .catch(() => alive && setQr(null));
    return () => {
      alive = false;
    };
  }, [registration.qrUrl]);

  return (
    <div className="gt-wrap">
      <p className="kicker gt-top-line">See you soon at the workshop</p>
      <div className="gt" data-ticket={ticketNo} role="img" aria-label={`Ticket ${ticketNo} for ${registration.name}`}>
        <picture>
          <source srcSet="/img/golden-ticket.webp" type="image/webp" />
          <img className="gt-img" src="/img/golden-ticket.png" alt="" draggable={false} />
        </picture>

        <div className="gt-stub">
          <span className="gt-day">{EVENT.dateDay}</span>
          <span className="gt-mon">{EVENT.dateMonth}</span>
          <span className="gt-no">{ticketNo}</span>
        </div>

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

        <div className="gt-qr">{qr && <img src={qr} alt="" draggable={false} />}</div>
      </div>

      <div className="save-box">
        <p className="saved">
          {registration.savedToEmail ? (
            <>
              Saved to <strong>{registration.savedToEmail}</strong>. Open this page signed in and your ticket is here.
            </>
          ) : (
            <>Ticket {ticketNo}</>
          )}
        </p>
        <p>Show the QR at the door. Bring your laptop + charger.</p>
      </div>
    </div>
  );
}
