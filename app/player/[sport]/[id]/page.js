import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlayer, findPlayerTeam, getTeam } from "../../../../lib/team";
import { SPORT_LABEL } from "../../../../lib/data";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { sport, id } = await params;
  const teamId = await findPlayerTeam(sport, id);
  if (!teamId) return { title: "Player — TipLab" };
  const p = await getPlayer(sport, teamId, id);
  if (!p) return { title: "Player — TipLab" };
  return {
    title: `${p.name} — ${p.pos || "player"} · TipLab`,
    description: `${p.name} profile, availability and current status.`,
  };
}

export default async function PlayerPage({ params }) {
  const { sport, id } = await params;
  const teamId = await findPlayerTeam(sport, id);
  if (!teamId) notFound();
  const p = await getPlayer(sport, teamId, id);
  if (!p) notFound();
  const t = await getTeam(sport, teamId);

  const out = p.status && p.status !== "Active";

  return (
    <section style={{ maxWidth: 620, margin: "0 auto" }}>
      <p className="eyebrow">
        {SPORT_LABEL[sport] || sport}
        {t && <> · <Link href={`/team/${sport}/${teamId}`}>{t.name}</Link></>}
      </p>
      <div className="teamhead">
        {p.headshot ? <img src={p.headshot} alt="" /> : <span className="av big" />}
        <div>
          <h1 style={{ fontSize: "1.7rem", margin: 0 }}>
            {p.name} {p.jersey && <small style={{ color: "var(--dim)", fontSize: "1rem" }}>#{p.jersey}</small>}
          </h1>
          <p className="muted-note" style={{ margin: "4px 0 0" }}>
            {[p.pos, p.height, p.weight].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      {(out || p.injury) && (
        <div className="banner" style={{ marginTop: 18 }}>
          <strong>{out ? "Availability:" : "Injury note:"}</strong>{" "}
          {p.injury ? `${p.injury.status} — ${p.injury.detail}` : "not on the active list"}
        </div>
      )}

      <table style={{ marginTop: 18 }}>
        <tbody>
          {p.age && <tr><td>Age</td><td>{p.age}</td></tr>}
          {p.experience != null && <tr><td>Experience</td><td>{p.experience} {p.experience === 1 ? "year" : "years"}</td></tr>}
          {p.college && <tr><td>College</td><td>{p.college}</td></tr>}
          {p.birthplace && <tr><td>Born</td><td>{p.birthplace}</td></tr>}
        </tbody>
      </table>

      {t && (
        <p style={{ marginTop: 22 }}>
          <Link className="btn btn-ghost" href={`/team/${sport}/${teamId}`}>← {t.short} squad and form</Link>
        </p>
      )}
    </section>
  );
}
