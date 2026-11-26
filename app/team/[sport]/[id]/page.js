import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeam, teamPicks } from "../../../../lib/team";
import { getLedger, fmtTime, SPORT_LABEL } from "../../../../lib/data";

// Team page: record, form, standing, fixtures, roster and — the part nobody
// else has — what our model has done on this team. Depth is what earns a
// bookmark; a stranger lands here from a shared pick and can keep digging.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({ params }) {
  const { sport, id } = await params;
  const t = await getTeam(sport, id);
  if (!t) return { title: "Team — TipLab" };
  return {
    title: `${t.name} — form, fixtures, roster · TipLab`,
    description: `${t.name} results, upcoming fixtures, roster and every TipLab pick on them.`,
  };
}

function Form({ form }) {
  if (!form.length) return <span className="dim">no decided games</span>;
  return form.map((f, i) => (
    <span key={i} className={"form " + (f === "W" ? "win" : "loss")}>{f}</span>
  ));
}

export default async function TeamPage({ params }) {
  const { sport, id } = await params;
  const t = await getTeam(sport, id);
  if (!t) notFound();

  const picks = teamPicks(getLedger(), t.name);
  const graded = picks.filter((p) => p.result);
  const won = graded.filter((p) => p.result === "correct").length;
  const lost = graded.filter((p) => p.result === "wrong").length;

  return (
    <section style={{ maxWidth: 760, margin: "0 auto" }}>
      <p className="eyebrow"><Link href={`/sport/${sport}`}>{SPORT_LABEL[sport] || sport}</Link> &rsaquo; team</p>
      <div className="teamhead">
        {t.logo && <img src={t.logo} alt="" />}
        <div>
          <h1 style={{ fontSize: "1.8rem", margin: 0 }}>{t.name}</h1>
          <p className="muted-note" style={{ margin: "4px 0 0" }}>
            {t.record ? `${t.record}${t.recordWhat ? ` ${t.recordWhat.toLowerCase()}` : ""}` : "—"}
            {t.standing ? ` · ${t.standing}` : ""}
            {t.run.n >= 2 ? ` · ${t.run.n}-game ${t.run.kind === "W" ? "win" : "losing"} run` : ""}
          </p>
        </div>
      </div>

      <div className="stats" style={{ marginTop: 16 }}>
        <div><strong>{t.w}</strong><span>wins</span></div>
        <div><strong>{t.l}</strong><span>losses</span></div>
        <div>
          <strong>{graded.length}</strong>
          <span>our picks graded</span>
        </div>
        <div>
          <strong className={graded.length && won / Math.max(1, won + lost) >= 0.5 ? "pos" : graded.length ? "neg" : ""}>
            {won + lost ? `${won}–${lost}` : "—"}
          </strong>
          <span>our W–L here</span>
        </div>
      </div>

      <p className="pulse-line">
        Form: <Form form={t.form} />
      </p>

      {picks.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <p className="eyebrow">OUR REVIEWS OF THEM</p>
          <table>
            <thead><tr><th>Match</th><th>Play</th><th>Price</th><th>Result</th></tr></thead>
            <tbody>
              {picks.slice(0, 12).map((p) => (
                <tr key={p.gameId}>
                  <td>
                    <Link href={`/p/${encodeURIComponent(p.gameId)}`}>{p.match}</Link>
                    <small>{fmtTime(p.startsAt)}</small>
                  </td>
                  <td>{p.side === "home" ? p.home : p.away}</td>
                  <td>{Number(p.price).toFixed(2)}</td>
                  <td className={p.result === "correct" ? "win" : p.result === "wrong" ? "loss" : ""}>
                    {p.result === "correct" ? "Won" : p.result === "wrong" ? "Lost" : p.result === "push" ? "Push" : "open"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="col2">
        <div>
          <p className="eyebrow" style={{ marginTop: 26 }}>NEXT UP</p>
          {t.upcoming.length ? (
            <div className="feed">
              {t.upcoming.map((e) => (
                <div key={e.id} className="feed-item">
                  <span className="dot in" />
                  <div className="feed-main">
                    {e.home} vs {e.away}
                    <small>{fmtTime(e.at)}</small>
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="empty">No fixtures listed.</div>}
        </div>
        <div>
          <p className="eyebrow" style={{ marginTop: 26 }}>RECENT</p>
          {t.recent.length ? (
            <div className="feed">
              {t.recent.map((e) => (
                <div key={e.id} className="feed-item">
                  <span className={"dot " + (e.won ? "win" : "loss")} />
                  <div className="feed-main">
                    {e.home} {e.hs ?? ""}–{e.as ?? ""} {e.away}
                    <small>{fmtTime(e.at)}</small>
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="empty">No results listed.</div>}
        </div>
      </div>

      {t.roster.length > 0 && (
        <>
          <p className="eyebrow" style={{ marginTop: 26 }}>SQUAD</p>
          <div className="squad">
            {t.roster.map((a) => (
              <Link key={a.id} className="player" href={`/player/${sport}/${a.id}`}>
                {a.headshot ? <img src={a.headshot} alt="" /> : <span className="av" />}
                <span>{a.name}</span>
                <small>{a.pos}{a.jersey ? ` · #${a.jersey}` : ""}</small>
              </Link>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
