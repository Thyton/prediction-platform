// Shared, server-free helpers. Safe to import from client components — keep
// lib/data.js for filesystem access only.
export function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export const SPORT_LABEL = {
  nba: "NBA", nfl: "NFL", mlb: "MLB", nhl: "NHL", ncaab: "NCAAB", ncaaf: "NCAAF", wnba: "WNBA",
  epl: "EPL", laliga: "La Liga", seriea: "Serie A", bundesliga: "Bundesliga",
  ligue1: "Ligue 1", ucl: "Champions League", uel: "Europa League", mls: "MLS",
  brasileirao: "Brazil Série A", ligaprof: "Argentina Primera", superlig: "Turkish Süper Lig",
  ligapt: "Primeira Liga", eredivisie: "Eredivisie", ligamx: "Liga MX",
  atp: "ATP", wta: "WTA", ufc: "UFC", esports: "Esports",
};
