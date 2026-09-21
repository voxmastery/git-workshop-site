import { TAKEAWAYS } from '../data/event';

export function Takeaways() {
  return (
    <section className="section" id="takeaways">
      <div className="section-head">
        <p className="kicker">Leave with</p>
        <h2 className="display">What you walk out with</h2>
      </div>
      <div className="badges">
        {TAKEAWAYS.map((t) => (
          <div className="badge" key={t.title}>
            <div className="ring" aria-hidden="true">
              {t.icon}
            </div>
            <div>
              <h3>{t.title}</h3>
              <p>{t.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
