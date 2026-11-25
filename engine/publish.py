import json, os, subprocess, sys, urllib.request

TOKEN = os.environ.get("VERCEL_TOKEN", "")
PROJECT = "prj_mybaeapCVsT1BpmCyDoAp1l2wZbA"
TEAM = "team_I1jfujieN7ofXAqLMLU4iRvh"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
BUDGET = int(os.environ.get("DEPLOY_BUDGET", "85"))   # Hobby allows 100/day; keep headroom

def api(path, method="GET", body=None):
    req = urllib.request.Request(
        f"https://api.vercel.com{path}",
        data=json.dumps(body).encode() if body else None,
        method=method,
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read() or b"{}")

def files(only=None):
    """`only` keeps a deploy to a set of paths (plus everything a render needs).
    A Vercel deployment is an immutable snapshot, so anything left out is absent
    on the new build — the site's read files must always travel with it."""
    out = []
    keep_prefix = ("app/", "lib/", "public/", "package", "data/", "next.config", "jsconfig", "vercel.json")
    for base, dirs, names in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in ("node_modules", ".next", ".vercel", ".git", "__pycache__", "engine")]
        for n in names:
            if n.endswith((".log",)) or n.startswith(".env"):
                continue
            p = os.path.join(base, n)
            rel = os.path.relpath(p, ROOT).replace("\\", "/")
            if only and rel not in only and not rel.startswith(keep_prefix):
                continue
            out.append({"file": rel, "data": open(p, encoding="utf-8", errors="ignore").read()})
    return out

def deploy(only=None):
    payload = {"name": "tiplab", "project": PROJECT, "target": "production", "files": files(only)}
    d = api(f"/v13/deployments?teamId={TEAM}&forceNew=1", "POST", payload)
    return d.get("url")

def fingerprint():
    """Content hash of what a deploy would ship. Unchanged -> skip. The state
    file itself is excluded or it changes the hash it is compared against."""
    h = __import__("hashlib").sha256()
    for f in files():
        if f["file"].endswith(".deploy_state.json"):
            continue
        h.update(f["file"].encode())
        h.update(f["data"].encode())
    return h.hexdigest()

def deploys_today():
    d = api(f"/v6/deployments?projectId={PROJECT}&teamId={TEAM}&limit=100")
    import datetime
    cutoff = datetime.datetime.now(datetime.UTC) - datetime.timedelta(hours=24)
    return sum(
        1 for x in d.get("deployments", [])
        if datetime.datetime.fromtimestamp(x["created"] / 1000, datetime.UTC) > cutoff
    )

def main(argv):
    live = "--live" in argv
    state = os.path.join(DATA, ".deploy_state.json")
    prev = {}
    try:
        prev = json.load(open(state))
    except Exception:
        pass
    key = "live_hash" if live else "full_hash"
    fp = live_fingerprint() if live else fingerprint()
    # skip when the payload is byte-identical, live or full
    if fp and prev.get(key) == fp:
        print("unchanged, skip")
        return 0
    used = deploys_today()
    if used >= BUDGET:
        print(f"deploy budget reached ({used}/{BUDGET}), skip")
        return 0
    url = deploy({"data/live.json"} if live else None)
    prev[key] = fp
    try:
        json.dump(prev, open(state, "w"))
    except Exception:
        pass
    print(url)
    return 0

def hashlib_of(path):
    try:
        return __import__("hashlib").sha256(open(path, "rb").read()).hexdigest()
    except Exception:
        return ""

def live_fingerprint():
    """Hash only signal content — generatedAt changes every run and would
    otherwise make every poll look different."""
    try:
        d = json.load(open(os.path.join(DATA, "live.json")))
        return __import__("hashlib").sha256(json.dumps(d.get("signals", []), sort_keys=True).encode()).hexdigest()
    except Exception:
        return ""

if __name__ == "__main__":
    if not TOKEN:
        print("no VERCEL_TOKEN", file=sys.stderr)
        sys.exit(1)
    raise SystemExit(main(sys.argv[1:]))
