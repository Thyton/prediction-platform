export const metadata = { title: "Terms — TipLab" };

export default function Terms() {
  return (
    <section className="hero narrow" style={{ maxWidth: 640 }}>
      <p className="eyebrow">TERMS</p>
      <h1 style={{ fontSize: "1.6rem" }}>Terms of service</h1>
      <div style={{ color: "var(--muted)", fontSize: 15, display: "grid", gap: 14 }}>
        <p><strong style={{color:"var(--ink)"}}>1. What TipLab is.</strong> A research and tipping service. We publish data-driven suggestions for sports outcomes. We are not a bookmaker, not an operator, and we do not accept wagers.</p>
        <p><strong style={{color:"var(--ink)"}}>2. Not advice.</strong> Picks are informational. Nothing on TipLab is financial or betting advice, and no outcome is guaranteed. Past performance does not predict future results.</p>
        <p><strong style={{color:"var(--ink)"}}>3. Your responsibility.</strong> Any bet you place is your own decision at your own risk. You must be of legal gambling age in your jurisdiction and follow its laws. TipLab takes no responsibility for losses.</p>
        <p><strong style={{color:"var(--ink)"}}>4. Subscriptions.</strong> Pro costs $9/month, billed through Stripe, renews monthly, cancellable any time from your Stripe invoice link. No refunds for partial months.</p>
        <p><strong style={{color:"var(--ink)"}}>5. Accuracy.</strong> Our full record, wins and losses alike, is published at /record. We do not delete or re-date results.</p>
        <p><strong style={{color:"var(--ink)"}}>6. Changes.</strong> Material changes to these terms will be posted on this page.</p>
        <p><em>Last updated 23 November 2026.</em></p>
      </div>
    </section>
  );
}
