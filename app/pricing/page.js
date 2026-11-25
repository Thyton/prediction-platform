import Link from "next/link";

export const metadata = { title: "Pricing — TipLab" };

function Row({ k, free, pro }) {
  return (
    <tr>
      <td>{k}</td>
      <td>{free}</td>
      <td>{pro}</td>
    </tr>
  );
}

export default function Pricing() {
  return (
    <>
      <section className="hero narrow" style={{ maxWidth: 640 }}>
        <p className="eyebrow">PRICING</p>
        <h1>Everything public.<br /><em>Live signals on top.</em></h1>
        <p className="lede">
          Picks and the graded record are free and always will be — the record only means something if
          anyone can check it. Pro adds the in-game layer.
        </p>
      </section>

      <section style={{ maxWidth: 640, margin: "0 auto" }}>
        <table>
          <thead>
            <tr><th>What</th><th>Free</th><th>Pro</th></tr>
          </thead>
          <tbody>
            <Row k="Every released pick" free="✓" pro="✓" />
            <Row k="Full graded record, wins and losses" free="✓" pro="✓" />
            <Row k="Integrity alerts" free="✓" pro="✓" />
            <Row k="Track picks and keep your own record" free="✓" pro="✓" />
            <Row k="Live in-play signals" free="Newest only" pro="All of them" />
            <Row k="Browser alerts when a signal fires" free="—" pro="✓" />
            <Row k="Price" free="$0" pro="$9 / month" />
          </tbody>
        </table>
      </section>

      <section className="cards" style={{ maxWidth: 640, margin: "24px auto 0" }}>
        <article>
          <p className="eyebrow">PRO</p>
          <h3>$9 a month</h3>
          <p>
            A signal the moment your pick's game turns — hold, get in, get out — with an alert so you
            hear it without watching the screen. Founding members keep this price for life.
          </p>
          <p style={{ marginTop: 12 }}>
            <Link className="btn" href="/login">Create an account →</Link>
          </p>
          <p className="muted-note" style={{ marginTop: 8 }}>
            Upgrade from your dashboard once you are in.
          </p>
        </article>
        <article>
          <p className="eyebrow">THE DEAL</p>
          <h3>No lock-in</h3>
          <p>
            $9 monthly through Stripe, cancel whenever. During beta everything except the live signals
            is open to everyone, so you can judge the record before paying anything.
          </p>
          <p className="muted-note" style={{ marginTop: 12 }}>
            Not a bookmaker. No money wagered on your behalf.
          </p>
        </article>
      </section>
    </>
  );
}
