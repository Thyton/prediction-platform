# Going live on tiplab.io (5 minutes, needs Marco's Vercel login)

1. Vercel → the `web` project (pinzak1/web) → Settings → Git → connect a repo.
   Push this folder to a GitHub repo first (private is fine).
2. Build settings: framework **Next.js**, install `npm install`, build `npm run build`.
3. Environment variables to add:
   - `CRON_SECRET` = any random string
   - `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID` (optional, enables real checkout)
   - `BLOB_READ_WRITE_TOKEN`, `BLOB_STORE_URL` (optional, moves accounts off local disk)
4. Deploy. tiplab.io already points at Vercel.
5. GitHub repo → Actions → run `cycle` once.

Note: Vercel's Node runtime has no Python, so the cron endpoint can't run the engine.
Real 24/7 comes from the GitHub Action (commits data, Vercel redeploys) and, while
that is being set up, from the local `TipLabCycle` scheduled task.

## Pricing decided (2026-11-23)

- Free during beta: all picks, alerts, record
- Pro $9/month (or $1/week): live in-play alerts, priority drops, full record detail
- First 500 subscribers keep founding pricing permanently

## Marketing angle (the honest one)

1. We price, we don't guess — every tip starts from the real de-vigged market price and
   only ships when learned team ratings disagree by 4.5%+.
2. It learns from every result — ratings update on all finals, retrained daily.
3. Integrity signals — thin markets / lopsided prices flagged before you bet them.
4. Locked before the price moves — timestamped release, graded in public, nothing deleted.
