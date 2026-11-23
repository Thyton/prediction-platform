export const dynamic = "force-dynamic";
// Returns env booleans AND the odds key so the local engine can use it.
export async function GET(req) {
  const key = process.env.ODDS_API_KEY || "";
  const sport = new URL(req.url).searchParams.get("sport") || "";
  let out = { hasOddsKey: Boolean(key), oddsKey: key, dbOk: Boolean(process.env.DATABASE_URL), stripe: Boolean(process.env.STRIPE_SECRET_KEY) };
  if (sport && key) {
    try {
      const r = await fetch(`https://api.the-odds-api.com/v4/sports/${sport}/odds?apiKey=${key}&regions=us&markets=h2h&oddsFormat=decimal`, { cache: "no-store" });
      const t = await r.text();
      out.ok = r.ok;
      out.events = r.ok ? JSON.parse(t).length : 0;
      if (!r.ok) out.err = t.slice(0, 120);
    } catch (e) { out.err = String(e.message).slice(0, 90); }
  }
  return Response.json(out);
}
