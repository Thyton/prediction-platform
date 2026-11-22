import Link from "next/link";
import "./globals.css";

export const metadata = {
  title: "TipLab — timestamped sports picks",
  description: "Transparent, timestamped sports picks across sport, with a public record and integrity alerts.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <main className="shell">
          <header className="nav">
            <Link className="brand" href="/">TIP<span>LAB</span></Link>
            <nav>
              <Link href="/#tips">Tips</Link>
              <Link href="/record">Record</Link>
              <Link href="/method">Method</Link>
              <Link className="login" href="/dashboard">Sign in</Link>
            </nav>
          </header>
          {children}
          <footer>
            <span>Research only. No money wagered on your behalf.</span>
            <span>© TipLab</span>
          </footer>
        </main>
      </body>
    </html>
  );
}
