export const metadata = { title: "Privacy — TipLab" };

export default function Privacy() {
  return (
    <section className="hero narrow" style={{ maxWidth: 640 }}>
      <p className="eyebrow">PRIVACY</p>
      <h1 style={{ fontSize: "1.6rem" }}>Privacy policy</h1>
      <div style={{ color: "var(--muted)", fontSize: 15, display: "grid", gap: 14 }}>
        <p><strong style={{color:"var(--ink)"}}>What we collect.</strong> Only your email address and password (stored as a salted hash). We never see or store your card details — payments run entirely on Stripe.</p>
        <p><strong style={{color:"var(--ink)"}}>What we don&apos;t do.</strong> No ad trackers, no data selling, no third-party analytics cookies. No betting platform can access your TipLab account.</p>
        <p><strong style={{color:"var(--ink)"}}>Emails.</strong> Used for sign-in and subscription receipts only. You can request deletion any time by replying to any TipLab email.</p>
        <p><strong style={{color:"var(--ink)"}}>Data sources.</strong> Scores and prices come from public sports feeds (ESPN and bo3.gg). Ratings and picks are computed by TipLab.</p>
        <p><em>Last updated 23 November 2026.</em></p>
      </div>
    </section>
  );
}
