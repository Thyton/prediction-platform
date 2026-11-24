import Link from "next/link";
import { getLive, getRecord, getGames, getIntegrity, getSignals, fmtTime, SPORT_LABEL } from "../lib/data";
import { currentUser } from "../lib/session";
import { isFollowing } from "../lib/userstats";
import Waitlist from "./waitlist";
import Tabs from "./tabs";
import FollowButton from "./follow-button";
import LiveBoard from "./live-board";

export const dynamic = "force-dynamic";


function TeamPill({ p, side }) {
  const isHome = side === "home";
  const name = isHome ? p.home : p.away;
  const logo = isHome ? p.homeLogo : p.awayLogo;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" width={22} height={22} style={{ borderRadius: 4, verticalAlign: "middle" }} />
      )}
      <span className="side">{name}</span>
    </span>
  );
}

function PickCard({ p, trackable, following }) {
  const picked = p.side === "home" ? p.home : p.away;
  const pickedLogo = p.side === "home" ? p.homeLogo : p.awayLogo;
  const graded = p.result === "correct" || p.result === "wrong";
  return (
    <article className="pick">
      <div className="pick-main">
        <div className="pick-league">
          <span className="league">{SPORT_LABEL[p.sport] || p.league}</span>
          <span>{fmtTime(p.startsAt)}</span>
        </div>
        <div className="pick-teams">
          {p.awayLogo && <img src={p.awayLogo} alt="" />}
          <span>{p.away}</span>
          <span className="vs">at</span>
          {p.homeLogo && <img src={p.homeLogo} alt="" />}
          <span>{p.home}</span>
        </div>
        <div className="pick-choice">
          {pickedLogo && <img src={pickedLogo} alt="" />}
          <span>Pick: {picked}</span>
          {trackable && <FollowButton gameId={p.gameId} following={following} />}
        </div>
        {graded ? (
          <div className="pick-meta">Final {p.final}</div>
        ) : (
          <div className="pick-meta">Locked {fmtTime(p.lockTs)} · price {Number(p.price).toFixed(2)}</div>
        )}
      </div>
      <div className="pick-right">
        {graded ? (
          <>
            <div className={"pick-result " + (p.result === "correct" ? "win" : "loss")}>
              {p.result === "correct" ? "WON" : "LOST"}
            </div>
            <div className="pick-price">
              {p.profitUnits >= 0 ? "+" : ""}{Number(p.profitUnits).toFixed(2)}u
            </div>
          </>
        ) : (
          <>
            <div className="pick-edge">{(p.edgePct * 100).toFixed(0)}%</div>
            <div className="pick-price">{Number(p.price).toFixed(2)}</div>
            <div className={"pick-tier " + p.tier}>{p.tier.toLowerCase()}</div>
          </>
        )}
      </div>
    </article>
  );
}

export default async function Home() {
  const live = getLive();
  const record = getRecord();
  const games = getGames();
  const alerts = getIntegrity();
  const signals = getSignals();
  const user = await currentUser();
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
        <strong>Free during beta.</strong> Every pick, alert and result is open. Pro (/month)
        opens soon — first 500 members keep founding pricing for life.
      </div>

      <section id="tips">
        <div className="section-head">
          <div>
            <p className="eyebrow">THE DESK</p>
            <h2>Today&apos;s released picks</h2>
          </div>
          <span className="status">
            {signals.length > 0 && <><span className="live-pulse" /><b>{signals.length}</b> live · </>}
            ● <b>{picks.length}</b> open · <b>{games.length}</b> games tracked ·{" "}
            <b>{alerts.length}</b> alerts
          </span>
        </div>

        <Tabs
          tips={
            today.length ? (
              <div className="picklist">
                {today.map((p) => (
                  <PickCard key={p.gameId} p={p} trackable={Boolean(user)} following={isFollowing(user, p.gameId)} />
                ))}
              </div>
            ) : (
              <div className="empty">
                No picks in the current window. The board refills on the next scan — we never pad it with filler.
              </div>
            )
          }
          live={
            <LiveBoard signals={signals} pro={Boolean(user?.pro)} signedIn={Boolean(user)} />
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
                      <td><TeamPill p={p} side={p.side} /></td>
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
