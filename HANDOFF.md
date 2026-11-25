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

**Running the engine:** 30-minute Windows Scheduled Task `TipLabCycle`.
GitHub Actions schedules **do not fire on this account at all** — proven with a
throwaway repo. `workflow_dispatch` works, cron does not. Do not spend time on
that; move the engine to a host instead (task 5).

## 2. Where it actually stands

The site is built, live and takes money (live Stripe, `cs_live_` checkout
verified end to end). But it is **not ready for paid promotion** and the reason
is no longer code:

- Forward record: **9 picks, 3–4, −3.49u**, all placed under rules that have
  since been replaced.
- The gates were tightened today (70% conviction floor, prices 7% below the
  model probability). The replay under those rules wins ~88% but only contains
  2 picks, because the samples are small.
- Practical consequence: **judge at roughly 50 forward picks.** Until then,
  promotion copy should say "free during beta, judge the record."

Do not inflate the record to look better. Splitting forward from replay, and
grading draws as pushes, were both deliberate.

## 3. Done today — do not undo

- Watch is **in-page**: cards expand a live score panel (`/api/score`, JS, polls
  every 20s). No outbound ESPN links remain. Keep it that way — leaking users
  off-site is the product's main sin.
- Activity tab: entries and settles, newest first.
- Every card has a `why` line generated from the model's own numbers. Do not
  replace it with free-form LLM prose — it must never contradict the record.
- Auth: signup and sign-in are separate. Signup = create, 409 if taken; login =
  sign in only, 401 `badpw` / 404 `missing`. Password reset is a hashed,
  single-use, 30-minute token. Do not merge these back into one endpoint.
- Draws grade as `push` at 0u. Conviction floor 70%. Model prices come from
  `1/(prob*0.93)`, never a markup.
- `/pricing`, account settings with a billing portal link, contact identity,
  og:image, new-pick badges.

## 4. THE tick list

### 4.1 Email (biggest blocker)

Nothing can email. Password resets, alert emails and the daily digest all
silently no-op, and signups land unverified.

- **Use `pinzak.com`, not `tiplab.io`.** `pinzak.com` has Google Workspace MX
  records; `tiplab.io` has **no mailbox at all**, so any `@tiplab.io` address
  bounces. Legal pages were already switched to `support@pinzak.com` /
  `privacy@pinzak.com` for this reason.
- Create a Resend account, verify **pinzak.com** as a sending domain (DNS at the
  registrar), make an API key.
- Set on the Vercel project `prj_mybaeapCVsT1BpmCyDoAp1l2wZbA`:
  `RESEND_API_KEY`, `EMAIL_FROM` (e.g. `TipLab <alerts@pinzak.com>`), and
  `ALERT_SECRET` (any random string — the digest and alert routes are open
  without it).
- Copy those same two into `engine/.env` on the runner.
- Verify: signup sends a welcome/verify mail and marks the account `verified`;
  `/api/auth/forgot` returns `emailed: true` with no `link`; `POST /api/alerts`
  reaches a Pro member. Keep the beta fallback that returns `link` when no
  provider is configured.

### 4.2 Stripe

- **Customer portal**: Settings → Billing → Customer portal → enable. Currently
  `/api/portal` returns `portal=noportal` (Stripe 400), so a paying member
  cannot cancel. Legal pages promise cancellation, so this is a must.
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
