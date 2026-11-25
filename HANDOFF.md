# TipLab — remaining work for Codex

Everything below is deliberately scoped: no rewriting, no new features, no
changing model behaviour except where stated. Read a file before editing it.

Repo: `https://github.com/Thyton/prediction-platform`, branch `main`.
Deploy goes through `engine/publish.py` (Vercel API) — pushing does **not**
deploy. Engine secrets live in `engine/.env` (see `engine/.env.example`).

---

## 1. Email provider (unblocks reset, verify and alerts)

All the email code is written and waiting; it no-ops until a key exists.

1. Create a Resend account, verify the `tiplab.io` sending domain, make an API key.
2. Add to the **Vercel project** env (project `prj_mybaeapCVsT1BpmCyDoAp1l2wZbA`):
   `RESEND_API_KEY`, and optionally `EMAIL_FROM` (default `TipLab <noreply@tiplab.io>`).
3. Redeploy. Then confirm:
   - signup sends a welcome/verify email and marks the account `verified`
   - `/api/auth/forgot` returns `emailed: true` and no longer leaks `link`
   - `POST /api/alerts` with a test signal reaches a Pro member's inbox

Nothing to change in code. Do not remove the beta fallback that returns `link`
when no provider is configured.

## 2. Engine off the laptop (structural)

GitHub Actions schedules do not fire for this GitHub account at all (proven
with a throwaway repo — `workflow_dispatch` works, `schedule` never fires).
The cycle currently runs from a Windows Scheduled Task.

Target: a Linux host with cron. DigitalOcean droplet `162.243.0.218` already
exists (it hosts legacy FormTally). Steps:

1. Get SSH access working from the operator's machine (`ssh-copy-id root@162.243.0.218`).
2. `git clone https://github.com/Thyton/prediction-platform.git ~/tiplab`
3. `cp engine/.env.example engine/.env` and fill VERCEL_TOKEN + ODDS_API_KEY
   (copy the values from the operator's `engine/.env`).
4. `bash engine/server-setup.sh` — installs the 30-minute cron with a lock.
5. Run `cd ~/tiplab/engine && python3 -X utf8 cycle.py` once by hand and watch
   `data/cycle.log`. It must exit 0 and produce a Vercel deployment URL.
6. Only after 2 clean runs: disable the Windows task
   (`schtasks /Change /TN TipLabCycle /DISABLE`).

Caveat to raise: that droplet also runs FormTally. Confirm headroom before
adding load, and check the Python is 3.11+ (the code uses `datetime.UTC`).

## 3. Alerts should not fire for unverified addresses

`app/api/alerts/route.js` already filters `u.pro && u.verified`. Verify with a
Pro test account once email is live. If alert emails are noisy, cap at one
email per member per 20 minutes — add a `lastAlert` timestamp on the user and
skip inside the send loop.

## 4. Output of a run is buried

`cycle.py` prints handfuls of lines; nobody reads them. Add a one-line summary
to the end of `main()` — graded count, picks added, deploy result — written to
`data/cycle.log` too. `print(..., file=sys.stderr)` as the rest does.

## 5. Small correctness pass

- `app/api/checkout/route.js`: if Stripe returns an error, the JSON is surfaced
  verbatim to the user. Map it to a friendly message, log the detail.
- `lib/store.js` `hash()` is a bare SHA-256 with a static prefix, not a slow
  KDF. Do not change it in place (existing passwords would break) — instead
  accept `scrypt` hashes on login and re-hash on next successful sign-in.
- `app/page.js` "All games" tab renders 80 rows with no order guarantee. Sort by
  kickoff.

## 6. Do not touch without asking

- `engine/model.py` gate values (`MIN_EDGE`, `MODEL_MARGIN`, floors, conviction
  zone). They were tuned deliberately — see comments in the file.
- The forward/backtest split on `/record`. Forward must never be blended into a
  headline number.
- Draws grading as `push`. Do not "fix" these back to losses.

---

## Verifying a change

`npm run build` must pass. Then check the live site after deploying:
`curl -s -o /dev/null -w "%{http_code}" https://tiplab.io/<route>` → 200.

Auth behaviour that now exists and must keep working:

| case | expected |
| --- | --- |
| signup, new address | 200, session cookie |
| signup, address taken | 409, `code: exists` |
| login, wrong password | 401, `code: badpw` |
| login, unknown address | 404, `code: missing` |
| forgot, any address | 200 always (no enumeration) |
| reset token reuse | 400 expired/used |
