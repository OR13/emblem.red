#!/usr/bin/env bash
# Collect a Cloudflare API token safely, WITHOUT the value ever crossing the
# agent chat/tool stream. Run this yourself in a fresh terminal window:
#
#   bash ~/or13.io/projects/emblem.red/demo/scripts/collect-cf-token.sh
#
# It reads the token via a silent prompt (no echo, not saved to shell history),
# verifies it live against the Cloudflare API, then writes demo/.env.local
# (gitignored, chmod 600). Only non-secret status is printed.
set -euo pipefail

ZONE_NAME="emblem.red"
ZONE_ID="ea920d133ec49cb6b2a419ccfd6974e5"
ENV_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.env.local"

printf 'Paste the Cloudflare API token (input hidden): '
IFS= read -rs TOKEN
printf '\n'
[ -n "${TOKEN:-}" ] || { echo "No token entered. Aborting."; exit 1; }

echo "-> Verifying token is active..."
VERIFY=$(curl -s -H "Authorization: Bearer ${TOKEN}" \
  "https://api.cloudflare.com/client/v4/user/tokens/verify")
if ! grep -q '"status":"active"' <<<"${VERIFY}"; then
  echo "FAIL: token did not verify as active. Response:"; echo "${VERIFY}"
  unset TOKEN; exit 1
fi
echo "OK: token active."

echo "-> Checking DNS read on ${ZONE_NAME}..."
DNSCHK=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer ${TOKEN}" \
  "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records?per_page=1")
echo "   HTTP ${DNSCHK} on dns_records list (200 = token reaches the zone)"

umask 077
cat > "${ENV_FILE}" <<EOF
CLOUDFLARE_API_TOKEN=${TOKEN}
CLOUDFLARE_ZONE_ID=${ZONE_ID}
EOF
chmod 600 "${ENV_FILE}"
unset TOKEN

echo "OK: wrote ${ENV_FILE} (chmod 600, gitignored)."
echo "   Vars: CLOUDFLARE_API_TOKEN=<hidden>  CLOUDFLARE_ZONE_ID=${ZONE_ID}"
echo
echo 'Done. Tell the agent "token is in place" and it will run the end-to-end test.'
