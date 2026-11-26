#!/usr/bin/env bash
# Ship the current tree. Waits out the daily API-deployment cap, then deploys
# and verifies. Run with: bash engine/ship.sh
set -u
cd "$(dirname "$0")/.."
export VERCEL_TOKEN="$(grep -m1 '^VERCEL_TOKEN=' engine/.env | cut -d= -f2-)"
[ -n "$VERCEL_TOKEN" ] || { echo "no VERCEL_TOKEN"; exit 1; }

for i in $(seq 1 120); do
  OUT=$(python -X utf8 -c "
import sys; sys.path.insert(0,'engine'); import publish
try:
  print('OK', publish.deploy(None))
except publish.OutOfBudget:
  print('CAPPED')
" 2>/dev/null)
  case "$OUT" in
    OK*) echo "deployed ${OUT#OK }"; break ;;
    *) echo "attempt $i capped; sleeping 15m"; sleep 900 ;;
  esac
done

sleep 60
for r in / /sport/nba /record /pricing; do
  printf "%-12s %s\n" "$r" "$(curl -s -o /dev/null -w '%{http_code}' "https://tiplab.io$r")"
done
