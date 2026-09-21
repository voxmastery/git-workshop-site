import { FAQ } from '../data/event';

export function Faq() {
  return (
    <section className="section" id="faq">
      <div className="section-head">
        <p className="kicker">FAQ</p>
        <h2 className="display">Quick answers</h2>
      </div>
      <div className="faq">
        {FAQ.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
