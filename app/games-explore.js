"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { fmtTime, SPORT_LABEL } from "../lib/labels";

// Every tracked game, not a slice of it. Filters are client-side so switching
// sport or day never costs a round trip — the list is already in the payload.
const TOP = ["nba", "nfl", "nhl", "mlb", "ncaab", "ncaaf", "epl"];
const SHOW = 300;

function dayKey(iso) {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const that = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((that - today) / 864e5);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < 0) return `Back ${-diff}d`;
  return `In ${diff}d`;
}

export default function GamesExplore({ games }) {
  const [sport, setSport] = useState("all");
  const [live, setLive] = useState(false);

  const sports = useMemo(() => {
    const counts = {};
    for (const g of games) counts[g.sport] = (counts[g.sport] || 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [games]);

  const rows = useMemo(() => {
    let out = games;
    if (sport !== "all") out = out.filter((g) => g.sport === sport);
    if (live) out = out.filter((g) => g.state === "in");
    return [...out]
      .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
      .slice(0, SHOW);
  }, [games, sport, live]);

  const groups = useMemo(() => {
    const m = new Map();
    for (const g of rows) {
      const k = dayKey(g.startsAt);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(g);
    }
    return [...m.entries()];
  }, [rows]);

  return (
    <>
      <div className="filters">
        <button className={"chip" + (sport === "all" ? " on" : "")} onClick={() => setSport("all")}>
          All <span>{games.length}</span>
        </button>
        {sports.map(([s, n]) => (
          <button key={s} className={"chip" + (sport === s ? " on" : "")} onClick={() => setSport(s)}>
            {SPORT_LABEL[s] || s} <span>{n}</span>
          </button>
        ))}
      </div>
      <p className="muted-note" style={{ marginTop: 10 }}>
        <label className="inline-check">
          <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} /> In play only
        </label>
        {" · "}showing {rows.length} of {games.length}
        {TOP.length ? "" : ""}
      </p>

      {groups.length ? (
        groups.map(([label, list]) => (
          <div key={label}>
            <p className="daygroup">{label} <span>{list.length}</span></p>
            <table>
              <tbody>
                {list.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <span className="league">{SPORT_LABEL[g.sport] || g.league}</span>
                      {g.state === "in" && <span className="live-pulse" style={{ marginLeft: 6 }} />}
                      {g.awayId ? (
                        <Link href={`/team/${g.sport}/${g.awayId}`}>{g.away}</Link>
                      ) : g.away}
                      {" vs "}
                      {g.homeId ? (
                        <Link href={`/team/${g.sport}/${g.homeId}`}>{g.home}</Link>
                      ) : g.home}
                    </td>
                    <td>{fmtTime(g.startsAt)}</td>
                    <td>
                      {g.markets?.h2h
                        ? `${Number(g.markets.h2h.bestOdds).toFixed(2)} · ${g.markets.h2h.bookCount} book(s)`
                        : g.price
                          ? `${g.price.toFixed(2)} · ${g.books || "?"} book(s)`
                          : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      ) : (
        <div className="empty">Nothing matches that filter right now.</div>
      )}
    </>
  );
}
