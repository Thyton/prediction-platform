import Link from "next/link";
import { notFound } from "next/navigation";
import { getStandings, LEAGUE_PATH } from "../../../lib/team";
import { getLive, getLedger, fmtTime, SPORT_LABEL } from "../../../lib/data";

// Sport hub: the parent the team pages never had. One page per competition:
// the standings table, our own graded record in that sport, today's picks and
// the fixtures readers actually check. Everything comes from data the engine
// already collects, plus ESPN's free standings endpoint.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({ params }) {
  const { sport } = await params;
  const label = SPORT_LABEL[sport];
  if (!label) return { title: "Sport — TipLab" };
  return {
    title: `${label} — picks, record, standings · TipLab`,
    description: `TipLab's model on ${label}: open picks, the graded record in this competition, standings and upcoming fixtures.`,
  };
}

function Form({ form }) {
  if (!form?.length) return null;
  return (
    <span style={{ display: "inline-flex", gap: 3, marginLeft: 6 }}>
      {form.slice(-5).map((f, i) => (
        <span key={i} className={"form " + (f === "W" ? "win" : "loss")}>{f}</span>
      ))}
    </span>
  );
}

export default async function SportPage({ params }) {
  const { sport } = await params;
  const label = SPORT_LABEL[sport];
  if (!label || !LEAGUE_PATH[sport]) notFound();

  const live = getLive();
  const ledger = getLedger();
  const inSport = (p) => p.sport === sport;
  const open = (live.picks || []).filter(inSport);
  const graded = ledger.filter((p) => inSport(p) && p.result);
  const won = graded.filter((p) => p.result === "correct").length;
  const lost = graded.filter((p) => p.result === "wrong").length;
  const pushed = graded.filter((p) => p.result === "push").length;
  const units = graded.reduce((a, p) => a + (p.profitUnits || 0), 0);

  // fixtures straight off today's games feed: this sport, soonest first
  const fixtures = (await import("../../../data/games.json")).default?.games
    ?.filter((g) => g.sport === sport && ["pre", "scheduled"].includes(g.state))
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
    .slice(0, 14) || [];

  const standings = await getStandings(sport);

  return (
    <section style={{ maxWidth: 760, margin: "0 auto" }}>
      <p className="eyebrow">{label}</p>
      <h1 style={{ fontSize: "2rem", margin: "0 0 6px" }}>{label} desk</h1>
      <p className="muted-note" style={{ margin: "0 0 22px" }}>
        Everything the model sees in this competition: the open board, the graded
        record, the table, and what&apos;s next.
      </p>

      <div className="stats">
        <div><strong>{open.length}</strong><span>open picks</span></div>
        <div>
          <strong className={won + lost ? (won >= lost ? "pos" : "neg") : ""}>
            {won + lost ? `${Math.round((won / (won + lost)) * 100)}%` : "—"}
          </strong>
          <span>record here ({won}W-{lost}L{pushed ? `-${pushed}P` : ""})</span>
        </div>
        <div>
          <strong className={units >= 0 ? "pos" : "neg"}>{units >= 0 ? "+" : ""}{units.toFixed(2)}</strong>
          <span>units (1u flat)</span>
        </div>
        <div><strong>{graded.length}</strong><span>graded picks</span></div>
      </div>

      <h2 style={{ fontSize: 20, margin: "26px 0 10px" }}>Open picks</h2>
      {open.length ? (
        <div className="picklist">
          {open.map((p) => (
            <Link key={p.gameId} href={`/p/${encodeURIComponent(p.gameId)}`} className="pick-row">
              <span className="league">{fmtTime(p.startsAt)}</span>
              <span className="pick-row-teams">{p.away} at {p.home}</span>
              <span className="pick-row-side">→ {p.side === "home" ? p.home : p.away} @ {Number(p.price).toFixed(2)}</span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="empty">No open {label} picks right now — the gate only publishes when the model claims an edge.</p>
      )}

      {standings?.length > 0 && (
        <>
          <h2 style={{ fontSize: 20, margin: "26px 0 10px" }}>Standings</h2>
          <table>
            <thead>
              <tr><th>Team</th><th>Record</th><th className="hide-sm">Form</th></tr>
            </thead>
            <tbody>
              {standings.slice(0, 12).map((row) => (
                <tr key={row.id}>
                  <td>
                    {row.id && row.logo ? null : null}
                    <span>{row.name}</span>
                  </td>
                  <td>{row.record}</td>
                  <td className="hide-sm"><Form form={row.form} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {fixtures.length > 0 && (
        <>
          <h2 style={{ fontSize: 20, margin: "26px 0 10px" }}>Upcoming</h2>
          <table>
            <thead>
              <tr><th>Match</th><th>Kickoff</th><th className="hide-sm">Price</th></tr>
            </thead>
            <tbody>
              {fixtures.map((g) => {
                const h = g.markets?.h2h;
                return (
                  <tr key={g.id}>
                    <td>{g.away} at {g.home}</td>
                    <td>{fmtTime(g.startsAt)}</td>
                    <td className="hide-sm">{h ? Number(h.bestOdds).toFixed(2) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      <p className="muted-note" style={{ marginTop: 24 }}>
        Team-level detail lives on each team page — form, roster, and what our
        model has done on that specific side.
      </p>
    </section>
  );
}
