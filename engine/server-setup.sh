#!/usr/bin/env bash
# Run the TipLab cycle on this box, every 30 minutes, via cron.
#
# One-time setup:
#   git clone https://github.com/Thyton/prediction-platform.git ~/tiplab
#   cd ~/tiplab && cp engine/.env.example engine/.env   # then fill it in
#   bash engine/server-setup.sh
#
# Deploys go out through the Vercel API (engine/publish.py), exactly as they do
# from a laptop, so nothing about the site changes — only where the timer lives.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
PY="$(command -v python3)"
LOG="$REPO/data/cycle.log"

echo "repo: $REPO"
echo "python: $PY"

command -v git >/dev/null || { echo "install git first"; exit 1; }
[ -f "$REPO/engine/.env" ] || { echo "engine/.env missing — copy .env.example and fill it in"; exit 1; }
grep -q VERCEL_TOKEN "$REPO/engine/.env" || { echo "engine/.env has no VERCEL_TOKEN"; exit 1; }

mkdir -p "$REPO/data"
touch "$LOG"

# Cron needs one line; the lock stops a slow run overlapping the next.
# stdlib only, so no virtualenv and no pip.
LINE="*/30 * * * * cd $REPO/engine && flock -n /tmp/tiplab.lock $PY -X utf8 cycle.py >> $LOG 2>&1"

crontab -l 2>/dev/null | grep -v "tiplab.lock" | { cat; echo "$LINE"; } | crontab -
echo "cron installed:"
crontab -l | grep tiplab.lock

echo
echo "Done. Logs: $LOG"
echo "First run in under 30 minutes; to test now:"
echo "  cd $REPO/engine && $PY -X utf8 cycle.py"
