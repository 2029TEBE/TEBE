#!/usr/bin/env bash
# THE EPMO — read-only mail listener triage for an authorized VPS operator.
# No mutations, credentials, mailbox content, email sending, or provider contact.
set -uo pipefail
printf 'THE EPMO mail listener triage — READ ONLY\n'
date -u '+Observed UTC: %Y-%m-%dT%H:%M:%SZ'

echo '[1] Installed mail services and systemd status'
if command -v systemctl >/dev/null 2>&1; then
  for service in postfix exim4 dovecot; do
    active="$(systemctl is-active "$service" 2>/dev/null || true)"
    enabled="$(systemctl is-enabled "$service" 2>/dev/null || true)"
    printf '%-12s active=%-12s enabled=%s\n' "$service" "${active:-unknown}" "${enabled:-unknown}"
  done
else
  echo 'systemctl unavailable; inspect installed service manager'
fi

echo '[2] Mail TCP listeners (25 inbound MX, 465 SMTPS, 587 submission, 993 IMAPS)'
if command -v ss >/dev/null 2>&1; then
  listeners="$(ss -H -ltn '( sport = :25 or sport = :465 or sport = :587 or sport = :993 )' 2>/dev/null || true)"
  if [ -n "$listeners" ]; then printf '%s\n' "$listeners"; else echo 'No relevant listeners found'; fi
  for port in 25 465 587 993; do
    endpoints="$(printf '%s\n' "$listeners" | awk -v p=":$port" 'NF>=4 && substr($4, length($4)-length(p)+1)==p {print $4}')"
    if [ -z "$endpoints" ]; then
      printf 'PORT %-3s: NO LISTENER — inspect service startup and configuration\n' "$port"
    elif printf '%s\n' "$endpoints" | grep -Eq '^(0\.0\.0\.0|\*|\[::\]|[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+):'; then
      printf 'PORT %-3s: IPv4 or wildcard listener seen; external firewall/reachability not verified\n' "$port"
    elif printf '%s\n' "$endpoints" | grep -Eq '^(127\.|\[::1\]):'; then
      printf 'PORT %-3s: LOOPBACK listener seen; check external bind and other listeners\n' "$port"
    else
      printf 'PORT %-3s: listener seen (%s); external accessibility not verified\n' "$port" "$(printf '%s' "$endpoints" | tr '\n' ' ')"
    fi
  done
else
  echo 'ss unavailable; no local listener conclusion possible'
fi

echo '[3] Available mail stack and firewall tools'
for tool in postfix dovecot exim4 certbot ufw firewall-cmd docker; do
  if command -v "$tool" >/dev/null 2>&1; then printf '%s present\n' "$tool"; else printf '%s absent\n' "$tool"; fi
done
if command -v docker >/dev/null 2>&1; then
  echo 'Docker container names/status (if readable):'
  docker ps --format '{{.Names}} {{.Status}} {{.Ports}}' 2>/dev/null | head -20 || true
fi

echo '[4] Firewall status — summaries only'
if command -v ufw >/dev/null 2>&1; then ufw status 2>/dev/null | head -25 || true; fi
if command -v firewall-cmd >/dev/null 2>&1; then firewall-cmd --state 2>/dev/null || true; fi

echo '[5] Next steps'
echo 'If listeners are missing: inspect the installed mail service status and configuration (Postfix/Exim, Dovecot or container).'
echo 'If listeners are loopback only: check intended bind address before changing any firewall rules.'
echo 'If external listeners are present but public TCP is refused: inspect host firewall and service/provider network policy.'
echo 'Port 25 carries inbound MX mail. Ports 465/587 are SMTP client submission and 993 is IMAP; each requires distinct acceptance.'
echo 'Before changing services, verify certificate chain/hostname and preserve existing configuration and mailbox data.'
echo 'Do not contact Servitro support without the user\x27s explicit prior approval.'
echo 'No system configuration, credentials, keys, messages, services, or DNS records were modified.'
