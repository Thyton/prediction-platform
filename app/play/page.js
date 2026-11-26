import Link from "next/link";

export const metadata = {
  title: "TipLab Arcade — free browser games",
  description: "Free browser games, no install and no signup. New courses daily, pixel and voxel worlds, all playable on phone and desktop.",
  alternates: { canonical: "/play" },
};

// Games are self-hosted rather than embedded so the ad revenue is ours. A card
// only appears here once its page exists — no dead links on a launch day.
const GAMES = [
  {
    slug: "voxel-run",
    title: "Voxel Run",
    blurb: "First-person parkour across floating islands. A new course every day, three lives, and lava that does not forgive.",
    tag: "Daily course",
    live: true,
  },
];

const SOON = [
  ["Blockfall", "Stack and clear against a rising speed curve."],
  ["Sky Duel", "Two-player duel on shrinking platforms."],
  ["Depth Dive", "Endless descent past crumbling ledges."],
];

export default function Arcade() {
  return (
    <div className="arcade">
      <section className="arcade-hero">
        <p className="eyebrow">TIPLAB ARCADE</p>
        <h1>Free games,<br /><em>no install.</em></h1>
        <p className="lede">
          Playable in the tab on any phone or desktop. No signup, no download, and
          nothing to install. New courses rotate daily.
        </p>
      </section>

      <div className="game-grid">
        {GAMES.map((g) => (
          <Link key={g.slug} href={`/play/${g.slug}`} className="game-tile">
            <div className={`tile-art art-${g.slug}`}>
              <span className="tile-tag">{g.tag}</span>
            </div>
            <div className="tile-body">
              <h2>{g.title}</h2>
              <p>{g.blurb}</p>
              <span className="tile-play">Play →</span>
            </div>
          </Link>
        ))}
        {SOON.map(([title, blurb]) => (
          <div key={title} className="game-tile soon">
            <div className="tile-art art-soon"><span className="tile-tag">Soon</span></div>
            <div className="tile-body">
              <h2>{title}</h2>
              <p>{blurb}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="muted-note">
        Games are built fresh for TipLab in an open-source engine. Mechanics are
        genre-standard, never copied code or art — <Link href="/play/legal">sources and licences</Link>.
      </p>
    </div>
  );
}
