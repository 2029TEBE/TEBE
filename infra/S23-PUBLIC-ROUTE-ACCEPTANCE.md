# S23 public route acceptance (offline, nondeploying)
This gate consumes **independently collected** read-only HTTPS observations, not fabricated test fixtures. It never contacts the live site, modifies DNS, sends mail, or authorizes deployment.

Required exact routes: `https://theepmo.com/`, `https://app.theepmo.com/login`, and `https://app.theepmo.com/signup`. Each must return HTTP 200 without redirects and with independently verified TLS within five minutes. The signup experience must be **account registration**; an invitation-request page does not satisfy this contract. An HTTP 404 for signup is a release blocker even when apex/login return 200.

Capture timestamp, route, status, verified TLS and probe provenance through a controlled read-only observer. Confirm actual page functionality separately; this metadata contract cannot authenticate the content or verify the deployed SHA. Do not include headers, cookies, secrets, mail credentials, or customer data in receipts.

The `candidateSha` is a source identity declaration only, **not** proof of the image currently running on Servitro. Deployed SHA/image provenance, nonprod tenant RLS, encrypted off-host backup and isolated restoration, monitoring, rollback, legal signoff, provider email delivery and seven genuine Stripe TEST receipts remain separate mandatory gates. Maintain NO-GO until independently accepted.
