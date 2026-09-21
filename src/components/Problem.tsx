const FILES = [
  { name: 'final.docx', bad: false },
  { name: 'final_v2.docx', bad: false },
  { name: 'final_v3_REAL_final.docx', bad: true },
  { name: 'final_v3_REAL_final (1).docx', bad: true },
];

export function Problem() {
  return (
    <section className="section" id="why">
      <div className="section-head">
        <p className="kicker">Who it’s for</p>
        <h2 className="display">Your code deserves a home.</h2>
        <p>If you’ve ever built something with AI and then lost it, this is for you.</p>
      </div>
      <div className="folder" aria-label="A folder full of badly named files">
        {FILES.map((f) => (
          <div className="folder-row" key={f.name}>
            <span aria-hidden="true">📄</span>
            <span className={`mono name${f.bad ? ' bad' : ''}`}>{f.name}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
