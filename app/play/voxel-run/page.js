import Game from "./game";

export const metadata = {
  title: "Voxel Run — a free browser parkour game | TipLab",
  description:
    "A new voxel parkour course every day. Sprint the platforms, dodge the lava, chase the clock. Free, no install, plays on phone and desktop.",
  alternates: { canonical: "/play/voxel-run" },
  openGraph: {
    title: "Voxel Run — free daily parkour",
    description: "Sprint a fresh voxel course every day. Free in your browser.",
    url: "/play/voxel-run",
  },
};

export default function Page() {
  return (
    <div className="playpage">
      <Game />
      <section className="playinfo">
        <h2>How it works</h2>
        <p>
          Every day generates one course from a date seed, so everyone runs the same
          layout. Three lives, a clock, and no checkpoints past the one you earned.
          Lava burns, crumbling blocks give way, and sliding platforms move under you.
        </p>
        <p>
          The whole course is boxes: procedurally generated, so it never runs out and
          never repeats. Nothing to download.
        </p>
        <h2>Controls</h2>
        <p>
          WASD to move, Space to jump (hold to bounce), Shift to sprint, mouse to look.
          R restarts, Esc pauses. On a phone the pads appear at the bottom of the screen.
        </p>
      </section>
    </div>
  );
}
