import Link from "next/link";

export const metadata = {
  title: "Arcade sources and licences | TipLab",
  description: "What the TipLab arcade games are built from, what is licensed, and what is original.",
  alternates: { canonical: "/play/legal" },
};

// The research is blunt about this: mechanics are not copyrightable, but names,
// art and code are. Publishing the sources is cheap insurance and makes the
// "this is not a rip-off" claim checkable instead of a promise.
export default function Legal() {
  return (
    <div className="legal">
      <p className="eyebrow">ARCADE</p>
      <h1>Sources and licences</h1>
      <p className="lede">
        Every game in the arcade is an original build. Here is exactly what it is made of.
      </p>

      <h2>What we rebuild, and what we do not</h2>
      <p>
        Game <b>mechanics</b> — running, jumping, stacking, clearing lines — are genre
        conventions, not protectable works. We rebuild the mechanics and write our own
        code. We do not decompile, copy source, or reuse another studio&apos;s art, audio
        or level layouts. Where a genre has a well-known name we use our own.
      </p>

      <h2>Engine and libraries</h2>
      <ul>
        <li><b>three.js</b> — MIT licence, © three.js authors. Rendering.</li>
        <li><b>Next.js</b> and <b>React</b> — MIT licence, © Vercel and Meta. Page shell.</li>
      </ul>
      <p>
        MIT permits commercial use; the copyright notices are retained in each package
        under <code>node_modules</code> and reproduced by the packages themselves.
      </p>

      <h2>Art</h2>
      <p>
        There is no third-party art in Voxel Run. Every platform, cloud and hill is a
        generated box, and the palette is our own. Later games may use
        <b> Kenney.nl</b> assets (CC0 1.0 — commercial use, no attribution required,
        no share-alike) and CC0 packs only; anything requiring attribution will be
        credited on this page before it ships.
      </p>

      <h2>Names</h2>
      <p>
        &quot;.io&quot; is a country-code domain suffix in wide generic use. Well-known
        genre titles are the property of their owners; nothing in the arcade is
        affiliated with or endorsed by them.
      </p>

      <h2>Contact</h2>
      <p>
        Something here looks too close to your work? <Link href="/terms">Terms</Link> and
        the contact route there reach us directly.
      </p>

      <p className="muted-note">Last reviewed 26 November 2026.</p>
    </div>
  );
}
