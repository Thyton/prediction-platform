import Link from "next/link";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

export const metadata = {
  metadataBase: new URL("https://tiplab.io"),
  title: "TipLab — timestamped sports picks",
  description:
    "Market-aware sports picks locked before the price moves, with a public forward record graded in the open.",
  openGraph: {
    title: "TipLab — every pick locked, before the price moves",
    description:
      "Timestamped picks across 20+ competitions, a public forward record, and live in-play get-in/get-out signals.",
    url: "https://tiplab.io",
    siteName: "TipLab",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "TipLab", description: "Picks locked before the price moves." },
};

export const viewport = { themeColor: "#060e1a" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <main className="shell">
          <Analytics />
          <header className="nav">
            <Link className="brand" href="/">TIP<span>LAB</span></Link>
            <nav>
              <Link href="/play">Arcade</Link>
              <Link href="/#tips">The board</Link>
              <Link href="/record">Record</Link>
              <Link href="/method">Method</Link>
              <Link href="/pricing">Pricing</Link>
              <Link className="login" href="/dashboard">Sign in</Link>
            </nav>
          </header>
          {children}
          <footer>
            <span>Research only. No money wagered on your behalf.</span>
            <span style={{ display: "inline-flex", gap: 18 }}>
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
              <span>© TipLab</span>
            </span>
          </footer>
        </main>
      </body>
    </html>
  );
}
