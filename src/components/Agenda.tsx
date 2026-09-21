import { AGENDA } from '../data/event';

export function Agenda() {
  return (
    <section className="section" id="agenda">
      <div className="section-head">
        <p className="kicker">Agenda</p>
        <h2 className="display">2:00 → 5:00</h2>
        <p>Check-in at 2:00. Teaching starts sharp at 2:30.</p>
      </div>
      <div className="agenda">
        {AGENDA.map((row) => (
          <div className="agenda-row" key={row.time}>
            <div className="t">{row.time}</div>
            <div>
              <div className="title">{row.title}</div>
              {row.text && <div className="text">{row.text}</div>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
