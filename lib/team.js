import fs from "node:fs";
import path from "node:path";

// Team pages read ESPN's free public team endpoints (schedule, roster, record,
// standing). Cached in-process for 10 minutes — a team page is a browse surface,
// not a live ticker, and Vercel is serverless so the cache is per-warm-instance.
const BASE = "https://site.api.espn.com/apis/site/v2/sports";
const V2 = "https://site.api.espn.com/apis/v2/sports";
const UA = { "User-Agent": "Mozilla/5.0 (compatible; TipLab/1.0)" };

export const LEAGUE_PATH = {
  nba: "basketball/nba", nfl: "football/nfl", mlb: "baseball/mlb", nhl: "hockey/nhl",
  ncaab: "basketball/mens-college-basketball", ncaaf: "football/college-football",
  epl: "soccer/eng.1", laliga: "soccer/esp.1", seriea: "soccer/ita.1",
  bundesliga: "soccer/ger.1", ligue1: "soccer/fra.1", ucl: "soccer/uefa.champions",
  mls: "soccer/usa.1", brasileirao: "soccer/bra.1", ligamx: "soccer/mex.1",
  superlig: "soccer/tur.1", ligapt: "soccer/por.1", eredivisie: "soccer/ned.1",
  ligaprof: "soccer/arg.1",
};

const cache = new Map();
const TTL = 10 * 60 * 1000;

async function get(url) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  try {
    const r = await fetch(url, { headers: UA, next: { revalidate: 600 } });
    if (!r.ok) return null;
    const data = await r.json();
    cache.set(url, { at: Date.now(), data });
    return data;
  } catch {
    return null;
  }
}

export function teamPath(sport, teamId) {
  return `${LEAGUE_PATH[sport]}/teams/${teamId}`;
}

export function canTeam(sport, teamId) {
  return Boolean(LEAGUE_PATH[sport] && teamId);
}

// Everything a team page needs, in one call. Each block degrades to null.
export async function getTeam(sport, teamId) {
  const base = teamPath(sport, teamId);
  if (!base) return null;
  const [info, sched, roster] = await Promise.all([
    get(`${BASE}/${base}`),
    get(`${BASE}/${base}/schedule`),
    get(`${BASE}/${base}/roster`),
  ]);
  const team = info?.team;
  if (!team) return null;

  const now = Date.now();
  const val = (v) => (v && typeof v === "object" ? v.displayValue ?? v.value ?? null : v ?? null);
  const events = (sched?.events || []).map((e) => {
    const c = (e.competitions || [{}])[0];
    const side = (h) => (c.competitors || []).find((x) => x.homeAway === h);
    const H = side("home");
    const A = side("away");
    const mine = (c.competitors || []).find((x) => String(x.team?.id) === String(teamId));
    const opp = (c.competitors || []).find((x) => String(x.team?.id) !== String(teamId));
    const at = new Date(e.date).getTime();
    return {
      id: e.id,
      at: e.date,
      past: at < now,
      home: H?.team?.displayName,
      away: A?.team?.displayName,
      hs: val(H?.score),
      as: val(A?.score),
      won: typeof mine?.winner === "boolean" ? mine.winner : null,
      oppLogo: opp?.team?.logo,
      state: c.status?.type?.state,
    };
  });

  const played = events.filter((e) => e.past && e.won !== null);
  const w = played.filter((e) => e.won).length;
  const l = played.filter((e) => !e.won).length;

  // form: last 5 decided results, oldest to newest for a left-to-right read
  const form = played.slice(-5).map((e) => (e.won ? "W" : "L"));
  let run = { kind: null, n: 0 };
  for (let k = played.length - 1; k >= 0; k--) {
    const r = played[k].won ? "W" : "L";
    if (!run.kind) run.kind = r;
    if (r !== run.kind) break;
    run.n++;
  }

  const athletes = (roster?.athletes || []).map((a) => ({
    id: a.id,
    name: a.fullName,
    pos: a.position?.abbreviation || "",
    jersey: a.jersey,
    headshot: a.headshot?.href || null,
    age: a.age,
  }));

  const text = (v) => (typeof v === "string" ? v : v?.value || v?.displayValue || null);
  return {
    id: teamId,
    sport,
    name: team.displayName,
    short: team.shortDisplayName || team.abbreviation,
    abbr: team.abbreviation,
    logo: team.logos?.[0]?.href || null,
    color: team.color ? `#${team.color}` : null,
    record: text(team.record?.items?.[0]?.summary),
    recordWhat: text(team.record?.items?.[0]?.description),
    standing: text(team.standingSummary),
    w, l, form, run,
    upcoming: events.filter((e) => !e.past).sort((a, b) => new Date(a.at) - new Date(b.at)).slice(0, 6),
    recent: events.filter((e) => e.past).sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 8),
    roster: athletes.slice(0, 40),
  };
}

// Pick results for this team, joined from our own ledger.

// League table for the sport hubs. ESPN's v2 standings endpoint is public and
// free; shape it down to what the table needs. Degrades to [] for sports that
// don't publish standings (tennis, esports, UFC) — the hub simply hides it.
export async function getStandings(sport) {
  const base = LEAGUE_PATH[sport];
  if (!base) return [];
  const d = await get(`${V2}/${base}/standings`);
  const children = d?.children || [];
  const out = [];
  for (const child of children) {
    for (const entry of child.standings?.entries || []) {
      const team = entry.team;
      const stats = entry.stats || [];
      const pick = (abbr) => {
        const s = stats.find((x) => x.name === abbr || x.abbreviation === abbr);
        return s ? s.displayValue ?? s.value : null;
      };
      out.push({
        id: team?.id,
        name: team?.displayName,
        logo: team?.logos?.[0]?.href,
        record: pick("overall") || pick("wins") || "",
        form: team?.form || [],
      });
    }
  }
  return out;
}

export function teamPicks(ledger, name) {
  const n = String(name || "").toLowerCase();
  if (!n) return [];
  return ledger.filter(
    (p) => String(p.home || "").toLowerCase() === n || String(p.away || "").toLowerCase() === n
  );
}

// One athlete, from the league roster feed (which is where the rich fields
// live — headshot, position, height, college, injury). Cached like getTeam.
export async function getPlayer(sport, teamId, athleteId) {
  const base = teamPath(sport, teamId);
  if (!base) return null;
  const data = await get(`${BASE}/${base}/roster`);
  const a = (data?.athletes || []).find((x) => String(x.id) === String(athleteId));
  if (!a) return null;
  const injury = (a.injuries || [])[0];
  return {
    id: a.id,
    name: a.fullName,
    short: a.shortName,
    pos: a.position?.displayName || a.position?.abbreviation || "",
    jersey: a.jersey,
    age: a.age,
    height: a.displayHeight,
    weight: a.displayWeight,
    college: a.college?.name || null,
    birthplace: a.birthPlace
      ? [a.birthPlace.city, a.birthPlace.state, a.birthPlace.country].filter(Boolean).join(", ")
      : null,
    experience: a.experience?.years ?? null,
    headshot: a.headshot?.href || null,
    status: a.status?.name || null,
    injury: injury
      ? { status: injury.status || "", detail: injury.longComment || injury.shortComment || "" }
      : null,
    teamId,
    sport,
  };
}

// Which team an athlete belongs to, so /player/<sport>/<id> needs no team param.
// Walks the league's rosters (cached); stops at the first hit.
export async function findPlayerTeam(sport, athleteId) {
  const league = LEAGUE_PATH[sport];
  if (!league) return null;
  // all basketball/football/baseball/hockey/soccer leagues expose one teams
  // directory; soccer's lives on /v2.
  const dir = soccer(league) ? `${V2}/${league}/teams` : `${BASE}/${league}/teams`;
  const data = await get(dir);
  const teams = data?.sports?.[0]?.leagues?.[0]?.teams || [];
  for (const entry of teams) {
    const id = entry.team?.id || entry.id;
    if (!id) continue;
    const roster = await get(`${BASE}/${league}/teams/${id}/roster`);
    if ((roster?.athletes || []).some((a) => String(a.id) === String(athleteId))) return id;
  }
  return null;
}

function soccer(league) {
  return league.startsWith("soccer");
}

export function dataDir() {
  return path.join(process.cwd(), "data");
}

export function readJson(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dataDir(), name), "utf8"));
  } catch {
    return fallback;
  }
}
