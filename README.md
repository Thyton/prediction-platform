# TipLab

Transparent, timestamped sports picks with a public graded record and integrity alerts.

## How it runs

- `engine/` is a Python pipeline. `cycle.py` grades settled picks against real final scores,
  folds every result back into team ratings, then collects the next slate and releases picks.
- `data/` holds the only state the site reads: `games.json`, `state.json`, `ledger.json`.
- `.github/workflows/cycle.yml` runs the cycle every 30 minutes and commits the new data.
  Vercel redeploys on push, so the public site is never more than half an hour stale.
- `app/` is the Next.js front end. Every page is server rendered straight from `data/`.

## Sports covered

NBA, WNBA, NCAAB, NFL, MLB, NHL, UFC, EPL, La Liga, Serie A, Bundesliga, Ligue 1,
Champions League, Europa League, MLS, ATP, WTA and esports (CS2/Dota/LoL/Valorant via bo3.gg).

## Model

1. Market price is the baseline; the book margin is stripped to an implied probability.
2. Team ratings are Elo-style and move with every settled result (margin weighted).
3. A pick releases only when the model beats the de-vigged price by 4.5%
   (7.5% when a single book is quoting).
4. Thin markets and lopsided prices are surfaced as integrity alerts.
5. Record is graded flat at 1 unit so accuracy stays readable.

## Local

```
npm install
python engine/train.py --days 30   # seed ratings from recent finals
python engine/cycle.py             # grade + publish
npm run dev
```

## Deploying

Vercel: import the repo, framework Next.js, then set

- `CRON_SECRET` — any random string; `/api/cron/cycle` requires it
- `STRIPE_SECRET_KEY` and `STRIPE_PRICE_ID` — optional, enables real checkout
- `BLOB_READ_WRITE_TOKEN` + `BLOB_STORE_URL` — optional, moves accounts off local disk

GitHub: enable Actions, then run `cycle` once from the Actions tab.
