# Servitro SMTP/IMAP incident — operator recovery procedure

Observed: November 3, 2026. Independent public HTTPS checks show working CA-trusted certificates for the apex, www and app, but mail.theepmo.com on 85.93.31.149 refuses TCP connections on 465, 587 and 993.

Evidence: https://github.com/emkanycom-hash/theepmo-website/actions/runs/41703330227 . The authoritative MX is 10 mail.theepmo.com; SPF and DMARC are published. DKIM signing is not verified.

Servitro support ticket POY-495156 confirms VPS SMTP ports 25, 465 and 587 are not blocked by the hosting provider. This does NOT establish that local MTA/IMAP software is installed, running, listening on the public interface, or allowed through the VPS firewall. On November 3, 2026, a further reply was sent to support reporting independent TCP refusal and requesting diagnosis.

## Authorized VPS procedure

1. Log in securely through the authorized VPS console or SSH account. Do not send passwords or keys in email or paste them into the repository.
2. In the deployment checkout run `bash infra/mail/diagnose-mail.sh` and check only safe service-active and listener summaries; no production changes occur.
3. Identify the installed mail stack (Postfix+Dovecot, Exim+Dovecot, or another stack). Do not install a second MTA over an existing one. On a Postfix/Dovecot host, inspect `sudo postfix check`, `sudo systemctl is-active postfix dovecot`, `sudo ss -ltnp '( sport = :25 or sport = :465 or sport = :587 or sport = :993 )'` and relevant service failure logs (keep sensitive data private).
4. Check the MTA's submission/smtps listener and IMAP's 993 listener, binding to the intended external IP rather than only 127.0.0.1. Repair service configuration, certificate SAN/full chain, and host firewall before restarting. Only after operator validation should services be started with the package-appropriate systemctl action. Do not change authoritative DNS or MX while connectivity is refused.
5. After services listen, run from an independent Internet host: `openssl s_client -connect mail.theepmo.com:465 -servername mail.theepmo.com -verify_hostname mail.theepmo.com -verify_return_error`, `openssl s_client -starttls smtp -connect mail.theepmo.com:587 -servername mail.theepmo.com -verify_hostname mail.theepmo.com -verify_return_error`, and `openssl s_client -connect mail.theepmo.com:993 -servername mail.theepmo.com -verify_hostname mail.theepmo.com -verify_return_error`. Validate CA chain and expiry.
6. Test mail from info@theepmo.com to an external inbox, mail to info@theepmo.com from Gmail, and a reply received back in Gmail. Independently verify SMTP response codes and DKIM, SPF and DMARC alignment. Also verify PTR/rDNS for 85.93.31.149 and SMTP HELO name.

## Independent app /signup repair

App-only hotfix https://github.com/faisalwrokksa-hub/THEEPMOTEST/pull/387 adds the missing route and an invitation request link, not live self-registration. It must pass CI and be deployed to the Servitro application, not the separate marketing Pages repository. A source PR alone cannot make the public route return HTTP 200.

## Boundaries

No connected authenticated VPS terminal is available for this assistant to start the services or change firewall/certificates. The supplied script is read-only; it neither reads mailbox secrets nor changes production. Site TLS success does not prove mail TLS or two-way delivery; the billing launch remains blocked.
