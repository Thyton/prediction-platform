import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "../../lib/session";
import { getRecord, fmtTime, SPORT_LABEL } from "../../lib/data";
import { personalRecord } from "../../lib/userstats";
import SignOut from "./signout";

export const dynamic = "force-dynamic";

function TeamPill({ p, side }) {
  const isHome = side === "home";
  const name = isHome ? p.home : p.away;
  const logo = isHome ? p.homeLogo : p.awayLogo;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      {logo && <img src={logo} alt="" width={20} height={20} style={{ borderRadius: 4 }} />}
      <span className="side">{name}</span>
    </span>
  );
}

export default async function Dashboard({ searchParams }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const upgraded = (await searchParams)?.upgraded;
  const site = getRecord();
  const me = personalRecord(user);

  const streakText =
    me.streak >= 2
      ? `${me.streak} ${me.streakKind === "correct" ? "win" : "loss"} streak`
      : "—";

  return (
    <>
      <section className="hero" style={{ paddingBottom: 12 }}>
        <p className="eyebrow">MEMBER AREA</p>
        <h1 style={{ fontSize: "2rem" }}>Your record</h1>
        <p className="lede">{user.email}</p>
        {upgraded && !user.pro && (
          <p className="ok">Payment received — Pro activates in a few seconds. Refresh if it has not.</p>
        )}
        {upgraded && user.pro && <p className="ok">You are Pro. Welcome.</p>}
      </section>

      <div className="stats">
        <div><strong>{me.graded.length}</strong><span>picks you tracked</span></div>
        <div>
          <strong className={me.accuracy == null ? "" : me.accuracy >= 0.5 ? "pos" : "neg"}>
            {me.accuracy != null ? (me.accuracy * 100).toFixed(0) + "%" : "—"}
          </strong>
          <span>your accuracy</span>
        </div>
        <div><strong className={me.units >= 0 ? "pos" : "neg"}>{me.units >= 0 ? "+" : ""}{me.units}</strong><span>your units</span></div>
        <div><strong>{streakText}</strong><span>current run</span></div>
      </div>

      <p className="muted-note">
        Track any pick from the desk and it lands here — graded with the same score data as the public record.
        Site forward record: {site.forward.graded} graded ·{" "}
        {site.forward.accuracy != null ? (site.forward.accuracy * 100).toFixed(1) : "—"}% accuracy.{" "}
        <Link href="/#tips">Go to the desk →</Link>
      </p>

      {!user.pro && (
        <section className="cards">
          <article>
            <p className="eyebrow">UPGRADE</p>
            <h3>Pro — $9 / month</h3>
            <p>
              Live in-play signals on every open pick — hold, get in, get out — with browser alerts so you
              hear about them without sitting on the tab. Every pick and the full graded record stay free;
              Pro is the in-game layer. Cancel anytime.
            </p>
            <form action="/api/checkout" method="post" style={{ marginTop: 16 }}>
              <button type="submit">Go Pro →</button>
            </form>
          </article>
          <article>
            <p className="eyebrow">FREE TIER</p>
            <h3>What you have now</h3>
            <p>Every released pick, the integrity alerts and the full record, free during beta. Free members see the newest live signal; Pro sees all of them and gets notified.</p>
          </article>
        </section>
      )}

      <section style={{ marginTop: 34 }}>
        <div className="section-head" style={{ marginTop: 0 }}>
          <div><p className="eyebrow">OPEN</p><h2>Working now</h2></div>
        </div>
        {me.open.length ? (
          <div className="picklist">
            {me.open.map((p) => (
              <article className="pick" key={p.gameId}>
                <div className="pick-main">
                  <div className="pick-league">
                    <span className="league">{SPORT_LABEL[p.sport] || p.league}</span>
                    <span>{fmtTime(p.startsAt)}</span>
                  </div>
                  <div className="pick-teams">
                    {p.awayLogo && <img src={p.awayLogo} alt="" />}
                    <span>{p.away}</span><span className="vs">at</span>
                    {p.homeLogo && <img src={p.homeLogo} alt="" />}
                    <span>{p.home}</span>
                  </div>
                  <div className="pick-choice"><span>Pick: {p.side === "home" ? p.home : p.away}</span></div>
                  <div className="pick-meta">stake {Number(p.stake).toFixed(1)}u · price {Number(p.price).toFixed(2)}</div>
                </div>
                <div className="pick-right">
                  <div className="pick-price">{Number(p.price).toFixed(2)}</div>
                  <div className={"pick-tier " + p.tier}>{p.tier.toLowerCase()}</div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty">Nothing tracked yet. Open the desk and hit “+ Track” on a pick.</div>
        )}
      </section>

      {Object.keys(me.bySport).length > 0 && (
        <section style={{ marginTop: 34 }}>
          <div className="section-head" style={{ marginTop: 0 }}>
            <div><p className="eyebrow">SPLIT</p><h2>By sport</h2></div>
          </div>
          <table>
            <thead><tr><th>Sport</th><th>Won</th><th>Lost</th><th>Hit rate</th></tr></thead>
            <tbody>
              {Object.entries(me.bySport).map(([s, v]) => (
                <tr key={s}>
                  <td>{SPORT_LABEL[s] || s}</td>
                  <td className="win">{v.w}</td>
                  <td className="loss">{v.l}</td>
                  <td>{v.w + v.l ? ((100 * v.w) / (v.w + v.l)).toFixed(0) + "%" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {me.graded.length > 0 && (
        <section style={{ marginTop: 34 }}>
          <div className="section-head" style={{ marginTop: 0 }}>
            <div><p className="eyebrow">SETTLED</p><h2>Your settled picks</h2></div>
          </div>
          <table>
            <thead><tr><th>Match</th><th>Pick</th><th>Score</th><th>Result</th><th>Units</th></tr></thead>
            <tbody>
              {[...me.graded].reverse().map((p) => (
                <tr key={p.gameId}>
                  <td>
                    <span className="league">{SPORT_LABEL[p.sport] || p.league}</span>
                    {p.match}
                    <small>{fmtTime(p.startsAt)}</small>
                  </td>
                  <td><TeamPill p={p} side={p.side} /></td>
                  <td>{p.final || "—"}</td>
                  <td className={p.result === "correct" ? "win" : "loss"}>{p.result === "correct" ? "Won" : "Lost"}</td>
                  <td className={p.result === "correct" ? "win" : "loss"}>
                    {p.result === "correct" ? "+" : "−"}{Number(p.stake).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <p style={{ marginTop: 28 }}><SignOut /></p>
    </>
  );
}
