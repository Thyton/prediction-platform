"""Deploy by pushing, not by the Vercel deployments API.

The Hobby plan allows ~100 *API* deployments a day and the 5-minute engine
chain eats them by lunchtime. Vercel's Git integration builds from a push and
does not count against that quota, so once the project is Git-linked this is
the path to use and publish.py becomes the fallback.

Setup (one dashboard step, then permanent):
  1. Vercel → Project `web` → Settings → Git → Connect Git Repository →
     Thyton/prediction-platform, production branch `main`.
  2. Add the repo to .gitignore-free paths (data/ is already committed).

This script does not build anything itself: it commits the data just produced
and pushes. Vercel build runs `npm run build` on its own side.
"""
import os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, timeout=120)

def main():
    if git("remote", "get-url", "origin").returncode:
        print("no origin remote", file=sys.stderr)
        return 1
    st = git("status", "--porcelain", "data", "engine/model_state.json", "engine/tuned.json")
    if not st.stdout.strip():
        print("nothing to push")
        return 0
    git("add", "data", "engine/model_state.json", "engine/tuned.json")
    import datetime
    msg = "data: cycle " + datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%dT%H:%MZ")
    c = git("commit", "-q", "-m", msg)
    if c.returncode:
        print("commit failed:", c.stderr[:160], file=sys.stderr)
        return 1
    p = git("push", "-q", "origin", "HEAD:main")
    if p.returncode:
        print("push failed:", p.stderr[:160], file=sys.stderr)
        return 1
    print(msg)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
