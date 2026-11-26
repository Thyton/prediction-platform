import { NextResponse } from "next/server";

// Live score for one game, in our own UI so the user never leaves the site.
// Vercel functions have no Python, so this reads ESPN directly in JS and
// mirrors the shape engine/live.py expects.
export const dynamic = "force-dynamic";

const PATHS = {
  nba: "basketball/nba", ncaab: "basketball/mens-college-basketball", wnba: "basketball/wnba",
  nfl: "football/nfl", ncaaf: "football/college-football", mlb: "baseball/mlb", nhl: "hockey/nhl",
  epl: "soccer/eng.1", laliga: "soccer/esp.1", seriea: "soccer/ita.1",
  bundesliga: "soccer/ger.1", ligue1: "soccer/fra.1", ucl: "soccer/uefa.champions",
  uel: "soccer/uefa.europa", mls: "soccer/usa.1", brasileirao: "soccer/bra.1",
  ligaprof: "soccer/arg.1", superlig: "soccer/tur.1", ligapt: "soccer/por.1",
  eredivisie: "soccer/ned.1", ligamx: "soccer/mex.1",
};

const CLOCKED = { nba: [4, 12], ncaab: [2, 20], wnba: [4, 10], nhl: [3, 20], nfl: [4, 15] };

// How far through the game we are, for the progress bar. Clamped either way so a
// missing clock can never produce a bar past 100% or below 0.
function progress(sport, period, clock) {
  if (CLOCKED[sport]) {
    const [periods, per] = CLOCKED[sport];
    const [m, s2] = String(clock || `${per}:00`).split(":").map(Number);
    const secs = (m || 0) * 60 + (s2 || 0);
    const played = ((period || 1) - 1) * per * 60 + Math.max(0, per * 60 - secs);
    return Math.min(1, Math.max(0, played / (periods * per * 60)));
  }
  if (PATHS[sport]?.startsWith("soccer")) {
    const [m] = String(clock || "45").split(":").map(Number);
    const played = ((period || 1) - 1) * 45 + (45 - (m || 45));
    return Math.min(1, Math.max(0, played / 90));
  }
  return 0.5;
}

export async function GET(req) {
  const u = new URL(req.url);
  const id = u.searchParams.get("id") || "";
  const start = u.searchParams.get("start") || "";
  const [sport, eid] = id.split(":");
  const path = PATHS[sport];
  if (!path) return NextResponse.json({ state: "unknown" });

  // try the day before/after the fixture too: ESPN's date bucket is in ET and a
  // late kickoff can land in the neighbouring day's feed
  const base = start ? new Date(start) : new Date();
  const days = [-1, 0, 1].map((k) => {
    const d = new Date(base.getTime() + k * 864e5);
    return d.toISOString().slice(0, 10).replace(/-/g, "");
  });

  for (const dates of [...days, ""]) {
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard${dates ? `?dates=${dates}` : ""}`;
      const r = await fetch(url, { next: { revalidate: 10 } });
      if (!r.ok) continue;
      const j = await r.json();
      const ev = (j.events || []).find((e) => String(e.id) === eid);
      if (!ev) continue;
      const comp = (ev.competitions || [{}])[0];
      const side = (h) => (comp.competitors || []).find((c) => c.homeAway === h);
      const H = side("home");
      const A = side("away");
      if (!H || !A) continue;
      const st = comp.status?.type?.state || "pre";
      const clock = comp.status?.displayClock || "";
      const period = comp.status?.period || 0;
      return NextResponse.json({
        state: st,
        hs: Number(H.score) || 0,
        as_: Number(A.score) || 0,
        clock, period,
        progress: progress(sport, period, clock),
        detail: comp.status?.type?.shortDetail || "",
      });
    } catch {
      /* try the next date */
    }
  }
  return NextResponse.json({ state: "pre" });
}
