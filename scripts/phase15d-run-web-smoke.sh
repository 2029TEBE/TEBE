#!/usr/bin/env bash
# Phase 15D: start the compiled Next.js standalone artifact and check it over HTTP.
# Strictly for a disposable CI runner with an API already listening on :4000.
# Does not read credentials or mutate any application/database records.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
ARTIFACT=apps/web/.next-prod/standalone/apps/web/server.js
if [[ ! -s "$ARTIFACT" ]]; then
  echo 'BLOCKED: compiled Next.js standalone entrypoint missing; build first.' >&2
  exit 1
fi
command -v node >/dev/null || { echo 'BLOCKED: Node.js is missing.' >&2; exit 1; }
command -v curl >/dev/null || { echo 'BLOCKED: curl is missing.' >&2; exit 1; }

# A Next.js standalone server does not automatically contain its client JS/CSS.
# Mirror the production Docker image's asset layout before browser acceptance:
# without this, HTML smoke passes while React hydration and form journeys fail.
STATIC_SRC=apps/web/.next-prod/static
STANDALONE_WEB=apps/web/.next-prod/standalone/apps/web
if [[ ! -d "$STATIC_SRC" || ! -d apps/web/public ]]; then
  echo 'BLOCKED: compiled Next.js static/public assets missing; build first.' >&2
  exit 1
fi
STATIC_JS=$(find "$STATIC_SRC" -type f -name '*.js' -print -quit)
if [[ -z "$STATIC_JS" ]]; then
  echo 'BLOCKED: compiled Next.js client JavaScript missing.' >&2
  exit 1
fi
mkdir -p "$STANDALONE_WEB/.next-prod/static" "$STANDALONE_WEB/public"
cp -a "$STATIC_SRC/." "$STANDALONE_WEB/.next-prod/static/"
cp -a apps/web/public/. "$STANDALONE_WEB/public/"
STATIC_REL="${STATIC_JS#"$STATIC_SRC"/}"

# Never allow a caller to silently redirect this acceptance step to a live site.
PHASE15D_WEB_URL=http://127.0.0.1:3000 node --input-type=module -e \
  "import {assertLocalWebOrigin} from './scripts/phase15d-web-smoke.mjs'; assertLocalWebOrigin(process.env.PHASE15D_WEB_URL);"

# Prevent a pre-existing local server from being mistaken for the compiled app.
if curl --silent --fail --max-time 2 http://127.0.0.1:3000/login >/dev/null 2>&1; then
  echo 'BLOCKED: port 3000 is already serving HTTP; cannot attest the new compiled web process.' >&2
  exit 1
fi

LOG=$(mktemp)
WEB_PID=''
cleanup() {
  if [[ -n "$WEB_PID" ]]; then
    kill "$WEB_PID" 2>/dev/null || true
    wait "$WEB_PID" 2>/dev/null || true
  fi
  rm -f "$LOG"
}
trap cleanup EXIT

# The compiled browser origin must match the allowlist used for CSRF and
# canonical redirects. CI API uses localhost:3000 for backend tests, but this
# isolated compiled web process is intentionally bound to 127.0.0.1.
NODE_ENV=production WEB_ORIGIN=http://127.0.0.1:3000 HOSTNAME=127.0.0.1 PORT=3000 NEXT_DIST_DIR=.next-prod \
  node "$ARTIFACT" >"$LOG" 2>&1 &
WEB_PID=$!
ready=0
for attempt in $(seq 1 45); do
  if curl --silent --fail --max-time 2 http://127.0.0.1:3000/login >/dev/null 2>&1; then
    ready=1
    break
  fi
  if ! kill -0 "$WEB_PID" 2>/dev/null; then
    echo 'BLOCKED: compiled Next.js server exited before becoming ready' >&2
    tail -n 50 "$LOG" >&2
    exit 1
  fi
  sleep 2
done
if [[ "$ready" -ne 1 ]]; then
  echo 'BLOCKED: compiled Next.js server did not become ready within 90 seconds' >&2
  tail -n 50 "$LOG" >&2
  exit 1
fi

# Require at least one real compiled client bundle over HTTP, not only 200 HTML.
# A missing bundle silently invalidates every authenticated Playwright assertion.
if ! curl --fail --silent --show-error --max-time 10 "http://127.0.0.1:3000/_next/static/$STATIC_REL" >/dev/null; then
  echo 'BLOCKED: compiled Next.js client bundle is not served; browser hydration unverified.' >&2
  exit 1
fi

if ! PHASE15D_WEB_URL=http://127.0.0.1:3000 node scripts/phase15d-web-smoke.mjs; then
  echo 'BLOCKED: compiled Next.js web acceptance failed' >&2
  tail -n 50 "$LOG" >&2
  exit 1
fi

# Browser screenshots/traces are LOCAL, PUBLIC and credential-free. The
# synthetic authenticated journey is opt-in for a disposable local fixture only.
if [[ "${EPMO_BROWSER_UAT:-0}" == "1" ]]; then
  EPMO_UAT_MODE=public EPMO_UAT_URL=http://127.0.0.1:3000 \
    EPMO_UAT_OUT=/tmp/epmo-browser-uat node scripts/frontend-browser-uat.mjs
fi

# Opt-in authenticated F44 journeys require two disposable .test accounts.
# They cannot be mistaken for real staging acceptance or run without credentials.
if [[ "${EPMO_CUSTOMER_JOURNEY:-0}" == "1" ]]; then
  EPMO_UAT_URL=http://127.0.0.1:3000 \
    EPMO_UAT_OUT=/tmp/epmo-customer-journey \
    node scripts/frontend-customer-journey.mjs
fi
