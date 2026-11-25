import { getRecord, getLedger, readBacktest, backtestMeta, fmtTime, SPORT_LABEL } from "../../lib/data";

export const dynamic = "force-dynamic";


function TeamPill({ p, side }) {
  const isHome = side === "home";
  const name = isHome ? p.home : p.away;
  const logo = isHome ? p.homeLogo : p.awayLogo;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      {logo && <img src={logo} alt="" width={22} height={22} style={{ borderRadius: 4 }} />}
      <span className="side">{name}</span>
    </span>
  );
}

export default function RecordPage() {
  const r = getRecord();
  const meta = backtestMeta();
  // each table holds only its own source, so no pick is listed twice
  const all = readBacktest().filter((i) => i.result).reverse();
  const forward = getLedger().filter((i) => i.result).reverse();

  const table = (rows, withLock) => (
    <table>
      <thead>
        <tr><th>Match</th><th>Play</th><th>Price</th><th>Score</th><th>Result</th><th>Units</th></tr>
      </thead>
      <tbody>
        {rows.map((p) => (
          <tr key={p.gameId}>
            <td>
              <span className="league">{SPORT_LABEL[p.sport] || p.league}</span>
              {p.match}
              <small>
                starts {fmtTime(p.startsAt)}
                {withLock && p.lockTs ? ` · locked ${fmtTime(p.lockTs)}` : ""}
                {p.settledAt ? ` · graded ${fmtTime(p.settledAt)}` : ""}
              </small>
            </td>
            <td><TeamPill p={p} side={p.side} /></td>
            <td>{Number(p.price).toFixed(2)}{p.modelPriced ? <small> model price</small> : null}</td>
            <td>{p.final || "—"}</td>
            <td className={p.result === "correct" ? "win" : p.result === "push" ? "" : "loss"}>
              {p.result === "correct" ? "Won" : p.result === "push" ? "Push" : "Lost"}
            </td>
            <td className={p.profitUnits >= 0 ? "win" : "loss"}>
              {p.profitUnits >= 0 ? "+" : ""}{Number(p.profitUnits).toFixed(2)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <>
      <section className="hero" style={{ paddingBottom: 20 }}>
        <p className="eyebrow">THE RECORD</p>
        <h1>Every pick, <em>every result.</em></h1>
        <p className="lede">
          Locked picks stay listed after they settle — wins and losses, with the closing score.
          Nothing is deleted or re-dated. The forward record is real; the backtest is a replay, kept apart.
        </p>
      </section>

      <section>
        <div className="section-head">
          <div><p className="eyebrow">FORWARD · LIVE</p><h2>Released and graded in public</h2></div>
        </div>
        <div className="stats">
          <div><strong>{r.forward.graded}</strong><span>graded forward picks</span></div>
          <div><strong>{r.forward.rolling != null ? (r.forward.rolling * 100).toFixed(0) + "%" : "—"}</strong><span>last-50 accuracy</span></div>
          <div><strong className={r.forward.units >= 0 ? "pos" : "neg"}>{r.forward.units >= 0 ? "+" : ""}{r.forward.units}</strong><span>forward units (1u flat)</span></div>
          <div><strong>{r.forward.accuracy != null ? (r.forward.accuracy * 100).toFixed(1) + "%" : "—"}</strong><span>forward accuracy</span></div>
        </div>
        {forward.length ? table(forward, true) : <div className="empty">No forward picks graded yet.</div>}
        <p className="muted-note">
          This is the honest sample: picks were published before kickoff and locked with a timestamp.
          {r.forward.graded < 30 && " It is still small — judge it after ~50 picks."}
        </p>
      </section>

      <section style={{ marginTop: 34 }}>
        <div className="section-head">
          <div><p className="eyebrow">BACKTEST · REPLAY</p><h2>Same rules, earlier days</h2></div>
        </div>
        <div className="stats">
          <div><strong>{r.backtest.graded}</strong><span>replayed picks</span></div>
          <div><strong>{r.backtest.accuracy != null ? (r.backtest.accuracy * 100).toFixed(1) + "%" : "—"}</strong><span>backtest accuracy</span></div>
          <div><strong className={r.backtest.units >= 0 ? "pos" : "neg"}>{r.backtest.units >= 0 ? "+" : ""}{r.backtest.units}</strong><span>backtest units</span></div>
          <div><strong>{r.backtest.correct}–{r.backtest.wrong}</strong><span>W–L</span></div>
        </div>
        <p className="muted-note">
          Not released live. A replay across {meta.sports} competitions: ratings are rebuilt day by
          day so no future result leaks backwards, but odds come from a single historical source rather
          than the books open at the time. Tennis and esports are excluded — ESPN keeps no historical
          prices for them.
        </p>
        {all.length ? table(all, false) : <div className="empty">No replayed picks yet.</div>}
      </section>
    </>
  );
}
