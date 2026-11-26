# TipLab — work brief for Codex

Read this whole file before touching anything, then work top to bottom.
Repo: `https://github.com/Thyton/prediction-platform`, branch `main`.

---

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

### 4.0 Growth surfaces still missing

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
