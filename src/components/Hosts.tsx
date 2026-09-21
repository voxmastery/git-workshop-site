import { EVENT } from '../data/event';

export function Hosts() {
  return (
    <section className="section" id="hosts">
      <div className="section-head">
        <p className="kicker">Hosts</p>
        <h2 className="display">Your guides</h2>
      </div>
      <div className="hosts">
        {EVENT.hosts.map((h) => (
          <div className="host" key={h.name}>
            <div className="ring">
              <div aria-hidden="true">{h.name[0]}</div>
            </div>
            <div>
              <h3>{h.name}</h3>
              <p>{h.bio}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
