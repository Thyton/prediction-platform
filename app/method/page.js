export const metadata = { title: "Method — TipLab" };

export default function Method() {
  return (
    <>
      <section className="hero" style={{ paddingBottom: 24 }}>
        <p className="eyebrow">METHOD</p>
        <h1>How a pick is made —<br /><em>and how it can be wrong.</em></h1>
        <p className="lede">
          TipLab is a market-aware desk. We do not claim every match is predictable, and we do not hide behind a
          black box. Below is exactly what happens before anything is released.
        </p>
      </section>

      <div className="cards">
        <article>
          <p className="eyebrow">1 · PRICE FIRST</p>
          <h3>The market is the baseline</h3>
          <p>
            Every candidate starts from the live price across the books we can read (up to 12 books on the
            major US sports). We strip the bookmaker margin (the vig) to get an implied probability, and that
            is the number the model has to beat.
          </p>
        </article>
        <article>
          <p className="eyebrow">2 · RATINGS</p>
          <h3>Team strength, learned daily</h3>
          <p>
            Each team carries an Elo-style rating that moves with every settled result — the winner gains, the
            loser drops, and margin of victory scales the move. Home advantage is added for team sports.
          </p>
        </article>
        <article>
          <p className="eyebrow">3 · EDGE</p>
          <h3>Only real agreement ships</h3>
          <p>
            A pick releases only when the market favourite also carries a 55–85% model probability, and the
            favourite is priced at odds of 2.00 or shorter. The model still gets a vote: if our ratings
            actively disagree with the favourite, the game is watched, not tipped.
          </p>
        </article>
        <article>
          <p className="eyebrow">4 · INTEGRITY</p>
          <h3>Thin and lopsided markets get flagged</h3>
          <p>
            One book quoting, or a price so short it says the match is barely competitive, is surfaced as a
            warning. Those are the games where a stale or manipulated line does the most damage.
          </p>
        </article>
        <article>
          <p className="eyebrow">5 · STAKING</p>
          <h3>Flat, so accuracy is readable</h3>
          <p>
            The public record is graded at one unit per pick. That keeps the number honest: a winning record
            cannot be faked by staking only the long prices.
          </p>
        </article>
        <article>
          <p className="eyebrow">6 · GRADING</p>
          <h3>Locked, then graded in public</h3>
          <p>
            Each pick stores its lock time, and nothing is ever published after a game has started. When the
            match finishes it is graded against the final score and stays visible forever, win or lose.
          </p>
        </article>
        <article>
          <p className="eyebrow">7 · LIVE</p>
          <h3>In-play signals for members</h3>
          <p>
            While a released pick's game is being played, the desk watches the live score and calls the moment:
            get in while the live price beats your locked one, hold when leading, or get out when the recovery
            window is closing. Signals are members-only and every one is stamped against the pick it belongs to.
          </p>
        </article>
      </div>

      <section className="cards" style={{ marginTop: 28 }}>
        <article>
          <p className="eyebrow">HONEST LIMITS</p>
          <h3>What this is not</h3>
          <p>
            Not financial advice, not a guarantee, and not a substitute for your own checks. Prediction accuracy
            is not the same as profit — the price you take still matters, and a 65% record at short prices can
            still lose money.
          </p>
        </article>
        <article>
          <p className="eyebrow">DATA</p>
          <h3>Where numbers come from</h3>
          <p>
            Fixtures, scores and prices come from public sports feeds (ESPN scoreboards, the bo3 esports API
            and a multi-book odds aggregator). Ratings are computed by TipLab; nothing is copied from another
            tipster. TipLab is a research and information service — we do not accept wagers, hold user funds,
            or operate as a bookmaker, and we are not affiliated with any sportsbook.
          </p>
        </article>
      </section>
    </>
  );
}
