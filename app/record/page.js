import { getRecord, getLedger, readBacktest, backtestMeta, getBySport, streakOf, fmtTime, SPORT_LABEL } from "../../lib/data";

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
  const bySport = getBySport();
  const streak = streakOf(getLedger());
  // "last 100" strips: the record is public in full, these are just the
  // windows people actually scan (this week, this month).
  const strip = (n) => getLedger().filter((i) => i.result).slice(-n).reverse();
  const week = strip(100);

  const table = (rows, withLock) => (
    <table>
      <thead>
        <tr><th>Match</th><th>Play</th><th className="hide-sm">Price</th><th className="hide-sm">Score</th><th>Result</th><th>Units</th></tr>
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
            <td className="hide-sm">{Number(p.price).toFixed(2)}{p.modelPriced ? <small> model price</small> : null}</td>
            <td className="hide-sm">{p.final || "—"}</td>
            <td className={p.result === "correct" ? "win" : p.result === "push" ? "" : "loss"}>
              {p.result === "correct" ? "Won" : p.result === "push" ? "Push" : "Lost"}
            </td>
            <td className={p.profitUnits > 0 ? "win" : p.profitUnits < 0 ? "loss" : ""}>
              {p.profitUnits > 0 ? "+" : ""}{Number(p.profitUnits).toFixed(2)}
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
          <div>
            <strong className={streak.kind === "correct" ? "pos" : streak.kind === "wrong" ? "neg" : ""}>
              {streak.n ? `${streak.n}${streak.kind === "correct" ? "W" : "L"}` : "—"}
            </strong>
            <span>current run</span>
          </div>
        </div>
        {forward.length ? table(forward, true) : <div className="empty">No forward picks graded yet.</div>}
        <p className="muted-note">
          This is the honest sample: picks were published before kickoff and locked with a timestamp.
          {r.forward.graded < 30 && " It is still small — judge it after ~50 picks."}
        </p>
      </section>

      <section style={{ marginTop: 34 }}>
        <div className="section-head">
          <div><p className="eyebrow">BY COMPETITION</p><h2>Where it works, where it doesn&apos;t</h2></div>
        </div>
        <table>
          <thead>
            <tr><th>Competition</th><th>W</th><th>L</th><th>Push</th><th>Accuracy</th><th>Units</th></tr>
          </thead>
          <tbody>
            {[...bySport].sort((a, b) => (b.units || 0) - (a.units || 0)).map((s) => (
              <tr key={s.sport}>
                <td><span className="league">{SPORT_LABEL[s.sport] || s.sport}</span></td>
                <td className="win">{s.w}</td>
                <td className="loss">{s.l}</td>
                <td>{s.p}</td>
                <td className={s.accuracy == null ? "" : s.accuracy >= 0.5 ? "win" : "loss"}>
                  {s.accuracy != null ? (s.accuracy * 100).toFixed(0) + "%" : "—"}
                </td>
                <td className={s.units > 0 ? "win" : s.units < 0 ? "loss" : ""}>
                  {s.units > 0 ? "+" : ""}{s.units}
                </td>
              </tr>
            ))}
            {!bySport.length && (
              <tr><td colSpan={6} className="empty">Nothing graded yet.</td></tr>
            )}
          </tbody>
        </table>
        <p className="muted-note">
          Splitting by competition is how you spot a sport the model is cold on. A sport running
          negative here is exactly what raises its gate automatically in the next cycle.
        </p>
      </section>

      <section style={{ marginTop: 34 }}>
        <div className="section-head">
          <div><p className="eyebrow">LAST 100</p><h2>The most recent results</h2></div>
        </div>
        {week.length ? table(week, true) : <div className="empty">No graded picks yet.</div>}
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
