const STEPS = ['create repo', 'commit', 'branch', 'pull request', 'merge', 'live'];

export function Timeline() {
  return (
    <section className="section" id="what">
      <div className="section-head">
        <p className="kicker">What</p>
        <h2 className="display">Three hours, hands-on.</h2>
        <p>You type every command yourself. Every internship, hackathon and team project runs on this.</p>
      </div>
      <div className="timeline">
        {STEPS.map((s, i) => (
          <div className={`step${s === 'merge' ? ' merge' : ''}`} key={s}>
            <div className="dot" />
            <div className="mono" style={{ fontSize: '0.75rem', color: 'var(--lavender)' }}>
              {String(i + 1).padStart(2, '0')}
            </div>
            <div className="label">{s}</div>
            {s === 'merge' && <span className="pill">Merged</span>}
          </div>
        ))}
      </div>
    </section>
  );
}
