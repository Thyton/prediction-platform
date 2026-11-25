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
  const graded = ["correct", "wrong", "push"].includes(p.result);
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
          <div className="pick-meta">
            Locked {fmtTime(p.lockTs)} ·{" "}
            {p.modelPriced ? "model price" : `price ${Number(p.price).toFixed(2)}`}
          </div>
        )}
      </div>
      <div className="pick-right">
        {graded ? (
          <>
            <div className={"pick-result " + (p.result === "correct" ? "win" : p.result === "push" ? "" : "loss")}>
              {p.result === "correct" ? "WON" : p.result === "push" ? "PUSH" : "LOST"}
            </div>
            <div className="pick-price">
              {p.profitUnits > 0 ? "+" : ""}{Number(p.profitUnits).toFixed(2)}u
            </div>
          </>
        ) : (
          <>
            {/* a model "edge" is a probability gap, not a price edge — show the
                probability itself so 54% and 5% aren't read as the same scale */}
            <div className="pick-edge">
              {p.modelPriced ? `${(p.modelProb * 100).toFixed(0)}%` : `${(p.edgePct * 100).toFixed(0)}%`}
              <small className="edge-kind">{p.modelPriced ? "model prob" : "edge"}</small>
            </div>
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

  // show the whole board, soonest kickoff first. Long-dated fixtures are legible
  // because every card prints its start date; a filtered window would just hide
  // picks that already occupy a slot.
  const board = [...picks].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));

  return (
    <>
      <section className="hero">
        <p className="eyebrow">TIMESTAMPED · EVERY SPORT · PUBLIC RECORD</p>
        <h1>Every pick locked,<br /><em>before the price moves.</em></h1>
        <p className="lede">
          We publish the match, the price, the model probability and the edge — then grade it in public.
          Market-aware across {Object.keys(SPORT_LABEL).length} competitions: NBA, NFL, NHL, college, Premier League,
          La Liga, Serie A, Bundesliga, Brazil, Mexico, Argentina, tennis and esports.
        </p>
        <Waitlist />
      </section>

      <div className="banner">
        <strong>Free during beta.</strong> Every pick, the alerts and the full graded record are open.
        Pro ($9/month) unlocks the live in-play signals — founding members keep that price for life.
      </div>

      <section id="tips">
        <div className="section-head">
          <div>
            <p className="eyebrow">THE DESK</p>
            <h2>Open picks</h2>
          </div>
          <span className="status">
            {signals.length > 0 && <><span className="live-pulse" /><b>{signals.length}</b> live · </>}
            ● <b>{picks.length}</b> open · <b>{games.length}</b> games tracked ·{" "}
            <b>{alerts.total}</b> alerts
          </span>
        </div>

        <Tabs
          liveCount={signals.length}
          tips={
            board.length ? (
              <div className="picklist">
                {board.map((p) => (
                  <PickCard key={p.gameId} p={p} trackable={Boolean(user)} following={isFollowing(user, p.gameId)} />
                ))}
              </div>
            ) : (
              <div className="empty">
                No open picks right now. The board refills on the next scan — we never pad it with filler.
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
                      <td className={p.result === "correct" ? "win" : p.result === "push" ? "" : "loss"}>
                        {p.result === "correct" ? "Won" : p.result === "push" ? "Push" : "Lost"} <small>{p.final}</small>
                      </td>
                      <td className={p.profitUnits > 0 ? "win" : p.profitUnits < 0 ? "loss" : ""}>
                        {p.profitUnits > 0 ? "+" : ""}{Number(p.profitUnits).toFixed(2)}
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
            alerts.high.length ? (
              <>
                <table>
                <thead>
                  <tr><th>Match</th><th>Signal</th><th>Why</th></tr>
                </thead>
                <tbody>
                  {alerts.high.map((a) => (
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
                {alerts.watch.length > 0 && (
                  <p className="muted-note">
                    Plus {alerts.watch.length} thin-market cautions (one or two books quoting) — lower risk, so not listed above.
                  </p>
                )}
              </>
            ) : alerts.watch.length ? (
              <p className="muted-note">
                No high-risk shapes right now. {alerts.watch.length} thin-market cautions in play.
              </p>
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
          <div><strong>{record.forward.graded}</strong><span>graded forward picks</span></div>
          <div>
            <strong className={record.forward.accuracy == null ? "" : record.forward.accuracy >= 0.5 ? "pos" : "neg"}>
              {record.forward.accuracy != null ? (record.forward.accuracy * 100).toFixed(0) + "%" : "—"}
            </strong>
            <span>forward accuracy</span>
          </div>
          <div>
            <strong className={record.forward.units >= 0 ? "pos" : "neg"}>
              {record.forward.units >= 0 ? "+" : ""}{record.forward.units}
            </strong>
            <span>forward units (1u flat)</span>
          </div>
          <div><strong>{record.backtest.graded}</strong><span>backtest picks (replay)</span></div>
        </div>
        <p className="muted-note">
          Forward picks were released live and graded as games settled — that is the number to judge us on.
          The backtest is a replay of the same rules over earlier days and is kept separate.
          {record.forward.graded < 30 && " The forward sample is still small; judge it after ~50 picks."}
        </p>
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
