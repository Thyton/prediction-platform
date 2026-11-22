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
