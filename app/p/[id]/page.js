import Link from "next/link";
import { notFound } from "next/navigation";
import { getLive, getLedger, fmtTime, SPORT_LABEL } from "../../../lib/data";

// A single pick, public — the landing page for a shared link. It has to stand
// alone for a stranger: what was picked, at what price, when it locked, and
// what happened. No sign-in wall.
export const dynamic = "force-dynamic";

function find(id) {
  const open = (getLive().picks || []).find((p) => p.gameId === id);
  if (open) return { pick: open, open: true };
  const done = getLedger().find((p) => p.gameId === id);
  if (done) return { pick: done, open: false };
  return null;
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const hit = find(decodeURIComponent(id));
  if (!hit) return { title: "Pick not found — TipLab" };
  const p = hit.pick;
  const pick = p.side === "home" ? p.home : p.away;
  const result = p.result === "correct" ? "WON" : p.result === "wrong" ? "LOST" : p.result === "push" ? "PUSH" : "OPEN";
  return {
    title: `${result} · ${pick} @ ${Number(p.price).toFixed(2)} — TipLab`,
    description: `${p.match} · ${SPORT_LABEL[p.sport] || p.league}. Locked ${fmtTime(p.lockTs)}. Public record, graded in the open.`,
  };
}

export default async function PickPage({ params }) {
  const { id } = await params;
  const hit = find(decodeURIComponent(id));
  if (!hit) notFound();
  const p = hit.pick;
  const picked = p.side === "home" ? p.home : p.away;
  const logo = p.side === "home" ? p.homeLogo : p.awayLogo;
  const graded = ["correct", "wrong", "push"].includes(p.result);

  return (
    <section style={{ maxWidth: 640, margin: "0 auto" }}>
      <p className="eyebrow">{graded ? "GRADED IN PUBLIC" : "OPEN PICK"}</p>
      <h1 style={{ fontSize: "1.9rem", marginTop: 6 }}>
        {p.away} <em>at</em> {p.home}
      </h1>
      <p className="muted-note">
        <span className="league">{SPORT_LABEL[p.sport] || p.league}</span> · starts {fmtTime(p.startsAt)}
        {p.lockTs ? ` · locked ${fmtTime(p.lockTs)}` : ""}
      </p>

      <article className="pick" style={{ marginTop: 18 }}>
        <div className="pick-main">
          <div className="pick-choice" style={{ marginTop: 0 }}>
            {logo && <img src={logo} alt="" />}
            <span>Pick: {picked}</span>
          </div>
          {p.why && <div className="why">{p.why}</div>}
          <div className="pick-meta">
            Price {Number(p.price).toFixed(2)}
            {p.modelPriced ? " (model price)" : ""} · model rated it {(p.modelProb * 100).toFixed(0)}%
          </div>
        </div>
        <div className="pick-right">
          {graded ? (
            <>
              <div className={"pick-result " + (p.result === "correct" ? "win" : p.result === "push" ? "" : "loss")}>
                {p.result === "correct" ? "WON" : p.result === "push" ? "PUSH" : "LOST"}
              </div>
              <div className="pick-price">{p.final || ""}</div>
              <div className="pick-price">
                {p.profitUnits > 0 ? "+" : ""}{Number(p.profitUnits).toFixed(2)}u
              </div>
            </>
          ) : (
            <div className="pick-edge">{(p.modelProb * 100).toFixed(0)}%</div>
          )}
        </div>
      </article>

      <p className="pulse-line">
        Every pick is locked before kickoff with the price attached, then graded win or lose.{" "}
        <Link href="/record">See the whole record →</Link>
      </p>

      <p className="muted-note" style={{ marginTop: 18 }}>
        Tracking a pick puts it in your own record — your wins, your units, your
        strike rate, counted honestly against the same grades. It takes a free
        account and one click.
      </p>

      <p style={{ marginTop: 18, display: "flex", gap: 9, flexWrap: "wrap" }}>
        <Link className="btn" href="/login?up=1">Track picks like this →</Link>
        {p.sport && <Link className="btn btn-ghost" href={`/sport/${p.sport}`}>More {(SPORT_LABEL[p.sport] || p.sport)} →</Link>}
      </p>
    </section>
  );
}
