export const metadata = { title: "Privacy — TipLab" };

export default function Privacy() {
  return (
    <section className="hero narrow" style={{ maxWidth: 640 }}>
      <p className="eyebrow">PRIVACY</p>
      <h1 style={{ fontSize: "1.6rem" }}>Privacy policy</h1>
      <div style={{ color: "var(--muted)", fontSize: 15, display: "grid", gap: 14 }}>
        <p><strong style={{color:"var(--ink)"}}>What we collect.</strong> Only your email address and password (stored as a salted hash). We never see or store your card details — payments run entirely on Stripe.</p>
        <p><strong style={{color:"var(--ink)"}}>What we don&apos;t do.</strong> No ad trackers, no data selling, no third-party advertising cookies. No betting platform can access your TipLab account.</p>
        <p><strong style={{color:"var(--ink)"}}>Page measurement.</strong> We use Vercel Analytics, which is first-party and cookieless. It counts page views and referrers in aggregate; it does not fingerprint you or follow you to other sites.</p>
        <p><strong style={{color:"var(--ink)"}}>Emails.</strong> Used for sign-in, password resets, subscription receipts and — for Pro members — pick alerts if you enable them. You can request deletion any time by replying to any TipLab email.</p>
        <p><strong style={{color:"var(--ink)"}}>Data sources.</strong> Scores and prices come from public sports feeds (ESPN and bo3.gg). Ratings and picks are computed by TipLab.</p>
        <p><strong style={{color:"var(--ink)"}}>Contact.</strong> Data controller: Pinzak Network. Write to <a href="mailto:privacy@tiplab.io">privacy@tiplab.io</a> for access, correction or deletion.</p>
        <p><em>Last updated 26 November 2026.</em></p>
      </div>
    </section>
  );
}
