import Link from "next/link";
import { fmtTime, SPORT_LABEL } from "../lib/labels";

// The daily desk log. Every lock and every settle, newest first, grouped by
// day with that day's tally on top — so a visitor can see the desk working
// today, and see yesterday's damage without digging.
const LABEL = {
  entry: "locked",
  settle: "graded",
  push: "push",
};

function dayLabel(day) {
  const d = new Date(`${day}T00:00:00Z`);
  const today = new Date().toISOString().slice(0, 10);
  if (day === today) return "Today";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

export default function ActivityFeed({ days, events }) {
  if (!events.length) {
    return <div className="empty">No activity yet. Entries and grades appear here as the desk works.</div>;
  }

  const byDay = new Map();
  for (const e of events) {
    const k = e.at ? new Date(e.at).toISOString().slice(0, 10) : "unknown";
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(e);
  }
  const tally = new Map(days.map((d) => [d.day, d]));

  return (
    <>
      <div className="daystrip">
        {days.slice(0, 10).map((d) => (
          <div key={d.day} className="daystat">
            <span>{dayLabel(d.day)}</span>
            <b>{d.locked} in</b>
            <em className={d.units > 0 ? "win" : d.units < 0 ? "loss" : ""}>
              {d.settled ? `${d.w}–${d.l}` : "—"}
              {d.settled ? ` ${d.units > 0 ? "+" : ""}${d.units}u` : ""}
            </em>
          </div>
        ))}
      </div>

      {[...byDay.entries()].map(([day, list]) => {
        const t = tally.get(day);
        return (
          <div key={day}>
            <p className="daygroup">
              {dayLabel(day)} <span>{list.length}</span>
              {t?.settled ? (
                <em className={t.units > 0 ? "win" : t.units < 0 ? "loss" : ""}>
                  {" "}· {t.w}W {t.l}L {t.units > 0 ? "+" : ""}{t.units}u
                </em>
              ) : null}
            </p>
            <div className="feed">
              {list.map((e) => (
                <div key={`${e.gameId}:${e.type}`} className="feed-item">
                  <span className={"dot " + (e.type === "settle" ? e.result : "in")} />
                  <div className="feed-main">
                    <span className="league">{SPORT_LABEL[e.sport] || e.league}</span>
                    {e.match}
                    <small>
                      {LABEL[e.type]} {fmtTime(e.at)}
                      {e.price ? ` · ${Number(e.price).toFixed(2)}` : ""}
                      {e.result ? ` · ${e.result === "correct" ? "won" : e.result === "push" ? "push" : "lost"}` : ""}
                      {e.final ? ` ${e.final}` : ""}
                      {e.units ? ` · ${e.units > 0 ? "+" : ""}${Number(e.units).toFixed(2)}u` : ""}
                    </small>
                    {e.why && e.type === "entry" && <div className="why">{e.why}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <p className="muted-note" style={{ marginTop: 16 }}>
        Showing the last {events.length} events. <Link href="/record">The full graded record →</Link>
      </p>
    </>
  );
}
