import { forwardRef, type ReactNode } from 'react';
import { EVENT } from '../../data/event';
import { Octicon, type IconName } from './Octicon';

type Props = {
  /** name typed so far, shown live on the stub */
  stubName: string;
  children: ReactNode;
};

const STICKERS: { name: IconName; bg: string; fg: string }[] = [
  { name: 'pull-request', bg: '#ffffff', fg: '#24292f' },
  { name: 'merge', bg: '#8957e5', fg: '#ffffff' },
  { name: 'fork', bg: '#2f81f7', fg: '#ffffff' },
  { name: 'star', bg: '#ffffff', fg: '#f2c14e' },
  { name: 'github', bg: '#24292f', fg: '#ffffff' },
  { name: 'git', bg: '#ffffff', fg: '#f05033' },
];

/**
 * A carnival ticket built entirely from DOM + CSS.
 * Top half: event header. Bottom half: the form, joined by a perforation.
 */
export const CssTicket = forwardRef<HTMLDivElement, Props>(function CssTicket({ stubName, children }, ref) {
  return (
    <div className="ct" ref={ref}>
      <div className="ct-half ct-top">
        <div className="ct-stub">
          <span className="ct-day">{EVENT.dateDay}</span>
          <span className="ct-mon">{EVENT.dateMonth}</span>
          <span className="ct-who">{stubName ? stubName.toUpperCase() : 'ADMIT ONE'}</span>
        </div>
        <div className="ct-head">
          <span className="ct-kicker">{EVENT.kicker}</span>
          <h1 className="ct-title">
            Git &amp; GitHub
            <br />
            Workshop
          </h1>
          <span className="ct-chapter">{EVENT.chapter}</span>
          <div className="ct-chips">
            <span>{EVENT.session}</span>
            <span>{EVENT.venueShort}</span>
            <span className="ct-free">Free</span>
          </div>
        </div>
      </div>

      <div className="ct-perf" aria-hidden="true" />

      <div className="ct-half ct-bottom">
        <div className="ct-face">{children}</div>
        <div className="ct-stickers" aria-hidden="true">
          {STICKERS.map((s) => (
            <span key={s.name} className="ct-stk" style={{ background: s.bg, color: s.fg }}>
              <Octicon name={s.name} size={14} />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
});
