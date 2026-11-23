import { redirect } from "next/navigation";
import { currentUser } from "../../lib/session";
import { getRecord } from "../../lib/data";
import SignOut from "./signout";

export const dynamic = "force-dynamic";

export default async function Dashboard({ searchParams }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const upgraded = (await searchParams)?.upgraded;
  const r = getRecord();

  return (
    <>
      <section className="hero" style={{ paddingBottom: 16 }}>
        <p className="eyebrow">MEMBER AREA</p>
        <h1 style={{ fontSize: "2rem" }}>Your dashboard</h1>
        <p className="lede">{user.email}</p>
        {upgraded && !user.pro && (
          <p className="ok">Payment received — Pro activates in a few seconds. Refresh if it has not.</p>
        )}
        {upgraded && user.pro && <p className="ok">You are Pro. Welcome.</p>}
      </section>

      <div className="stats">
        <div><strong>{r.graded}</strong><span>graded picks</span></div>
        <div><strong>{r.rolling != null ? (r.rolling * 100).toFixed(0) + "%" : "—"}</strong><span>last-50 accuracy</span></div>
        <div><strong className={r.units >= 0 ? "pos" : "neg"}>{r.units >= 0 ? "+" : ""}{r.units}</strong><span>units</span></div>
        <div><strong>{user.pro ? "PRO" : "FREE"}</strong><span>plan</span></div>
      </div>

      {!user.pro && (
        <section className="cards">
          <article>
            <p className="eyebrow">UPGRADE</p>
            <h3>Pro — $9 / month</h3>
            <p>Every released pick, all integrity alerts, and the full graded record. Cancel anytime.</p>
            <form action="/api/checkout" method="post" style={{ marginTop: 16 }}>
              <button type="submit">Go Pro →</button>
            </form>
          </article>
        </section>
      )}

      <p style={{ marginTop: 28 }}><SignOut /></p>
    </>
  );
}
