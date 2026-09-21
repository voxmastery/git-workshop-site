import { useState } from 'react';
import { EVENT } from '../data/event';

export function Hero() {
  const [videoFailed, setVideoFailed] = useState(false);
  return (
    <header className="hero">
      {videoFailed ? (
        <img className="poster" src="/img/hero-poster.jpg" alt="" />
      ) : (
        <video
          autoPlay
          muted
          loop
          playsInline
          poster="/img/hero-poster.jpg"
          onError={() => setVideoFailed(true)}
          aria-hidden="true"
        >
          <source src="/video/hero-loop.mp4" type="video/mp4" />
        </video>
      )}
      <div className="hero-inner">
        <p className="kicker">{EVENT.kicker}</p>
        <h1 className="display">
          Git &amp; GitHub
          <br />
          Workshop
        </h1>
        <p className="sub">{EVENT.subhead}</p>
        <div className="chips">
          <span className="chip">
            <strong>{EVENT.dateLabel}</strong>
          </span>
          <span className="chip">{EVENT.session}</span>
          <span className="chip">{EVENT.venueShort}</span>
          <span className="chip">
            <strong>{EVENT.cost}</strong> · limited seats
          </span>
        </div>
        <div className="cta-row">
          <a className="btn btn-primary" href="#register">
            Grab a seat
          </a>
          <a className="btn btn-ghost" href="#agenda">
            See the agenda
          </a>
        </div>
      </div>
    </header>
  );
}
