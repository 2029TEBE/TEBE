#!/usr/bin/env bash
# Read-only host-local mail preflight for Servitro mail.theepmo.com.
# Run in the actual VPS console. DOES NOT start services, edit ports, or print credentials.
set -euo pipefail
printf '%s\n' 'THE EPMO mail listener diagnostic (read only)' 'Expected: mail.theepmo.com on the Servitro VPS'
if ! command -v ss >/dev/null 2>&1; then
  echo 'BLOCKED: ss command missing; install iproute2 by authorized operator'; exit 2
fi
for p in 25 465 587 993; do
  if ss -H -lnt | awk -v p="$p" '$4 ~ (":" p "$") { found=1 } END { exit !found }'; then
    echo "LISTENER $p: present"
  else
    echo "LISTENER $p: MISSING"
  fi
done
if command -v systemctl >/dev/null 2>&1; then
  for svc in postfix dovecot exim4 nginx apache2; do
    state="$(systemctl is-active "$svc" 2>/dev/null || true)"
    if [[ "$state" != unknown && "$state" != inactive && -n "$state" ]]; then
      printf 'SYSTEMD %s: %s\n' "$svc" "$state"
    fi
  done
fi
if command -v ufw >/dev/null 2>&1; then
  state="$(ufw status 2>/dev/null | head -1 || true)"
  printf 'UFW state: %s\n' "$state"
fi
echo 'Operator next: identify actual mail stack, verify service health/listeners and firewall, then validate CA-trusted TLS and independent inbox receipt.'
echo 'This script neither changes services nor proves delivery.'
