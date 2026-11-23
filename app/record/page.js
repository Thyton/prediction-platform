import { getRecord, getLedger, readBacktest, fmtTime, SPORT_LABEL } from "../../lib/data";

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
  const all = [...readBacktest(), ...getLedger()].filter((i) => i.result).reverse();

  return (
    <>
      <section className="hero" style={{ paddingBottom: 20 }}>
        <p className="eyebrow">THE RECORD</p>
        <h1>Every pick, <em>every result.</em></h1>
        <p className="lede">
          Locked picks stay listed after they settle — wins and losses, with the closing score.
          Nothing is deleted or re-dated.
        </p>
      </section>

      <div className="stats">
        <div><strong>{r.graded}</strong><span>graded picks</span></div>
        <div><strong>{r.rolling != null ? (r.rolling * 100).toFixed(0) + "%" : "—"}</strong><span>last-50 accuracy</span></div>
        <div><strong className={r.units >= 0 ? "pos" : "neg"}>{r.units >= 0 ? "+" : ""}{r.units}</strong><span>profit units (1u flat)</span></div>
        <div><strong>{r.accuracy != null ? (r.accuracy * 100).toFixed(1) + "%" : "—"}</strong><span>all-time accuracy</span></div>
      </div>

      {all.length ? (
        <table>
          <thead>
            <tr><th>Match</th><th>Play</th><th>Price</th><th>Score</th><th>Result</th><th>Units</th></tr>
          </thead>
          <tbody>
            {all.map((p) => (
              <tr key={p.gameId}>
                <td>
                  <span className="league">{SPORT_LABEL[p.sport] || p.league}</span>
                  {p.match}
                  <small>{fmtTime(p.startsAt)} · graded {fmtTime(p.settledAt)}</small>
                </td>
                <td><TeamPill p={p} side={p.side} /></td>
                <td>{Number(p.price).toFixed(2)}</td>
                <td>{p.final || "—"}</td>
                <td className={p.result === "correct" ? "win" : "loss"}>
                  {p.result === "correct" ? "Won" : "Lost"}
                </td>
                <td className={p.profitUnits >= 0 ? "win" : "loss"}>
                  {p.profitUnits >= 0 ? "+" : ""}{Number(p.profitUnits).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="empty">No graded picks yet — the first results land as matches settle.</div>
      )}
    </>
  );
}
