import { forwardRef, type ReactNode } from 'react';
import { EVENT } from '../../data/event';

type Props = {
  /** 0 = folded shut, 1 = fully open */
  openness: number;
  /** name typed so far, shown live on the stub */
  stubName: string;
  children: ReactNode;
};

const STICKERS: { key: string; glyph: string; bg: string; fg?: string }[] = [
  { key: 'pr', glyph: '⎇', bg: '#ffffff', fg: '#111' },
  { key: 'merge', glyph: '⇄', bg: '#8957e5', fg: '#fff' },
  { key: 'fork', glyph: '⑂', bg: '#2f81f7', fg: '#fff' },
  { key: 'star', glyph: '★', bg: '#ffffff', fg: '#f2c14e' },
  { key: 'cat', glyph: '🐱', bg: '#111', fg: '#fff' },
  { key: 'git', glyph: '◆', bg: '#f05033', fg: '#fff' },
];

/**
 * A carnival ticket built entirely from DOM + CSS.
 * Top half: event header. Bottom half: the form. The bottom half is hinged at the perforation and
 * folds up behind the top half; `openness` drives the CSS 3D rotation.
 */
export const CssTicket = forwardRef<HTMLDivElement, Props>(function CssTicket({ openness, stubName, children }, ref) {
  const angle = -180 + 180 * Math.min(1, Math.max(0, openness));
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

      <div className="ct-half ct-bottom" style={{ transform: `rotateX(${angle}deg)` }}>
        <div className="ct-face">{children}</div>
        <div className="ct-back" aria-hidden="true">
          <span className="ct-back-text">The First Commit</span>
          <div className="ct-stickers">
            {STICKERS.map((s) => (
              <span key={s.key} className="ct-stk" style={{ background: s.bg, color: s.fg }}>
                {s.glyph}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});
