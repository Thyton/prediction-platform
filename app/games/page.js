import { getGames, SPORT_LABEL } from "../../lib/data";
import GamesExplore from "../games-explore";

// Standalone every-game browser. The homepage carries the same component inside
// a tab, but that is hidden until the tab is clicked — this route is linkable,
// indexable and reaches the whole tracked slate.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "All games — TipLab",
  description: "Every fixture TipLab is tracking, filterable by competition, with the current market price.",
};

export default function GamesPage() {
  const games = getGames();
  // only the fields the list renders — the full ESPN record is heavy
  const rows = games.map((g) => ({
    id: g.id,
    sport: g.sport,
    league: g.league,
    match: g.match,
    startsAt: g.startsAt,
    state: g.state,
    price: g.markets?.h2h ? Number(g.markets.h2h.bestOdds) : null,
    books: g.markets?.h2h ? String(g.markets.h2h.bookCount) : null,
    home: g.home,
    away: g.away,
    homeId: g.homeId,
    awayId: g.awayId,
  }));

  return (
    <>
      <section className="hero narrow" style={{ paddingBottom: 18 }}>
        <p className="eyebrow">EVERY FIXTURE</p>
        <h1>What we are watching</h1>
        <p className="lede">
          Every game the desk has priced, across {new Set(games.map((g) => g.sport)).size} competitions.
          Filter by sport or jump to a team.
        </p>
      </section>
      <section>
        <GamesExplore games={rows} />
      </section>
    </>
  );
}
