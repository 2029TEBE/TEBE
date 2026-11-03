#!/usr/bin/env bash
# Read-only THE EPMO Servitro mail listener check. No credentials or changes.
set -uo pipefail
printf 'THE EPMO mail listener / TLS readiness — READ ONLY\n'
date -u '+Observed UTC: %Y-%m-%dT%H:%M:%SZ'
echo '[1] Mail services and their active status'
if command -v systemctl >/dev/null 2>&1; then
  for service in postfix exim4 dovecot docker; do
    printf '%-12s %s\n' "$service" "$(systemctl is-active "$service" 2>/dev/null || true)"
  done
fi
echo '[2] Ports 25,465,587,993 and listen interfaces'
if command -v ss >/dev/null 2>&1; then
  ss -H -ltn '( sport = :25 or sport = :465 or sport = :587 or sport = :993 )' || true
fi
echo '[3] Installed mail/SSL tools'
for tool in postfix dovecot exim4 certbot ufw firewall-cmd; do
  if command -v "$tool" >/dev/null 2>&1; then echo "$tool present"; else echo "$tool absent"; fi
done
echo '[4] High-level firewall status only'
if command -v ufw >/dev/null 2>&1; then ufw status 2>/dev/null | head -25 || true; fi
if command -v firewall-cmd >/dev/null 2>&1; then firewall-cmd --state 2>/dev/null || true; fi
echo 'No configuration, credentials, keys, messages or services were modified.'
echo 'Stop here; a VPS operator must verify SSL and authorize repairs.'
