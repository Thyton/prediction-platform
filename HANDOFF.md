# TipLab — state and handoff (updated 2026-11-26, evening)

Read this before touching anything. Sections 1-3 are what the product is and
where it stands; section 4 is the open work, top item first.

**Everything below is committed and pushed on `main`. Nothing is half-saved.**
The one thing not done is the *deploy*: Vercel's 100-API-deployments-per-day cap
is spent (resets ~03:44Z), so the tree is ahead of the live site. `engine/ship.sh`
retries automatically and `bash engine/ship.sh` is the way to land it.

## 1. What this product is

TipLab (tiplab.io) publishes sports picks **with the price and the reasoning
locked in before kickoff**, then grades every result in public — wins and losses.
The differentiator is a verifiable forward record, so nothing may ever flatter
it. Picks and the record are free; the $9 Pro tier sells live in-play signals.

Stack: Next.js on Vercel, engine is stdlib Python.

**Deploying:** pushing does NOT deploy. `engine/publish.py` pushes files to the
Vercel API. Engine secrets live in `engine/.env` (template: `engine/.env.example`).
Deploys are content-hash and budget guarded (Hobby allows 100/day).

**Running the engine:** GitHub Actions, on a public repo — Actions minutes are
unlimited and free there, so this costs nothing and does not need any server.
`.github/workflows/cycle.yml` is the heartbeat: every run **queues the next one
itself** (~30 min after a full pass, ~5 min after a live pass) because GitHub's
own scheduler misses slots on this account. One hourly cron exists only as a
backstop if the chain breaks. The run decides its own mode from the age of
`data/state.json`: over 25 minutes stale means a full pass, fresher means
live-signals-only.

Two things that must stay true or the chain silently dies:

- `permissions: actions: write` — without it the dispatch returns 422 and, worse,
  `curl` still exits 0. The chain step now checks for HTTP 204 and fails loudly.
- The YAML must parse. A heredoc whose lines start at column 0 breaks the whole
  workflow and GitHub then reports "does not have workflow_dispatch trigger".
  Validate with `python -c "import yaml;yaml.safe_load(open('.github/workflows/cycle.yml'))"`
  before pushing.

Secrets: `VERCEL_TOKEN` and `ODDS_API_KEY` are GitHub repo secrets. `GITHUB_TOKEN`
is automatic and now has the write scope it needs.

The Windows Scheduled Task `TipLabCycle` still exists as a local fallback. Do not
look for GitHub *schedule* reliability — it is a known dead end here.

## 2. Where it actually stands

The site is built, live and takes money (live Stripe, `cs_live_` checkout
verified end to end). But it is **not ready for paid promotion** and the reason
is no longer code:

- Forward record: **9 picks, 3–4, −3.49u**, all placed under rules that have
  since been replaced.
- The gates are now learned per sport rather than fixed (`learn.py` raises a
  sport's floor and tightens its claims when that sport loses at the prices
  taken, in 0.02 steps to 0.80). With 9 settled picks nothing is tuned yet —
  below 20 per sport the tuner correctly stays silent.
- The replay wins ~88% above 0.72 but only contains 2 picks, because the samples
  are small. Practical consequence: **judge at roughly 50 forward picks.** Until
  then, promotion copy should say "free during beta, judge the record."

Do not inflate the record to look better. Splitting forward from replay, and
grading draws as pushes, were both deliberate.

## 3. Done today — do not undo

- Watch is **in-page**: cards expand a live score panel (`/api/score`, JS, polls
  every 20s). No outbound ESPN links remain. Keep it that way — leaking users
  off-site is the product's main sin.
- **Depth pages**, all fed by ESPN's free public endpoints and all inside our
  site: `/team/<sport>/<teamId>` (record, form, fixture list, squad, plus our own
  record on that team) and `/player/<sport>/<athleteId>`. Never replace them with
  outbound ESPN links.
- **`/p/<encodedGameId>`** is a public, sign-in-free page for one pick — the
  landing target for every shared link. `app/share-button.js` uses the OS share
  sheet with a clipboard fallback.
- Activity tab is a **day strip + itemised desk log**. It was being fetched and
  never rendered (empty panel) before; keep it mounted in `Tabs`.
- All-games is a real browser: 300 grouped rows, per-sport filter chips, in-play
  toggle, team links. Do not shrink it back to a slice.
- The record page shows a per-competition W/L/units table and the current streak.
  A negative sport is the point of it — it is what the tuner reacts to.
- Every card has a `why` line generated from the model's own numbers. Do not
  replace it with free-form LLM prose — it must never contradict the record.
- Auth: signup and sign-in are separate. Signup = create, 409 if taken; login =
  sign in only, 401 `badpw` / 404 `missing`. Password reset is a hashed,
  single-use, 30-minute token. Do not merge these back into one endpoint.
- Draws grade as `push` at 0u. Conviction floor is now **tuned per sport**
  (`engine/learn.py` → `engine/tuned.json`, default 0.70). Model prices come from
  `1/(prob*0.93)`, never a markup.
- Model learning loop: `learn.py` calibrates a per-sport confidence scale and
  gate floor from settled picks (needs 20 per sport) and `model.py` applies them.
  Line movement is tracked in `data/line_history.json` (`engine/lines.py`) and a
  drift against the favourite raises an integrity alert. Live signals carry a
  real live price; >15% against the lock upgrades HOLD/CAUTION to **PULL_OFF**.
- `/pricing`, account settings with a billing portal link, contact identity,
  og:image, new-pick badges.

### 3.1 Mobile rules (regression-prone, learned the hard way)

- Base rules come **after** the mobile blocks in `globals.css` in places, so a
  mobile override that must win goes in the trailing `@media` block at the
  bottom, not the first one.
- Scroll strips (`.tabs`, `.nav nav`, `.filters`, `.daystrip`) need
  `min-width: 0` or they widen the page instead of scrolling.
- Column hiding is by `.hide-sm` class. Do not reintroduce
  `td:nth-child(n+4)` — it hid Result and Units, the two columns that matter.
- Verify with a 390px viewport and check
  `scrollWidth - clientWidth === 0`: `node /tmp/shot.cjs` (playwright, see 6.1).

## 4. THE tick list

### 4.0 DONE today (2026-11-26 evening) — do not redo

- **Sport hubs** `/sport/<sport>`: record in the sport, open picks, ESPN
  standings, upcoming fixtures. 18 league chips link here; tennis/UFC/esports
  stay as in-place filters because they have no table. Standings rows link to
  team pages and team pages breadcrumb back. In the sitemap.
- **Team follows**: `/api/follow-team` + button on team pages, and the digest
  mails a member their followed teams first.
- **Auth hardened**: scrypt, transparent rehash of legacy SHA-256 on login,
  signup and reset write scrypt. A double-salt bug was caught by the contract
  tests and fixed. All 8 contract cases pass, legacy migration verified.
- **Stripe portal unblocked**: a live portal configuration now exists
  (`bpc_1UftAaHIlSlzaM2CDrmgEz2w`) and `/api/portal` pins it via
  `STRIPE_PORTAL_CONFIG`. Members can cancel again.
- **Webhook**: the endpoint exists and is live but its event list is narrow —
  `GET /api/admin/webhook-events/<ADMIN_KEY>` adds the subscription events the
  handler already supports (idempotent).
- **Digest** fires on the first full pass at/after 07:00Z, not only hour 07.
- **Streak badge** on pick cards from 3 wins/losses, hidden otherwise.
- **og:image** for `/record` and `/pricing`.
- **Email reply-to** `support@pinzak.com` (tiplab.io has no inbound mailbox).
- **Pick page** names what tracking does and links on to the sport hub.
- Deploy quota: clean skip on 402, 20-min live chain, live capped at 55/day,
  live rate-limit, `--force`, and a Git-deploy fallback (`publish_git.py`).

### 4.0b Growth surfaces still missing

Roughly in value order. All are buildable from data already in `data/`.

1. **Sport hubs** (`/sport/<sport>`): standings, our record in that competition,
   the picks, the fixtures. Team pages exist but have no parent; the chips in the
   games tab should point here instead of filtering in place.
2. **Team following**: `follows` is game-keyed only. A team follow that survives
   seasons is the bookmark loop — needs a `teams` key in the store and a digest
   line ("2 picks on teams you follow today").
3. **Streak / "on a run" badge** on the pick card when the desk is hot, sourced
   from `streakOf()` in `lib/data.js`. Show it only when it is true.
4. **Copy-the-desk**: one tap turns a pick into a stake-1u tracked entry
   (today `FollowButton` exists but the record is per-user and empty).
5. **og:image per team and per pick** — a shared `about:blank`-style 1200×630 for
   `/p/[id]` with the result. `app/opengraph-image.js` is the template.


### 4.1 Email — DONE (2026-11-26)

Working end to end. Delivering from `TipLab <updates@tiplab.io>`; welcome and
password-reset mail both verified arriving in a real inbox, not spam.

What exists now, do not redo:

- Resend account under `ai@pinzak.com`; **tiplab.io verified** (DKIM, SPF MX, SPF
  TXT and the `rsend` CNAME all added on Vercel DNS, all green).
- Vercel project env: `RESEND_API_KEY`, `EMAIL_FROM`, `ALERT_SECRET`, `ADMIN_KEY`
  (production + preview). The first two are also in `engine/.env`.
- `send()` in `lib/email.js` returns a real provider result; `configured()` is
  true, so the "return the link in the response" beta fallback no longer fires.

Still open on email:

- `EMAIL_FROM` should eventually be a mailbox someone reads (`updates@tiplab.io`
  is send-only because tiplab.io has **no inbound mailbox** — pinzak.com has
  Google MX, so a reply-to of `support@pinzak.com` is the right move).
- Nothing sends the daily digest yet in practice: `send_digest()` still only
  fires at hour 07 UTC and only on a full pass (see 4.4).

### 4.2 Stripe

- **Customer portal — STILL BLOCKING.** Settings → Billing → Customer portal →
  enable. `/api/portal` returns `portal=noportal` (Stripe 400) so a paying member
  cannot cancel, and the legal pages promise cancellation.
  There is also a route to do this from code once deploys are available again:
  `GET /api/admin/portal-setup/<ADMIN_KEY>` creates a portal configuration with
  cancellation, invoice history, card update and email change enabled. It is
  idempotent (reports `already`). It currently returns a blank 500 on Vercel and
  is being debugged — the local case works, so suspect the Stripe key lines.
  Note the key travels in the **path**, not the query string: Vercel stripped
  `?k=` from the function's URL, which is why the route was moved to a `[key]`
  dynamic segment.
- **Webhook**: confirm an endpoint exists at
  `https://tiplab.io/api/stripe/webhook` subscribed to `checkout.session.completed`,
  `customer.subscription.updated`, `customer.subscription.deleted`.
  `STRIPE_WEBHOOK_SECRET` is already set and signature checking works.

### 4.3 Engine off the laptop

DigitalOcean droplet `162.243.0.218` (also runs legacy FormTally — check
headroom and that Python is 3.11+, the code uses `datetime.UTC`).

```
ssh-copy-id root@162.243.0.218          # from the operator's machine
git clone https://github.com/Thyton/prediction-platform.git ~/tiplab
cd ~/tiplab && cp engine/.env.example engine/.env   # fill in
bash engine/server-setup.sh
cd ~/tiplab/engine && python3 -X utf8 cycle.py      # must exit 0, must deploy
```

Two clean runs, then `schtasks /Change /TN TipLabCycle /DISABLE` on the Windows
box.

### 4.4 Timing of the digest

`send_digest()` only fires at hour 07 UTC and only on a full pass. Fixture-heavy
mornings mean the first full pass can land well after 7, so the digest can miss
the day entirely. Make it "first full pass at or after 07:00", not "hour == 7".

### 4.5 Smaller, real

- `app/api/checkout/route.js` surfaces Stripe's raw error JSON. Map to a
  friendly message, log the detail.
- `lib/store.js` `hash()` is bare SHA-256. Do not change in place — accept
  scrypt on login and re-hash on the next successful sign-in.
- `/games` tab renders 80 rows unordered. Sort by kickoff.
- Add `og:image` to `/record` and `/pricing` (only `/` has one).


### 4.6 Deploy quota — the real blocker on shipping (2026-11-26)

Hobby allows **100 API deployments a day** and the 5-minute engine chain
spends them by lunchtime. When the cap is hit, *code* cannot ship at all
(Vercel returns `402 payment_required / api-deployments-free-per-day`), and the
daily counter counts a rolling 24h so it recovers slowly.

Mitigations now in the tree:
- a spent quota raises `OutOfBudget` and the pass **skips cleanly** instead of
  crashing (it used to lose the whole cycle's work on the 402).
- the live chain runs every 20 min, not 5 (cycle.yml), which fits the cap.
- live-only deploys are capped at 55 a day (`LIVE_DEPLOY_BUDGET`) and
  rate-limited (`LIVE_DEPLOY_GAP_S`); full passes are never throttled and use the
  whole 85 budget.
- unchanged signal payloads already skip on content hash.
- `publish.py --force` skips our guard for a deliberate ship.
- `engine/publish_git.py`: commit + push instead of calling the API. A Git push
  build does **not** count against the API quota. `publish.py` falls back to it
  automatically when the cap is reached (`DEPLOY_VIA_GIT=1`, the default).

**One dashboard step is still needed for the fallback to work:** Vercel →
project `web` → Settings → Git → Connect Git Repository →
`Thyton/prediction-platform`, production branch `main`. The API cannot do it —
the Vercel account has no GitHub login connection, so
`POST /v9/projects/<id>/link` returns "add a Login Connection to your GitHub
account first". Until it is connected the fallback prints
`git deploy: nothing to push` / pushes nothing that Vercel builds.

Once Git-linked, also re-point the engine at `publish_git.py` for full passes
and keep `publish.py` as the break-glass path.


## 4b. Account steps only Marco can do (blockers, not code)

1. **Vercel → GitHub login connection.** For the git deploy path to work,
   connect GitHub on the Vercel account, then Project `web` → Settings → Git →
   Connect Repository → `Thyton/prediction-platform`, production `main`.
   Until then the site can only ship through the API quota (100/day).
   Once done, set `DEPLOY_VIA_GIT=0` nowhere — leave it on so the engine pushes
   instead of burning quota.
2. **Consider upgrading the Vercel plan (Pro, $20/mo).** Hobby's 100
   deployments a day is the same number every single day; the engine alone
   wants ~120 and a code ship needs headroom. Pro removes the cap and the
   10-second function limit the digest is fighting.
3. **Confirm the webhook signing secret on the enabled endpoint.** The
   TipLab endpoint exists and is live but its event list was narrow; run
   `GET https://tiplab.io/api/admin/webhook-events/<ADMIN_KEY>` once deployed to
   add the subscription events (`--` it is idempotent and reports `already`).
4. Send one real test message from the dashboard contact form so a reply lands
   in `support@pinzak.com` and confirm it arrives.

**Fastest unblock:** `bash engine/ship.sh` — it retries the deploy every 15
minutes until the cap clears (resets ~03:44Z daily), then verifies the routes.
Run it in the background and leave it. Do not hand-deploy before it.

## 5. Rules

- `npm run build` must pass; then verify live with
  `curl -s -o /dev/null -w "%{http_code}" https://tiplab.io/<route>` → 200.
- Auth contract to preserve:

  | case | expect |
  | --- | --- |
  | signup, new address | 200 + session |
  | signup, address taken | 409, `code: exists` |
  | login, wrong password | 401, `code: badpw` |
  | login, unknown address | 404, `code: missing` |
  | forgot, any address | 200 always (no enumeration) |
  | reset token reuse | 400 expired/used |
  | `POST /api/checkout` signed out | 401 |
  | `POST /api/checkout` signed in | JSON `{url}` pointing at checkout.stripe.com |

- Pages may only **read** cookies. Writing them in a render throws
  `DYNAMIC_SERVER_USAGE` and 500s the page — use middleware, and pass values to
  the page via a request header (a cookie set by middleware is already updated
  by the time the page reads it).
- Never commit `engine/.env`.
- Don't touch `MIN_EDGE`, `MODEL_MARGIN`, the floors, or the forward/backtest
  split without saying so.

## 6. Verification

### 6.1 Mobile verification

```
cd /tmp && npm i playwright@1.65.1 && npx playwright install chromium
# shot.cjs: newPage({viewport:{width:390,height:844}}), goto each route,
# assert (scrollWidth - clientWidth) === 0, screenshot
node shot.cjs
```

Anything non-zero is a real bug. This found three on the depth pages before they
shipped (nav overflow on every page, a never-collapsing two-column block, and
scroll strips widening the page).

### 6.2 Free data sources already in use

All public, no key: `site.api.espn.com` scoreboard / teams / roster / schedule,
`site.api.espn.com/apis/v2/.../standings`, plus the odds API for prices
(`ODDS_API_KEY`, ~18.8k credits left). Team ids come from the collector
(`homeId`/`awayId`). Tennis and esports have no team id — their links must stay
plain text.
