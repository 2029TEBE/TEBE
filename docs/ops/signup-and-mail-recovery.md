# Live customer signup and mail recovery

This patch is intentionally **separate from** the pending Paddle billing and consolidated commercial release branches.

## Public `/signup` 404
The deployed application's protected `main` source lacked `apps/web/src/app/signup/page.tsx`, although newer commercial review branches had an invitation-only route. This minimal patch adds a bilingual public route to main's source, with NO tenant creation, payment collection or login changes. It links to the functioning `/login` and marketing site. Invitation requests are deliberately hidden until `EPMO_SIGNUP_EMAIL_READY=true` is set on the server **after independent two-way email acceptance**. The default is false.

**Review/acceptance:** exact-head green API/web build, code diff and route test, production-equivalent isolated staging deployment, curl `https://app.theepmo.com/signup` HTTP 200, no-change to existing login, exact deployed image/commit proof. This patch does NOT deploy the server or authorize full Paddle launch.

## Mail: ports 465, 587, 993 refused
Independent GitHub-runner audit [41703330227](https://github.com/emkanycom-hash/theepmo-website/actions/runs/41703330227) found trusted HTTPS certificates on theepmo.com/www/app, authoritative MX=mail.theepmo.com, SPF/DMARC present, but refused TCP 465,587,993 at 85.93.31.149. Servitro ticket POY-495156 stated VPS outbound SMTP ports open; that's different from incoming service listeners. The mail stack resides **inside the VPS**.

1. Access the **actual** VPS using the owner-authorized SSH or Servitro VNC console; do not use production/root passwords in a chat or git file.
2. Run `bash infra/mail-service-preflight.sh` inside the VPS to identify missing listening ports. Check service stack: Postfix+Dovecot, Exim, Mailcow, or another managed mail suite. Do not install or restart arbitrary daemons until stack type and local configuration are known.
3. For Postfix+Dovecot, inspect `systemctl status postfix dovecot --no-pager`, `journalctl -u postfix -u dovecot -n 100 --no-pager`, `ss -lntp`, `ufw status`. Avoid sharing passwords, hashes, credential-containing config, or private mailbox contents.
4. Once the installed mail suite and host firewall are corrected by authorized administrator, verify externally that `mail.theepmo.com:465` (implicit SMTP TLS), `:587` (STARTTLS SMTP), and `:993` (IMAPS) are listening with matching trusted certificates. Inbound MX delivery requires mail port 25 too.
5. DKIM selector, SPF alignment, DMARC, reverse DNS (PTR), authenticated Gmail 'Send mail as' and independent Gmail-to-mailbox receipt+mailbox-to-Gmail reply MUST pass before setting `EPMO_SIGNUP_EMAIL_READY=true`. If the installed mail suite does not expose IMAPS/Submission, decide on a supported managed provider rather than changing ports at random.

No production DNS, firewall, user credentials, or certs are modified by this code. Marketing remains in independent `emkanycom-hash/theepmo-website`; web application remains in `faisalwrokksa-hub/THEEPMOTEST`.
