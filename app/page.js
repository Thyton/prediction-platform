import Link from "next/link";
import { getLive, getRecord, getGames, getIntegrity, fmtTime, SPORT_LABEL } from "../lib/data";
import Waitlist from "./waitlist";
import Tabs from "./tabs";

export const dynamic = "force-dynamic";

export default function Home() {
  const live = getLive();
  const record = getRecord();
  const games = getGames();
  const alerts = getIntegrity();
  const picks = live.picks || [];

  const today = picks.filter((p) => {
    const d = new Date(p.startsAt);
    const now = Date.now();
    return d.getTime() > now - 12 * 3600e3 && d.getTime() < now + 48 * 3600e3;
  });

  return (
    <>
      <section className="hero">
        <p className="eyebrow">TIMESTAMPED · EVERY SPORT · PUBLIC RECORD</p>
        <h1>Every pick locked,<br /><em>before the price moves.</em></h1>
        <p className="lede">
          We publish the match, the price, the model probability and the edge — then grade it in public.
          Market-aware across NBA, NFL, NHL, MLB, football, tennis and esports.
        </p>
        <Waitlist />
      </section>

      <div className="banner">
        <strong>Free during beta.</strong> Every pick, alert and result is open while we tune the model.
        Paid plans open at founding-member pricing.
      </div>

      <section id="tips">
        <div className="section-head">
          <div>
            <p className="eyebrow">THE DESK</p>
            <h2>Today&apos;s released picks</h2>
          </div>
          <span className="status">
            ● <b>{picks.length}</b> open · <b>{games.length}</b> games tracked ·{" "}
            <b>{alerts.length}</b> alerts
          </span>
        </div>

        <Tabs
          tips={
            today.length ? (
              <table>
                <thead>
                  <tr><th>Match</th><th>Play</th><th>Price</th><th>Edge</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {today.map((p) => (
                    <tr key={p.gameId}>
                      <td>
                        <span className="league">{SPORT_LABEL[p.sport] || p.league}</span>
                        {p.match}
                        <small>{fmtTime(p.startsAt)} · locked {fmtTime(p.lockTs)}</small>
                      </td>
                      <td>
                        <span className="side">{p.side.toUpperCase()}</span>
                        <small className={"tier " + p.tier}>{p.tier.toLowerCase()}</small>
                      </td>
                      <td>{Number(p.price).toFixed(2)}</td>
                      <td className="edge">
                        {(p.edgePct * 100).toFixed(0)}%
                        {p.modelPriced && <small className="tier">model price</small>}
                      </td>
                      <td className="pend">Pending</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty">
                No picks in the current window. The board refills on the next scan — we never pad it with filler.
              </div>
            )
          }
          results={
            record.recent.length ? (
              <table>
                <thead>
                  <tr><th>Match</th><th>Play</th><th>Price</th><th>Result</th><th>Units</th></tr>
                </thead>
                <tbody>
                  {record.recent.map((p) => (
                    <tr key={p.gameId}>
                      <td>
                        <span className="league">{SPORT_LABEL[p.sport] || p.league}</span>
                        {p.match}
                        <small>{fmtTime(p.startsAt)} · graded {fmtTime(p.settledAt)}</small>
                      </td>
                      <td><span className="side">{p.side.toUpperCase()}</span></td>
                      <td>{Number(p.price).toFixed(2)}</td>
                      <td className={p.result === "correct" ? "win" : "loss"}>
                        {p.result === "correct" ? "Won" : "Lost"} <small>{p.final}</small>
                      </td>
                      <td className={p.profitUnits >= 0 ? "win" : "loss"}>
                        {p.profitUnits >= 0 ? "+" : ""}{Number(p.profitUnits).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty">No graded picks yet. Results appear as matches settle.</div>
            )
          }
          alerts={
            alerts.length ? (
              <table>
                <thead>
                  <tr><th>Match</th><th>Signal</th><th>Why</th></tr>
                </thead>
                <tbody>
                  {alerts.map((a) => (
                    <tr key={a.gameId}>
                      <td>
                        <span className="league">{a.league}</span>
                        {a.match}
                        <small>{fmtTime(a.startsAt)}</small>
                      </td>
                      <td>
                        <span className={"sev " + (a.severity >= 2 ? "high" : "watch")}>
                          {a.severity >= 2 ? "High risk" : "Watch"}
                        </span>
                      </td>
                      <td className="flags">
                        {(a.flags || []).map((f, i) => <span key={i}>{f}</span>)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty">No abnormal market shapes detected right now.</div>
            )
          }
          games={
            <table>
              <thead>
                <tr><th>Match</th><th>League</th><th>Starts</th><th>Market</th></tr>
              </thead>
              <tbody>
                {games.slice(0, 80).map((g) => (
                  <tr key={g.id}>
                    <td>{g.match}</td>
                    <td><span className="league">{SPORT_LABEL[g.sport] || g.league}</span></td>
                    <td>{fmtTime(g.startsAt)}</td>
                    <td>{g.markets?.h2h ? `${Number(g.markets.h2h.bestOdds).toFixed(2)} · ${g.markets.h2h.bookCount} book(s)` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        />
      </section>

      <section>
        <div className="section-head">
          <div><p className="eyebrow">RECORD</p><h2>Nothing hidden</h2></div>
          <Link className="btn btn-ghost" href="/record">Full record →</Link>
        </div>
        <div className="stats">
          <div><strong>{record.graded}</strong><span>graded picks</span></div>
          <div><strong>{record.rolling != null ? (record.rolling * 100).toFixed(0) + "%" : "—"}</strong><span>last-50 accuracy</span></div>
          <div><strong className={record.units >= 0 ? "pos" : "neg"}>{record.units >= 0 ? "+" : ""}{record.units}</strong><span>profit units</span></div>
          <div><strong>{record.accuracy != null ? (record.accuracy * 100).toFixed(1) + "%" : "—"}</strong><span>all-time accuracy</span></div>
        </div>
      </section>

      <section id="method" className="cards">
        <article>
          <p className="eyebrow">METHOD</p>
          <h3>Market-aware, not opinion</h3>
          <p>We start from the de-vigged market price, then claim an edge only where our learned team ratings disagree by a real margin.</p>
        </article>
        <article>
          <p className="eyebrow">INTEGRITY</p>
          <h3>Thin markets flagged</h3>
          <p>One book quoting, or a lopsided price, means less scrutiny on a match. Those games get a warning instead of a silent tip.</p>
        </article>
        <article>
          <p className="eyebrow">LEARNING</p>
          <h3>Ratings move daily</h3>
          <p>Every settled result nudges the ratings of both teams. The model is retrained on finals each cycle, not left stale.</p>
        </article>
      </section>
    </>
  );
}
