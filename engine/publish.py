import json, os, subprocess, sys, urllib.request

TOKEN = os.environ.get("VERCEL_TOKEN", "")
PROJECT = "prj_JfpPj1cW7sgYftUZ9wjrbnx6D6ga"
TEAM = "team_I1jfujieN7ofXAqLMLU4iRvh"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def api(path, method="GET", body=None):
    req = urllib.request.Request(
        f"https://api.vercel.com{path}",
        data=json.dumps(body).encode() if body else None,
        method=method,
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read() or b"{}")

def files():
    out = []
    for base, dirs, names in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in ("node_modules", ".next", ".vercel", ".git", "__pycache__", "engine")]
        for n in names:
            if n.endswith((".log",)) or n.startswith(".env"):
                continue
            p = os.path.join(base, n)
            rel = os.path.relpath(p, ROOT).replace("\\", "/")
            out.append({"file": rel, "data": open(p, encoding="utf-8", errors="ignore").read()})
    return out

def deploy():
    payload = {"name": "tiplab", "project": PROJECT, "target": "production", "files": files()}
    d = api(f"/v13/deployments?teamId={TEAM}&forceNew=1", "POST", payload)
    return d.get("url")

if __name__ == "__main__":
    if not TOKEN:
        print("no VERCEL_TOKEN", file=sys.stderr)
        sys.exit(1)
    print(deploy())
